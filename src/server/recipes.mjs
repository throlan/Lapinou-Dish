import {componentErrors,loadRecipeGraph,validateRecipeGraph,recipeFraction} from './recipe-ingredients.mjs';
import { randomUUID } from 'node:crypto';
import { calculateRecipeNutrition } from '../domain/foods.ts';
import { restoreOriginalServingMode, syncServingParts, validateServingParts } from './serving-parts.mjs';
import { lockHouseholdInventory } from './ingredient-stock.mjs';
import { removeStoredRecipeImageFiles } from './recipe-images.mjs';

export function validateRecipeDeletion(input) {
  if(!input || !isUuid(input.householdId))return {error:'invalid-household-id'};
  if(!Number.isSafeInteger(input.version) || input.version<0)return {error:'invalid-recipe-version'};
  return {data:{householdId:input.householdId,version:input.version}};
}

export async function deleteRecipe(pool,id,data,imageOptions) {
  const client=await pool.connect();
  let files=[];
  try{
    await client.query('BEGIN');
    await lockHouseholdInventory(client,data.householdId);
    const found=await client.query('SELECT id,version FROM recipes WHERE id=$1 AND household_id=$2 AND parent_recipe_id IS NULL FOR UPDATE',[id,data.householdId]);
    if(!found.rowCount){await client.query('ROLLBACK');return null;}
    if(Number(found.rows[0].version)!==data.version){await client.query('ROLLBACK');return {error:'recipe-version-conflict'};}
    const children=await client.query('SELECT id FROM recipes WHERE parent_recipe_id=$1 AND household_id=$2 FOR UPDATE',[id,data.householdId]);
    const ids=[id,...children.rows.map(part=>part.id)];
    const refs=await client.query(`SELECT
      (SELECT count(*) FROM planned_meal_items WHERE recipe_id=ANY($1::uuid[])) AS meals,
      (SELECT count(*) FROM stock_lots WHERE recipe_id=ANY($1::uuid[])) AS productions`,[ids]);
    const usage={meals:Number(refs.rows[0].meals),productions:Number(refs.rows[0].productions)};
    if(usage.meals || usage.productions){await client.query('ROLLBACK');return {error:'recipe-in-use',...usage};}
    const ingredientUses=await client.query('SELECT DISTINCT source.id,source.name FROM recipe_lines l JOIN recipes r ON r.id=l.recipe_id JOIN recipes source ON source.id=COALESCE(r.parent_recipe_id,r.id) WHERE l.ingredient_recipe_id=ANY($1::uuid[]) AND NOT (l.recipe_id=ANY($1::uuid[]))',[ids]);
    if(ingredientUses.rowCount){await client.query('ROLLBACK');return {error:'recipe-in-use',recipes:ingredientUses.rows};}
    const images=await client.query('SELECT file_name FROM recipe_images WHERE recipe_id=ANY($1::uuid[]) FOR UPDATE',[ids]);
    files=images.rows.map(image=>image.file_name);
    await client.query('DELETE FROM recipes WHERE parent_recipe_id=$1 AND household_id=$2',[id,data.householdId]);
    await client.query('DELETE FROM recipes WHERE id=$1 AND household_id=$2',[id,data.householdId]);
    await client.query('COMMIT');
  }catch(error){
    await client.query('ROLLBACK');
    if(error.code==='23503')return {error:'recipe-in-use'};
    throw error;
  }finally{client.release();}
  return {deleted:true,...await removeStoredRecipeImageFiles(files,imageOptions)};
}

