import { randomUUID } from 'node:crypto';
import {readRecipe} from './recipes.mjs';
import {syncServingParts} from './serving-parts.mjs';

const nutrientIds = {
  energyKcal: 'energy_kcal',
  proteinG: 'protein_g',
  carbohydrateG: 'carbohydrate_g',
  fatG: 'fat_g',
  fibreG: 'fibre_g',
};

export async function listFoodRecipeUsage(pool, householdId, foodIds) {
  if (!foodIds.length) return [];
  const result = await pool.query(
    `SELECT DISTINCT rl.food_id, COALESCE(parent.id,r.id) AS id,
                     COALESCE(parent.name,r.name) AS name
       FROM recipe_lines rl
       JOIN recipes r ON r.id=rl.recipe_id
       LEFT JOIN recipes parent ON parent.id=r.parent_recipe_id AND parent.household_id=r.household_id
      WHERE r.household_id=$1 AND rl.food_id=ANY($2::uuid[])
      ORDER BY name,id,rl.food_id`,
    [householdId, foodIds],
  );
  const recipesByFood = new Map(foodIds.map(id => [id, []]));
  for (const { food_id, id, name } of result.rows) recipesByFood.get(food_id).push({ id, name });
  return [...recipesByFood].map(([foodId, recipes]) => ({ foodId, recipes }));
}

export async function listCookingFactorConflicts(pool, householdId) {
  const result=await pool.query(`SELECT f.id AS food_id,f.canonical_name AS food_name,
      r.id AS recipe_id,r.name AS recipe_name,
      COALESCE(l.cooking_factor,(r.cooking_factors ->> COALESCE(l.serving_part,'main'))::numeric,1) AS factor
    FROM recipe_lines l JOIN recipes r ON r.id=l.recipe_id
    JOIN foods f ON f.id=l.food_id
    WHERE r.household_id=$1 AND r.parent_recipe_id IS NULL AND r.separate_starch
      AND f.cooking_factor IS NULL
    ORDER BY f.canonical_name,r.name,r.id`,[householdId]);
  const groups=new Map();
  for(const row of result.rows){
    if(!groups.has(row.food_id))groups.set(row.food_id,{foodId:row.food_id,foodName:row.food_name,recipes:[],factors:new Set()});
    const group=groups.get(row.food_id),factor=Number(row.factor);
    group.factors.add(factor);group.recipes.push({id:row.recipe_id,name:row.recipe_name,factor});
  }
  return [...groups.values()].filter(group=>group.factors.size>1).map(({factors,...group})=>({...group,factors:[...factors].sort((a,b)=>a-b)}));
}

const bulkFoodFields = {
  foodCategory: { column: 'food_category', kind: 'text' },
  cookingFactor: { column: 'cooking_factor', max: 10 },
  gramsPerMillilitre: { column: 'grams_per_millilitre', max: 100 },
  tspGrams: { unit: 'tsp', max: 100000 },
  tbspGrams: { unit: 'tbsp', max: 100000 },
  pinchGrams: { unit: 'pinch', max: 100000 },
  scoopGrams: { unit: 'scoop', max: 100000 },
  pieceGrams: { unit: 'piece', max: 100000 },
  energyKcal: { nutrient: 'energy_kcal', max: 100000 },
  proteinG: { nutrient: 'protein_g', max: 100000 },
  carbohydrateG: { nutrient: 'carbohydrate_g', max: 100000 },
  fatG: { nutrient: 'fat_g', max: 100000 },
  fibreG: { nutrient: 'fibre_g', max: 100000 },
};