export function validateRecipeInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'invalid-body' };
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 200) return { error: 'invalid-name' };
  if (!isUuid(input.householdId)) return { error: 'invalid-household-id' };
  const amount = input.yield?.amount;
  const unitId = input.yield?.unitId;
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || amount > 100000) return { error: 'invalid-yield' };
  if (typeof unitId !== 'string' || !/^[a-z][a-z0-9_-]{0,30}$/.test(unitId)) return { error: 'invalid-yield-unit' };
  const recipeTypes = ['dish', 'salad', 'sauce', 'beverage', 'accompaniment', 'dessert'];
  const productionTypes = ['none', 'batch_cooking', 'pasta', 'pastry', 'bread'];
  const mealMoments = ['breakfast', 'lunch', 'dinner', 'snack'];
  const recipeType = input.recipeType == null ? 'dish' : input.recipeType;
  if (typeof recipeType !== 'string' || (!recipeTypes.includes(recipeType) && !/^custom-[a-z0-9_-]{1,33}$/.test(recipeType))) return { error: 'invalid-recipe-type' };
  const productionType = input.productionType == null ? 'none' : input.productionType;
  if (!productionTypes.includes(productionType) && !/^custom-[a-z0-9_-]{1,33}$/.test(productionType)) return { error: 'invalid-production-type' };
  const moments = input.mealMoments == null ? [] : input.mealMoments;
  if (!Array.isArray(moments) || moments.length > mealMoments.length || moments.some((moment) => !mealMoments.includes(moment)) || new Set(moments).size !== moments.length) return { error: 'invalid-meal-moments' };
  if (!Array.isArray(input.lines) || input.lines.length === 0 || input.lines.length > 300) return { error: 'invalid-lines' };
  const serving = validateServingParts(input, recipeType);
  if (serving.error) return serving;
  const outputUnits=input.outputUnits ?? {};
  if(!outputUnits || typeof outputUnits!=='object' || Array.isArray(outputUnits) || Object.entries(outputUnits).some(([unit,value])=>!['piece','slice','portion','g','ml'].includes(unit) || !Number.isFinite(value) || value<=0 || value>100000 || (unit===unitId && value!==amount)))return {error:'invalid-output-units'};
  const minimumProductionAmount=input.minimumProductionAmount??0;
  const minimumProductionUnitId=input.minimumProductionUnitId??(['piece','slice','portion','g','ml'].includes(unitId)?unitId:'portion');
  if(!Number.isFinite(minimumProductionAmount)||minimumProductionAmount<0||minimumProductionAmount>100000||!['piece','slice','portion','g','ml'].includes(minimumProductionUnitId))return {error:'invalid-production-minimum'};
  if(minimumProductionAmount>0&&(productionType==='none'||!(minimumProductionUnitId===unitId||Number(outputUnits[minimumProductionUnitId])>0)))return {error:productionType==='none'?'production-minimum-requires-tracking':'production-minimum-unit-missing'};
  const lines = [];
  for (const line of input.lines) {
    if (!line || Boolean(line.foodId) === Boolean(line.recipeId) || !(line.foodId ? isUuid(line.foodId) : isUuid(line.recipeId))) return { error: 'invalid-food-id' };
    if (typeof line.quantity !== 'number' || !Number.isFinite(line.quantity) || line.quantity <= 0 || line.quantity > 100000) return { error: 'invalid-quantity' };
    if (typeof line.unitId !== 'string' || !/^[a-z][a-z0-9_-]{0,30}$/.test(line.unitId)) return { error: 'invalid-unit' };
    if (line.cookingFactor != null && (typeof line.cookingFactor !== 'number' || !Number.isFinite(line.cookingFactor) || line.cookingFactor <= 0 || line.cookingFactor > 10)) return {error:'invalid-cooking-factor'};
    lines.push({ foodId: line.foodId || null, recipeId:line.recipeId || null, quantity: line.quantity, unitId: line.unitId, componentId: null, variantId: null, servingPart: serving.data.separateStarch ? line.servingPart ?? 'main' : 'main', cookingFactor: line.cookingFactor ?? null });
  }
  return { data: { ...serving.data, name: input.name.trim(), description: typeof input.description === 'string' ? input.description.slice(0, 5000) : '', instructions: typeof input.instructions === 'string' ? input.instructions.slice(0, 20000) : '', sourceUrl: typeof input.sourceUrl === 'string' && /^https:\/\//i.test(input.sourceUrl) ? input.sourceUrl.slice(0, 2000) : null, recipeType, productionType, minimumProductionAmount, minimumProductionUnitId, mealMoments: [...moments], householdId: input.householdId, outputUnits, yield: { amount, unitId }, lines } };
}

export function validateRecipeSettings(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || !isUuid(input.householdId)) return { error: 'invalid-household-id' };
  if (!Number.isSafeInteger(input.version) || input.version < 0) return { error: 'invalid-recipe-version' };
  if(input.name!==undefined && (typeof input.name!=='string' || !input.name.trim() || input.name.trim().length>200))return {error:'invalid-name'};
  const name=input.name===undefined?{}:{name:input.name.trim()};
  if(input.name!==undefined && input.productionType===undefined && input.mealMoments===undefined && input.configuration==null)return {data:{householdId:input.householdId,version:input.version,...name}};
  if (!['none', 'batch_cooking', 'pasta', 'pastry', 'bread'].includes(input.productionType)
    && !/^custom-[a-z0-9_-]{1,33}$/.test(input.productionType??'')) return { error: 'invalid-production-type' };
  const moments = input.mealMoments;
  if (!Array.isArray(moments) || moments.length > 4 || moments.some(moment => !['breakfast', 'lunch', 'dinner', 'snack'].includes(moment)) || new Set(moments).size !== moments.length) return { error: 'invalid-meal-moments' };
  const configuration=input.configuration;
  if(configuration != null){
    if(!configuration || typeof configuration!=='object' || !['original','whole','separate','three'].includes(configuration.servingMode))return {error:'invalid-serving-parts'};
    if(!configuration.yield || !Number.isFinite(configuration.yield.amount) || configuration.yield.amount<=0 || configuration.yield.amount>100000 || !['portion','piece','slice','g','ml'].includes(configuration.yield.unitId))return {error:'invalid-yield'};
    if(!Array.isArray(configuration.lineParts) || configuration.lineParts.length>300 || configuration.lineParts.some(part=>!['main','vegetables','starch'].includes(part)))return {error:'invalid-serving-parts'};
    if(configuration.lineCookingFactors!==undefined){
      if(!Array.isArray(configuration.lineCookingFactors) || configuration.lineCookingFactors.length!==configuration.lineParts.length || configuration.lineCookingFactors.some(f=>!Number.isFinite(f)||f<=0||f>10))return {error:'invalid-cooking-factor'};
    }else for(const key of ['main','starch'])if(!Number.isFinite(configuration.cookingFactors?.[key]) || configuration.cookingFactors[key]<=0 || configuration.cookingFactors[key]>10)return {error:'invalid-cooking-factor'};
  }
  return { data: { householdId: input.householdId, version: input.version, productionType: input.productionType, mealMoments: moments, ...name, ...(configuration?{configuration}:{}) } };
}

export async function updateRecipeSettings(pool, id, data) {
  if(data.configuration){
    const ownership=await pool.query('SELECT id FROM recipes WHERE id=$1 AND household_id=$2 AND parent_recipe_id IS NULL',[id,data.householdId]);
    if(!ownership.rowCount)return null;
    const current=await readRecipe(pool,id);
    if(!current)return null;
    if(current.version!==data.version)return {error:'recipe-version-conflict'};
    const config=data.configuration;
    if(config.lineParts.length!==current.lines.length)return {error:'invalid-serving-parts'};
    // Reuse the complete editor's validation, stock/history protections and parent propagation.
    const outputUnits={...current.outputUnits};
    if(Object.hasOwn(outputUnits,config.yield.unitId))outputUnits[config.yield.unitId]=config.yield.amount;
    const checked=validateRecipeInput({...current,name:data.name??current.name,householdId:data.householdId,productionType:data.productionType,mealMoments:data.mealMoments,
      yield:config.yield,outputUnits,servingMode:config.servingMode,separateStarch:config.servingMode!=='original',cookingFactors:config.lineCookingFactors?{main:1,starch:1,vegetables:1}:{...config.cookingFactors,vegetables:1},
      lines:current.lines.map((line,index)=>({...line,cookingFactor:config.lineCookingFactors?(line.recipeId?1:config.lineCookingFactors[index]):line.cookingFactor,servingPart:['separate','three'].includes(config.servingMode)?config.lineParts[index]:'main'}))});
    if(checked.error)return checked;
    return updateRecipe(pool,id,checked.data,data.version);
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await lockHouseholdInventory(client, data.householdId);
    const current = await client.query('SELECT version, production_type FROM recipes WHERE id=$1 AND household_id=$2 AND parent_recipe_id IS NULL FOR UPDATE', [id, data.householdId]);
    if (!current.rowCount) { await client.query('ROLLBACK'); return null; }
    if (Number(current.rows[0].version) !== data.version) { await client.query('ROLLBACK'); return { error: 'recipe-version-conflict' }; }
    if (data.productionType!==undefined && current.rows[0].production_type !== data.productionType) {
      const prepared = await client.query(`WITH RECURSIVE parents(id) AS (
        SELECT $2::uuid UNION SELECT r.id FROM parents p JOIN recipe_lines l ON l.ingredient_recipe_id=p.id JOIN recipes r ON r.id=l.recipe_id WHERE r.household_id=$1
      ) SELECT 1 FROM planned_meals m JOIN planned_meal_items i ON i.meal_id=m.id
        JOIN recipes used ON used.id=i.recipe_id WHERE m.household_id=$1 AND m.prepared_at IS NOT NULL
        AND (used.id IN(SELECT id FROM parents) OR used.parent_recipe_id IN(SELECT id FROM parents)) LIMIT 1`,[data.householdId,id]);
      if (prepared.rowCount) { await client.query('ROLLBACK'); return { error: 'recipe-used-in-prepared-meal' }; }
    }
    await client.query(`UPDATE recipes SET production_type=COALESCE($2,production_type), meal_moments=COALESCE($3,meal_moments), version=version+1, updated_at=now()
      WHERE household_id=$4 AND (id=$1 OR parent_recipe_id=$1)`, [id, data.productionType??null, data.mealMoments??null, data.householdId]);
    if(data.name!==undefined){
      await client.query('UPDATE recipes SET name=$3 WHERE id=$1 AND household_id=$2',[id,data.householdId,data.name]);
      const parts=await client.query('SELECT serving_part FROM recipes WHERE parent_recipe_id=$1 AND household_id=$2',[id,data.householdId]);
      const keys=new Set(parts.rows.map(row=>row.serving_part));
      const labels={main:keys.has('vegetables')?'Viande / protéines':keys.has('starch')?'Viande et légumes':'Préparation entière',vegetables:'Légumes',starch:'Féculents'};
      for(const [part,label] of Object.entries(labels))await client.query('UPDATE recipes SET name=$3 WHERE parent_recipe_id=$1 AND household_id=$2 AND serving_part=$4',[id,data.householdId,`${data.name} — ${label}`,part]);
    }
    const recipe = await readRecipe(client, id);
    await client.query('COMMIT');
    return recipe;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

export async function createRecipe(pool, data) {
  const client = await pool.connect();
  const id = randomUUID();
  try {
    await client.query('BEGIN');
    await lockHouseholdInventory(client,data.householdId);
    await client.query(
      `INSERT INTO recipes (id, household_id, name, description, yield_amount, yield_unit_id, instructions, source_url, recipe_type, production_type, meal_moments,separate_starch,cooking_factors,output_units,minimum_production_amount,minimum_production_unit_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,$12,$13::jsonb,$14::jsonb,$15,$16)`,
      [id, data.householdId, data.name, data.description, data.yield.amount, data.yield.unitId, data.instructions, data.sourceUrl, data.recipeType, data.productionType, data.mealMoments,data.separateStarch ?? false,JSON.stringify(data.cookingFactors ?? {main:1,starch:3}),JSON.stringify(data.outputUnits??{}),data.minimumProductionAmount??0,data.minimumProductionUnitId??data.yield.unitId],
    );
    for (const [index, line] of data.lines.entries()) {
      await client.query(
        `INSERT INTO recipe_lines (id, recipe_id, food_id, quantity, unit_id, sort_order,serving_part,cooking_factor,ingredient_recipe_id)
         VALUES ($1, $2, $3, $4, $5, $6,$7,$8,$9)`,
        [randomUUID(), id, line.foodId, line.quantity, line.unitId, index,line.servingPart ?? 'main',line.cookingFactor ?? null,line.recipeId??null],
      );
    }
    validateRecipeGraph(await loadRecipeGraph(client,data.householdId));
    await syncServingParts(client,id,data);
    await syncRecipeParents(client,id,data.householdId);
    const recipe = await readRecipe(client, id);
    await client.query('COMMIT');
    return recipe;
  } catch (error) {
    await client.query('ROLLBACK');
    if ([...componentErrors,'serving-weight-conversion-required','invalid-serving-weight','serving-part-removal-not-supported','serving-parts-cannot-be-disabled'].includes(error.message)) return {error:error.message};
    if (error.code === '23503') return { error: 'unknown-household-food-or-unit' };
    throw error;
  } finally {
    client.release();
  }
}

export async function listRecipes(pool, householdId) {
  const result = await pool.query(
    `SELECT id FROM recipes WHERE household_id = $1 AND parent_recipe_id IS NULL ORDER BY name, created_at DESC`,
    [householdId],
  );
  return Promise.all(result.rows.map(({ id }) => readRecipe(pool, id)));
}

export async function updateRecipe(pool, id, data, expectedVersion=null) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await lockHouseholdInventory(client,data.householdId);
    if(expectedVersion!==null){
      const found=await client.query('SELECT version FROM recipes WHERE id=$1 AND household_id=$2 AND parent_recipe_id IS NULL FOR UPDATE',[id,data.householdId]);
      if(!found.rowCount){await client.query('ROLLBACK');return null;}
      if(Number(found.rows[0].version)!==expectedVersion){await client.query('ROLLBACK');return {error:'recipe-version-conflict'};}
    }
    if(data.lines.some(line=>line.recipeId===id))throw new Error('recipe-ingredient-cycle');
    const prepared=await client.query(`WITH RECURSIVE parents(id) AS (
      SELECT $2::uuid UNION SELECT r.id FROM parents p JOIN recipe_lines l ON l.ingredient_recipe_id=p.id JOIN recipes r ON r.id=l.recipe_id WHERE r.household_id=$1
    ) SELECT 1 FROM planned_meals m JOIN planned_meal_items i ON i.meal_id=m.id
      JOIN recipes used ON used.id=i.recipe_id WHERE m.household_id=$1 AND m.prepared_at IS NOT NULL
      AND (used.id IN(SELECT id FROM parents) OR used.parent_recipe_id IN(SELECT id FROM parents)) LIMIT 1`,[data.householdId,id]);
    if(prepared.rowCount){await client.query('ROLLBACK');return {error:'recipe-used-in-prepared-meal'};}
    const previous=await client.query('SELECT yield_unit_id,separate_starch,serving_weights FROM recipes WHERE id=$1 AND household_id=$2',[id,data.householdId]);
    const old=previous.rows[0];
    const keys=data.separateStarch?[...new Set(data.lines.map(line=>line.servingPart??'main'))].sort().join(','):'';
    const oldKeys=old?.separate_starch?Object.keys(old.serving_weights??{}).sort().join(','):'';
    if(old && (old.yield_unit_id!==data.yield.unitId || oldKeys!==keys)){
      const history=await client.query(`SELECT 1 FROM recipe_stock_uses u JOIN recipes r ON r.id=u.recipe_id
        WHERE u.household_id=$1 AND (r.id=$2 OR r.parent_recipe_id=$2)
        UNION ALL SELECT 1 FROM stock_lots s JOIN recipes r ON r.id=s.recipe_id
        WHERE s.household_id=$1 AND (r.id=$2 OR r.parent_recipe_id=$2) AND $3::boolean LIMIT 1`,[data.householdId,id,old.yield_unit_id!==data.yield.unitId]);
      if(history.rowCount){await client.query('ROLLBACK');return {error:'recipe-output-in-use'};}
    }
    if (!data.separateStarch) await restoreOriginalServingMode(client,id);
    const updated = await client.query(
      `UPDATE recipes SET name = $3, description = $4, yield_amount = $5,
              yield_unit_id = $6, instructions = $7, source_url = $8, recipe_type = $9, production_type = $10, meal_moments = $11,separate_starch=$12,serving_weights=CASE WHEN $12 THEN serving_weights ELSE '{}'::jsonb END,cooking_factors=$13::jsonb,output_units=$14::jsonb,minimum_production_amount=$15,minimum_production_unit_id=$16, version = version + 1, updated_at = now()
        WHERE id = $1 AND household_id = $2 AND parent_recipe_id IS NULL RETURNING id`,
      [id, data.householdId, data.name, data.description, data.yield.amount, data.yield.unitId, data.instructions, data.sourceUrl, data.recipeType, data.productionType, data.mealMoments,data.separateStarch ?? false,JSON.stringify(data.cookingFactors ?? {main:1,starch:3}),JSON.stringify(data.outputUnits??{}),data.minimumProductionAmount??0,data.minimumProductionUnitId??data.yield.unitId],
    );
    if (!updated.rowCount) {
      await client.query('ROLLBACK');
      return null;
    }
    await client.query('DELETE FROM recipe_lines WHERE recipe_id = $1', [id]);
    for (const [index, line] of data.lines.entries()) {
      await client.query(
        `INSERT INTO recipe_lines (id, recipe_id, food_id, quantity, unit_id, sort_order,serving_part,cooking_factor,ingredient_recipe_id)
         VALUES ($1, $2, $3, $4, $5, $6,$7,$8,$9)`,
        [randomUUID(), id, line.foodId, line.quantity, line.unitId, index,line.servingPart ?? 'main',line.cookingFactor ?? null,line.recipeId??null],
      );
    }
    validateRecipeGraph(await loadRecipeGraph(client,data.householdId));
    await syncServingParts(client,id,data);
    await syncRecipeParents(client,id,data.householdId);
    const recipe = await readRecipe(client, id);
    await client.query('COMMIT');
    return recipe;
  } catch (error) {
    await client.query('ROLLBACK');
    if ([...componentErrors,'serving-weight-conversion-required','invalid-serving-weight','serving-part-removal-not-supported','serving-parts-cannot-be-disabled'].includes(error.message)) return {error:error.message};
    if (error.code === '23503') return { error: 'unknown-household-food-or-unit' };
    throw error;
  } finally {
    client.release();
  }
}