export function validateBulkFoodEdit(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'invalid-bulk-edit' };
  const field = bulkFoodFields[input.field];
  if (!field || !Array.isArray(input.changes) || input.changes.length < 1 || input.changes.length > 250 ||
      typeof input.dryRun !== 'boolean' || typeof input.overwrite !== 'boolean' ||
      typeof input.sourceNote !== 'string' || !input.sourceNote.trim() || input.sourceNote.length > 500) return { error: 'invalid-bulk-edit' };
  const ids = new Set();
  const changes = [];
  for (const item of input.changes) {
    if (!item || typeof item.foodId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.foodId) ||
        !Number.isInteger(item.version) || item.version < 1 || ids.has(item.foodId.toLowerCase())) return { error: 'invalid-bulk-edit' };
    ids.add(item.foodId.toLowerCase());
    const value = field.kind === 'text' ? (typeof item.value === 'string' ? item.value.trim() : null) : item.value;
    if (field.kind === 'text' ? !value || value.length > 80 : typeof value !== 'number' || !Number.isFinite(value) || value < (field.nutrient ? 0 : 0.000001) || value > field.max) return { error: 'invalid-bulk-value' };
    changes.push({ foodId: item.foodId, version: item.version, value });
  }
  return { data: { field: input.field, definition: field, changes, dryRun: input.dryRun, overwrite: input.overwrite, sourceNote: input.sourceNote.trim() } };
}

export async function bulkEditFoods(pool, input) {
  const { definition, changes, dryRun, overwrite, sourceNote } = input;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ids = changes.map(item => item.foodId);
    const found = await client.query('SELECT id,canonical_name AS name,version,food_category,cooking_factor,grams_per_millilitre FROM foods WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE', [ids]);
    const byId = new Map(found.rows.map(row => [row.id, row]));
    const preview = [];
    for (const item of changes) {
      const row = byId.get(item.foodId);
      let current = null;
      if (row) {
        if (definition.column) current = row[definition.column];
        else if (definition.unit) current = (await client.query('SELECT grams_per_unit AS value FROM food_unit_conversions WHERE food_id=$1 AND unit_id=$2', [item.foodId, definition.unit])).rows[0]?.value ?? null;
        else current = (await client.query('SELECT value_per_100g AS value FROM food_nutrients WHERE food_id=$1 AND nutrient_id=$2', [item.foodId, definition.nutrient])).rows[0]?.value ?? null;
      }
      const same = current != null && (definition.kind === 'text' ? current === item.value : Number(current) === item.value);
      const conflict = !row ? 'absent' : Number(row.version) !== item.version ? 'version-changed' : current != null && !same && !overwrite ? 'existing-value' : null;
      preview.push({ foodId: item.foodId, name: row?.name ?? null, version: row?.version ?? null, current: current == null ? null : definition.kind === 'text' ? current : Number(current), proposed: item.value, conflict });
    }
    if (dryRun || preview.some(item => item.conflict)) { await client.query('ROLLBACK'); return { preview, applied: 0, conflictCount: preview.filter(item => item.conflict).length }; }
    for (const item of preview) {
      if (String(item.current) === String(item.proposed)) continue;
      const before = await getFood(client, item.foodId);
      if (definition.column) await client.query(`UPDATE foods SET ${definition.column}=$2,source_note=concat_ws(E'\\n',NULLIF(source_note,''),$3::text),manual_override=true,version=version+1,updated_at=now() WHERE id=$1`, [item.foodId, item.proposed, sourceNote]);
      else if (definition.unit) await client.query(`INSERT INTO food_unit_conversions(food_id,unit_id,grams_per_unit,source_note) VALUES($1,$2,$3,$4) ON CONFLICT(food_id,unit_id) DO UPDATE SET grams_per_unit=EXCLUDED.grams_per_unit,source_note=EXCLUDED.source_note`, [item.foodId, definition.unit, item.proposed, sourceNote]);
      else await client.query(`INSERT INTO food_nutrients(food_id,nutrient_id,value_per_100g,source_note) VALUES($1,$2,$3,$4) ON CONFLICT(food_id,nutrient_id) DO UPDATE SET value_per_100g=EXCLUDED.value_per_100g,source_note=EXCLUDED.source_note`, [item.foodId, definition.nutrient, item.proposed, sourceNote]);
      if (!definition.column) await client.query('UPDATE foods SET manual_override=true,version=version+1,updated_at=now() WHERE id=$1', [item.foodId]);
      if (input.field === 'cookingFactor') {
        const affected = await client.query(`WITH RECURSIVE affected(id,depth) AS (
          SELECT DISTINCT r.id,0 FROM recipe_lines l JOIN recipes r ON r.id=l.recipe_id WHERE l.food_id=$1 AND r.parent_recipe_id IS NULL
          UNION ALL SELECT r.id,a.depth+1 FROM affected a JOIN recipe_lines l ON l.ingredient_recipe_id=a.id JOIN recipes r ON r.id=l.recipe_id WHERE r.parent_recipe_id IS NULL
        ) SELECT id FROM affected GROUP BY id ORDER BY max(depth),id`, [item.foodId]);
        for (const row of affected.rows) {
          const recipe = await readRecipe(client, row.id);
          if (!recipe?.separateStarch) continue;
          await syncServingParts(client, row.id, { ...recipe, householdId: recipe.householdId ?? (await client.query('SELECT household_id FROM recipes WHERE id=$1', [row.id])).rows[0].household_id });
          await client.query('UPDATE recipes SET version=version+1,updated_at=now() WHERE id=$1', [row.id]);
        }
      }
      const after = await getFood(client, item.foodId);
      await client.query('INSERT INTO food_change_log(id,food_id,reason,before_state,after_state) VALUES($1,$2,$3,$4::jsonb,$5::jsonb)', [randomUUID(), item.foodId, `Modification groupée : ${sourceNote}`, JSON.stringify(before), JSON.stringify(after)]);
    }
    await client.query('COMMIT');
    return { preview, applied: preview.filter(item => String(item.current) !== String(item.proposed)).length, conflictCount: 0 };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

export function validateFoodInput(input, { creating = false } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'invalid-body' };
  const data = {};
  if (creating || Object.hasOwn(input, 'name')) {
    if (typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 200) return { error: 'invalid-name' };
    data.name = input.name.trim();
  }
  for (const key of ['brand', 'sourceNote']) {
    if (!creating && !Object.hasOwn(input, key)) continue;
    const value = input[key] ?? null;
    if (value !== null && (typeof value !== 'string' || value.length > 500)) return { error: `invalid-${key}` };
    data[key] = value?.trim() || null;
  }
  if (creating || Object.hasOwn(input, 'nutrientSourceNote')) {
    const value = input.nutrientSourceNote ?? null;
    if (value !== null && (typeof value !== 'string' || value.length > 500)) return { error: 'invalid-nutrientSourceNote' };
    data.nutrientSourceNote = value?.trim() || null;
  }
  if (creating || Object.hasOwn(input, 'nutrientsPer100g')) {
    const values = input.nutrientsPer100g;
    if (!values || typeof values !== 'object' || Array.isArray(values)) return { error: 'invalid-nutrients' };
    data.nutrients = {};
    for (const key of Object.keys(nutrientIds)) {
      const value = values[key] ?? null;
      if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100000)) return { error: `invalid-${key}` };
      data.nutrients[key] = value;
    }
  }
  if (creating || Object.hasOwn(input, 'gramsPerMillilitre')) {
    const value = input.gramsPerMillilitre ?? null;
    if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 100)) return { error: 'invalid-density' };
    data.gramsPerMillilitre = value;
  }
  if (creating || Object.hasOwn(input, 'cookingFactor')) {
    const value=input.cookingFactor??null;
    if(value!==null && (typeof value!=='number'||!Number.isFinite(value)||value<=0||value>10))return {error:'invalid-cooking-factor'};
    data.cookingFactor=value;
  }
  if (creating || Object.hasOwn(input, 'foodCategory')) {
    const value = input.foodCategory ?? null;
    if (value !== null && (typeof value !== 'string' || value.trim().length > 80)) return { error: 'invalid-food-category' };
    data.foodCategory = value?.trim() || null;
  }
  if (creating || Object.hasOwn(input, 'gramsPerUnit')) {
    const units = input.gramsPerUnit ?? {};
    if (!units || typeof units !== 'object' || Array.isArray(units)) return { error: 'invalid-unit-conversions' };
    data.gramsPerUnit = {};
    for (const [unit, value] of Object.entries(units)) {
      if (!/^[a-z][a-z0-9_-]{0,30}$/.test(unit) || typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 100000) return { error: 'invalid-unit-conversions' };
      data.gramsPerUnit[unit] = value;
    }
  }
  if (creating || Object.hasOwn(input, 'aliases')) {
    const aliases = input.aliases ?? [];
    if (!Array.isArray(aliases) || aliases.some((alias) => typeof alias !== 'string' || !alias.trim() || alias.length > 200)) return { error: 'invalid-aliases' };
    data.aliases = [...new Set(aliases.map((alias) => alias.trim()))];
  }
  if (Object.keys(data).length === 0) return { error: 'empty-update' };
  return { data };
}