export async function readRecipe(client, id, path=[]) {
  if(path.includes(id))throw new Error('recipe-ingredient-cycle');
  const recipeResult = await client.query(
    `SELECT id, household_id,output_units, name, description, yield_amount, yield_unit_id, instructions, source_url, recipe_type, production_type,minimum_production_amount,minimum_production_unit_id, meal_moments,separate_starch,serving_weights,cooking_factors,parent_recipe_id,serving_part,version,
            EXISTS (SELECT 1 FROM recipe_images WHERE recipe_id=recipes.id) AS image_available,
            (SELECT count(*) FROM recipes siblings WHERE siblings.parent_recipe_id=recipes.parent_recipe_id) AS sibling_count
       FROM recipes WHERE id = $1`, [id],
  );
  const row = recipeResult.rows[0];
  if (!row) return null;
  const linesResult = await client.query(
    `SELECT id, food_id, ingredient_recipe_id, quantity, unit_id, sort_order,serving_part,cooking_factor FROM recipe_lines
      WHERE recipe_id = $1 ORDER BY sort_order`, [id],
  );
  const lines = linesResult.rows.map((line) => ({
    id: line.id, foodId: line.food_id, recipeId:line.ingredient_recipe_id??null, quantity: Number(line.quantity), unitId: line.unit_id,
    componentId: null, variantId: null, servingPart: line.serving_part ?? 'main', cookingFactor: line.cooking_factor == null ? null : Number(line.cooking_factor),
  }));
  const foodIds = [...new Set(lines.map((line) => line.foodId))];
  const foodsResult = foodIds.length ? await client.query(
    `SELECT f.id, f.canonical_name AS name, f.brand, f.source, f.source_reference,
            f.source_note, f.grams_per_millilitre,
            jsonb_object_agg(n.id, fn.value_per_100g ORDER BY n.sort_order)
              FILTER (WHERE n.id IS NOT NULL) AS nutrient_values,
            COALESCE((SELECT jsonb_object_agg(c.unit_id, c.grams_per_unit)
                        FROM food_unit_conversions c WHERE c.food_id = f.id), '{}'::jsonb) AS grams_per_unit
       FROM foods f
       LEFT JOIN food_nutrients fn ON fn.food_id = f.id
       LEFT JOIN nutrients n ON n.id = fn.nutrient_id
      WHERE f.id = ANY($1::uuid[])
      GROUP BY f.id`, [foodIds],
  ) : { rows: [] };
  const nutrients = {
    energy_kcal: 'energyKcal', protein_g: 'proteinG', carbohydrate_g: 'carbohydrateG',
    fat_g: 'fatG', fibre_g: 'fibreG',
  };
  const foods = foodsResult.rows.map((food) => {
    const values = food.nutrient_values ?? {};
    const nutrientsPer100g = Object.fromEntries(Object.entries(nutrients).map(([dbKey, key]) => [key, values[dbKey] == null ? null : Number(values[dbKey])]));
    return {
      id: food.id, name: food.name, aliases: [], brand: food.brand, source: food.source,
      sourceReference: food.source_reference, nutrientsPer100g,
      gramsPerUnit: Object.fromEntries(Object.entries(food.grams_per_unit ?? {}).map(([key, value]) => [key, Number(value)])),
      gramsPerMillilitre: food.grams_per_millilitre == null ? null : Number(food.grams_per_millilitre),
    };
  });
  const nutritionLines=lines.map(line=>({...line}));
  const graph=lines.some(line=>line.recipeId)?await loadRecipeGraph(client,row.household_id):null;
  for(const [index,line] of lines.entries())if(line.recipeId){
    const component=await readRecipe(client,line.recipeId,[...path,id]);
    const fraction=recipeFraction(graph,line.recipeId,line.quantity,line.unitId);
    line.foodName=component.name;line.recipeName=component.name;
    foods.push({id:line.recipeId,name:component.name,nutrientsPer100g:component.nutrition.batch,gramsPerUnit:{}});
    nutritionLines[index]={...line,foodId:line.recipeId,quantity:fraction*100,unitId:'g'};
    if(!component.nutrition.complete)line.componentIncomplete=true;
  }
  const nutrition = calculateRecipeNutrition(nutritionLines, foods, Number(row.yield_amount));
  for(const [index,line] of lines.entries())if(line.componentIncomplete){
    nutrition.complete=false;
    if(!nutrition.lineIssues.some(issue=>issue.lineIndex===index))nutrition.lineIssues.push({lineIndex:index,reason:'component-data-missing',missingNutrients:[]});
  }
  if (row.parent_recipe_id) nutrition.perYieldUnit = Object.fromEntries(Object.entries(nutrition.batch).map(([key,value]) => [key,value == null ? null : value / Number(row.yield_amount)]));
  const foodById = new Map(foods.map((food) => [food.id, food]));
  const servingParts = [];
  if (row.separate_starch) {
    const children = await client.query('SELECT id FROM recipes WHERE parent_recipe_id=$1 ORDER BY serving_part', [id]);
    for (const child of children.rows) servingParts.push(await readRecipe(client,child.id,[...path,id]));
  }
  const counted=Number(row.sibling_count)>1 && row.yield_unit_id==='g' && lines.length===1 && ['piece','slice'].includes(lines[0].unitId) ? lines[0] : null;
  const servingDisplay=counted?{unitId:counted.unitId,amount:counted.quantity,gramsPerUnit:Number(row.yield_amount)/counted.quantity,
    ingredientName:counted.foodName??foodById.get(counted.foodId)?.name??null}:null;
  return {
    servingDisplay,
    separateStarch:row.separate_starch ?? false,servingWeights:row.serving_weights ?? {},cookingFactors:row.cooking_factors ?? {main:1,starch:3},parentRecipeId:row.parent_recipe_id ?? null,servingPart:row.serving_part ?? null,servingParts,imageAvailable:Boolean(row.image_available),
    id: row.id, version: Number(row.version ?? 0), name: row.name, description: row.description, instructions: row.instructions ?? '', sourceUrl: row.source_url ?? null,
    recipeType: row.recipe_type ?? 'dish', productionType: row.production_type ?? 'none', mealMoments: row.meal_moments ?? [],
    outputUnits:row.output_units??{},minimumProductionAmount:Number(row.minimum_production_amount??0),minimumProductionUnitId:row.minimum_production_unit_id??row.yield_unit_id,
    yield: { amount: Number(row.yield_amount), unitId: row.yield_unit_id },
    lines: lines.map((line, index) => ({ ...line, foodName: line.foodName??foodById.get(line.foodId)?.name ?? null, resolved: !nutrition.unresolvedLineIndexes.includes(index) })),
    nutrition,
  };
}

function isUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

async function syncRecipeParents(client,id,householdId,path=[]) {
  if(path.includes(id))throw new Error('recipe-ingredient-cycle');
  const parents=await client.query('SELECT DISTINCT r.id FROM recipe_lines l JOIN recipes r ON r.id=l.recipe_id WHERE l.ingredient_recipe_id=$1 AND r.household_id=$2 AND r.parent_recipe_id IS NULL',[id,householdId]);
  for(const parent of parents.rows){
    const recipe=await readRecipe(client,parent.id);
    await syncServingParts(client,parent.id,{...recipe,householdId});
    await client.query('UPDATE recipes SET version=version+1,updated_at=now() WHERE id=$1',[parent.id]);
    await syncRecipeParents(client,parent.id,householdId,[...path,id]);
  }
}