export async function createFood(pool, data) {
  const client = await pool.connect();
  const id = randomUUID();
  try {
    await client.query('BEGIN');
    const duplicate = await findDuplicate(client, data.name, data.brand, null);
    if (duplicate.length) {
      await client.query('ROLLBACK');
      return { error: 'possible-duplicate', matches: duplicate };
    }
    await client.query(
      `INSERT INTO foods (id, canonical_name, brand, source, source_note, grams_per_millilitre,cooking_factor,food_category)
       VALUES ($1, $2, $3, 'manual', $4, $5,$6,$7)`,
      [id, data.name, data.brand, data.sourceNote, data.gramsPerMillilitre,data.cookingFactor,data.foodCategory],
    );
    await writeNutrients(client, id, data.nutrients, data.nutrientSourceNote ?? 'Saisie manuelle');
    for (const [unit, grams] of Object.entries(data.gramsPerUnit)) {
      await client.query(
        `INSERT INTO food_unit_conversions (food_id, unit_id, grams_per_unit, source_note)
         VALUES ($1, $2, $3, 'Saisie manuelle')`, [id, unit, grams],
      );
    }
    await writeAliases(client, id, data.name, data.aliases);
    const food = await getFood(client, id);
    await client.query('COMMIT');
    return food;
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23503') return { error: 'unknown-unit' };
    throw error;
  } finally {
    client.release();
  }
}

export async function updateFood(pool, id, data) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM foods WHERE id = $1 FOR UPDATE', [id]);
    const before = await getFood(client, id);
    if (!before) {
      await client.query('ROLLBACK');
      return null;
    }
    const afterState = {
      ...before,
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.brand !== undefined ? { brand: data.brand } : {}),
      ...(data.sourceNote !== undefined ? { sourceNote: data.sourceNote } : {}),
      ...(data.gramsPerMillilitre !== undefined ? { gramsPerMillilitre: data.gramsPerMillilitre } : {}),
      ...(data.cookingFactor !== undefined ? { cookingFactor: data.cookingFactor } : {}),
      ...(data.foodCategory !== undefined ? { foodCategory: data.foodCategory } : {}),
      ...(data.nutrients !== undefined ? { nutrientsPer100g: data.nutrients } : {}),
    };
    const duplicate = await findDuplicate(client, afterState.name, afterState.brand, id);
    if (duplicate.length) {
      await client.query('ROLLBACK');
      return { error: 'possible-duplicate', matches: duplicate };
    }
    await client.query(
      `UPDATE foods SET canonical_name = $2, brand = $3, source_note = $4,
              grams_per_millilitre = $5, cooking_factor=$6, food_category=$7, manual_override = true,
              version = version + 1, updated_at = now()
        WHERE id = $1`,
      [id, afterState.name, afterState.brand, afterState.sourceNote, afterState.gramsPerMillilitre,afterState.cookingFactor,afterState.foodCategory],
    );
    if (data.nutrients !== undefined) await writeNutrients(client, id, data.nutrients, 'Correction manuelle');
    if (data.gramsPerUnit !== undefined) {
      await client.query('DELETE FROM food_unit_conversions WHERE food_id = $1', [id]);
      for (const [unit, grams] of Object.entries(data.gramsPerUnit)) {
        await client.query(
          `INSERT INTO food_unit_conversions (food_id, unit_id, grams_per_unit, source_note)
           VALUES ($1, $2, $3, 'Saisie manuelle')`, [id, unit, grams],
        );
      }
    }
    if (data.name !== undefined || data.aliases !== undefined) {
      await writeAliases(client, id, afterState.name, data.aliases ?? []);
    }
    if(data.cookingFactor!==undefined && data.cookingFactor!==before.cookingFactor){
      const affected=await client.query(`WITH RECURSIVE affected(id,depth) AS (
        SELECT DISTINCT r.id,0 FROM recipe_lines l JOIN recipes r ON r.id=l.recipe_id
          WHERE l.food_id=$1 AND r.parent_recipe_id IS NULL
        UNION ALL
        SELECT r.id,a.depth+1 FROM affected a JOIN recipe_lines l ON l.ingredient_recipe_id=a.id
          JOIN recipes r ON r.id=l.recipe_id WHERE r.parent_recipe_id IS NULL
      ) SELECT id FROM affected GROUP BY id ORDER BY max(depth),id`,[id]);
      for(const row of affected.rows){
        const recipe=await readRecipe(client,row.id);
        if(!recipe?.separateStarch)continue;
        await syncServingParts(client,row.id,{...recipe,householdId:recipe.householdId??(await client.query('SELECT household_id FROM recipes WHERE id=$1',[row.id])).rows[0].household_id});
        await client.query('UPDATE recipes SET version=version+1,updated_at=now() WHERE id=$1',[row.id]);
      }
    }
    const after = await getFood(client, id);
    await client.query(
      `INSERT INTO food_change_log (id, food_id, reason, before_state, after_state)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)`,
      [randomUUID(), id, 'Modification du catalogue', JSON.stringify(before), JSON.stringify(after)],
    );
    await client.query('COMMIT');
    return after;
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23503') return { error: 'unknown-unit' };
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteFood(pool, id) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const found = await client.query('SELECT id FROM foods WHERE id=$1 FOR UPDATE', [id]);
    if (!found.rows.length) { await client.query('ROLLBACK'); return null; }
    const references = await client.query(
      `SELECT count(DISTINCT r.id)::integer AS recipe_count,
              COALESCE(array_agg(DISTINCT r.name) FILTER (WHERE r.id IS NOT NULL), '{}') AS recipe_names,
              (SELECT count(*)::integer FROM household_ingredient_stock WHERE food_id=$1) AS stock_count
         FROM recipe_lines rl JOIN recipes r ON r.id=rl.recipe_id WHERE rl.food_id=$1`, [id],
    );
    const refs = references.rows[0];
    if (refs.recipe_count || refs.stock_count) {
      await client.query('ROLLBACK');
      return { error: 'food-in-use', recipes: refs.recipe_names, stockCount: refs.stock_count };
    }
    await client.query('DELETE FROM foods WHERE id=$1', [id]);
    await client.query('COMMIT');
    return { deleted: true };
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23503') return { error: 'food-in-use', recipes: [], stockCount: 0 };
    throw error;
  } finally { client.release(); }
}

export async function deleteFoods(pool, foodIds, {dryRun=false}={}) {
  const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  if(!Array.isArray(foodIds)||!foodIds.length||foodIds.length>5000||foodIds.some(id=>!uuid(id)))return{error:'invalid-food-ids'};
  const ids=[...new Set(foodIds.map(id=>id.toLowerCase()))];
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const foods=await client.query('SELECT id,canonical_name FROM foods WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[ids]);
    const foundIds=foods.rows.map(row=>row.id);
    const usage=foundIds.length?await client.query(`SELECT f.id,
        COALESCE((SELECT array_agg(DISTINCT r.name ORDER BY r.name) FROM recipe_lines rl JOIN recipes r ON r.id=rl.recipe_id WHERE rl.food_id=f.id),'{}') AS recipes,
        (SELECT count(*)::integer FROM household_ingredient_stock s WHERE s.food_id=f.id) AS stock_count,
        (SELECT count(*)::integer FROM household_purchase_products p WHERE p.food_id=f.id OR p.purchase_food_id=f.id) AS purchase_rule_count,
        (SELECT count(*)::integer FROM household_food_yield_conversions c WHERE c.source_food_id=f.id OR c.target_food_id=f.id) AS yield_conversion_count
      FROM foods f WHERE f.id=ANY($1::uuid[])`,[foundIds]):{rows:[]};
    const usageById=new Map(usage.rows.map(row=>[row.id,row]));
    const deletable=[],blocked=[];
    for(const food of foods.rows){
      const refs=usageById.get(food.id),recipes=refs?.recipes??[],stockCount=Number(refs?.stock_count??0),purchaseRuleCount=Number(refs?.purchase_rule_count??0),yieldConversionCount=Number(refs?.yield_conversion_count??0);
      if(recipes.length||stockCount||purchaseRuleCount||yieldConversionCount)blocked.push({id:food.id,name:food.canonical_name,recipes,stockCount,purchaseRuleCount,yieldConversionCount});
      else deletable.push({id:food.id,name:food.canonical_name});
    }
    const missingCount=ids.length-foods.rows.length;
    let deleted=[];
    if(!dryRun&&deletable.length){
      const result=await client.query('DELETE FROM foods WHERE id=ANY($1::uuid[]) RETURNING id',[deletable.map(food=>food.id)]);
      deleted=result.rows.map(row=>row.id);
      if(deleted.length!==deletable.length)throw new Error('bulk-food-delete-incomplete');
    }
    await client.query('COMMIT');
    return{deletable,dueToUsage:blocked,missingCount,deleted};
  }catch(error){
    await client.query('ROLLBACK');
    if(error.code==='23503')return{error:'food-in-use',deleted:[]};
    throw error;
  }finally{client.release();}
}

export async function fillMissingNutritionFromExternal(pool, foodId, product) {
  if (!product || !/^\d{8,14}$/.test(product.barcode ?? '') || !product.url?.startsWith('https://world.openfoodfacts.org/product/')) {
    return { error: 'invalid-nutrition-source' };
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM foods WHERE id = $1 FOR UPDATE', [foodId]);
    const before = await getFood(client, foodId);
    if (!before) {
      await client.query('ROLLBACK');
      return null;
    }
    const note = `Open Food Facts : ${product.name}${product.brand ? ` — ${product.brand}` : ''} (${product.url})`;
    const nutrientFields = [
      ['energyKcal', 'energy_kcal'], ['proteinG', 'protein_g'], ['carbohydrateG', 'carbohydrate_g'],
      ['fatG', 'fat_g'], ['fibreG', 'fibre_g'],
    ];
    const filledNutrients = [];
    for (const [key, nutrientId] of nutrientFields) {
      const value = product.nutrientsPer100g?.[key];
      if (value === null || value === undefined || !Number.isFinite(value) || value < 0 || value > 100000) continue;
      const result = await client.query(
        `INSERT INTO food_nutrients (food_id, nutrient_id, value_per_100g, source_note)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (food_id, nutrient_id) DO UPDATE
           SET value_per_100g = EXCLUDED.value_per_100g, source_note = EXCLUDED.source_note
           WHERE food_nutrients.value_per_100g IS NULL
         RETURNING nutrient_id`,
        [foodId, nutrientId, value, note],
      );
      if (result.rows.length) filledNutrients.push(nutrientId);
    }
    if (filledNutrients.length) {
      await client.query(
        `UPDATE foods SET source_note = concat_ws(E'\\n', NULLIF(source_note, ''), $2),
                manual_override = true, version = version + 1, updated_at = now()
          WHERE id = $1`, [foodId, note],
      );
    }
    const food = await getFood(client, foodId);
    if (filledNutrients.length) {
      await client.query(
        `INSERT INTO food_change_log (id, food_id, reason, before_state, after_state)
         VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)`,
        [randomUUID(), foodId, 'Complément nutritionnel externe', JSON.stringify(before), JSON.stringify(food)],
      );
    }
    await client.query('COMMIT');
    return { food, filledNutrients, sourceName: 'Open Food Facts', sourceReference: product.barcode };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function findDuplicate(client, name, brand, excludingId) {
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${normalizeSearch(name)}:${(brand ?? '').toLocaleLowerCase('fr-FR')}`]);
  const result = await client.query(
    `SELECT DISTINCT f.id, f.canonical_name AS name, f.brand, f.source
       FROM foods f
       JOIN food_aliases a ON a.food_id = f.id AND a.alias = f.canonical_name
      WHERE a.normalized_alias = $1
        AND lower(COALESCE(f.brand, '')) = lower(COALESCE($2, ''))
        AND ($3::uuid IS NULL OR f.id <> $3)
      ORDER BY f.canonical_name LIMIT 5`,
    [normalizeSearch(name), brand, excludingId],
  );
  return result.rows;
}

async function writeNutrients(client, foodId, nutrients, note) {
  for (const [key, id] of Object.entries(nutrientIds)) {
    await client.query(
      `INSERT INTO food_nutrients (food_id, nutrient_id, value_per_100g, source_note)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (food_id, nutrient_id) DO UPDATE
         SET source_note = CASE WHEN food_nutrients.value_per_100g IS DISTINCT FROM EXCLUDED.value_per_100g
                                THEN EXCLUDED.source_note ELSE food_nutrients.source_note END,
             value_per_100g = EXCLUDED.value_per_100g`,
      [foodId, id, nutrients[key], note],
    );
  }
}

async function writeAliases(client, foodId, name, aliases) {
  for (const alias of [...aliases, name]) {
    const normalized = normalizeSearch(alias);
    if (!normalized) continue;
    await client.query(
      `INSERT INTO food_aliases (id, food_id, alias, normalized_alias, source)
       VALUES ($1, $2, $3, $4, 'manual')
       ON CONFLICT (food_id, normalized_alias) DO UPDATE SET alias = EXCLUDED.alias`,
      [randomUUID(), foodId, alias, normalized],
    );
  }
}

export async function getFood(client, id) {
  const result = await client.query(
    `SELECT f.id, f.canonical_name AS name, f.brand, f.source, f.source_reference,
            f.source_note, f.grams_per_millilitre,f.cooking_factor,f.food_category,f.version,
            jsonb_object_agg(n.id, fn.value_per_100g ORDER BY n.sort_order)
              FILTER (WHERE n.id IS NOT NULL) AS nutrient_values,
            COALESCE((SELECT jsonb_object_agg(u.unit_id, u.grams_per_unit)
                        FROM food_unit_conversions u WHERE u.food_id = f.id), '{}'::jsonb) AS grams_per_unit,
            COALESCE((SELECT jsonb_agg(a.alias ORDER BY a.alias)
                        FROM food_aliases a WHERE a.food_id = f.id), '[]'::jsonb) AS aliases
       FROM foods f
       LEFT JOIN food_nutrients fn ON fn.food_id = f.id
       LEFT JOIN nutrients n ON n.id = fn.nutrient_id
      WHERE f.id = $1
      GROUP BY f.id`,
    [id],
  );
  const row = result.rows[0];
  if (!row) return null;
  const nutrients = row.nutrient_values ?? {};
  const names = Object.fromEntries(Object.entries(nutrientIds).map(([key, nutrientId]) => [key, nutrients[nutrientId] == null ? null : Number(nutrients[nutrientId])]));
  return {
    id: row.id, name: row.name, brand: row.brand, source: row.source,
    sourceReference: row.source_reference, sourceNote: row.source_note,
    gramsPerMillilitre: row.grams_per_millilitre === null ? null : Number(row.grams_per_millilitre),
    cookingFactor: row.cooking_factor == null ? null : Number(row.cooking_factor),
    foodCategory: row.food_category, version: row.version,
    gramsPerUnit: Object.fromEntries(Object.entries(row.grams_per_unit ?? {}).map(([key, value]) => [key, Number(value)])),
    aliases: row.aliases ?? [], nutrientsPer100g: names,
  };
}

function normalizeSearch(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/[^a-z0-9]+/g, ' ').trim();
}
