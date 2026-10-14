import { randomUUID } from 'node:crypto';
import { calculateRecipeNutrition } from '../domain/foods.ts';
import { syncServingParts, validateServingParts } from './serving-parts.mjs';
import { lockHouseholdInventory } from './ingredient-stock.mjs';

export function validateRecipeInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'invalid-body' };
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 200) return { error: 'invalid-name' };
  if (!isUuid(input.householdId)) return { error: 'invalid-household-id' };
  const amount = input.yield?.amount;
  const unitId = input.yield?.unitId;
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || amount > 100000) return { error: 'invalid-yield' };
  if (typeof unitId !== 'string' || !/^[a-z][a-z0-9_-]{0,30}$/.test(unitId)) return { error: 'invalid-yield-unit' };
  const recipeTypes = ['dish', 'beverage', 'accompaniment', 'dessert'];
  const productionTypes = ['none', 'batch_cooking', 'pasta', 'pastry', 'bread'];
  const mealMoments = ['breakfast', 'lunch', 'dinner', 'snack'];
  const recipeType = input.recipeType == null ? 'dish' : input.recipeType;
  if (!recipeTypes.includes(recipeType)) return { error: 'invalid-recipe-type' };
  const productionType = input.productionType == null ? 'none' : input.productionType;
  if (!productionTypes.includes(productionType)) return { error: 'invalid-production-type' };
  const moments = input.mealMoments == null ? [] : input.mealMoments;
  if (!Array.isArray(moments) || moments.length > mealMoments.length || moments.some((moment) => !mealMoments.includes(moment)) || new Set(moments).size !== moments.length) return { error: 'invalid-meal-moments' };
  if (!Array.isArray(input.lines) || input.lines.length === 0 || input.lines.length > 300) return { error: 'invalid-lines' };
  const serving = validateServingParts(input, recipeType);
  if (serving.error) return serving;
  const lines = [];
  for (const line of input.lines) {
    if (!line || !isUuid(line.foodId)) return { error: 'invalid-food-id' };
    if (typeof line.quantity !== 'number' || !Number.isFinite(line.quantity) || line.quantity <= 0 || line.quantity > 100000) return { error: 'invalid-quantity' };
    if (typeof line.unitId !== 'string' || !/^[a-z][a-z0-9_-]{0,30}$/.test(line.unitId)) return { error: 'invalid-unit' };
    if (line.cookingFactor != null && (typeof line.cookingFactor !== 'number' || !Number.isFinite(line.cookingFactor) || line.cookingFactor <= 0 || line.cookingFactor > 10)) return {error:'invalid-cooking-factor'};
    lines.push({ foodId: line.foodId, quantity: line.quantity, unitId: line.unitId, componentId: null, variantId: null, servingPart: serving.data.separateStarch ? line.servingPart ?? 'main' : 'main', cookingFactor: line.cookingFactor ?? null });
  }
  return { data: { ...serving.data, name: input.name.trim(), description: typeof input.description === 'string' ? input.description.slice(0, 5000) : '', instructions: typeof input.instructions === 'string' ? input.instructions.slice(0, 20000) : '', sourceUrl: typeof input.sourceUrl === 'string' && /^https:\/\//i.test(input.sourceUrl) ? input.sourceUrl.slice(0, 2000) : null, recipeType, productionType, mealMoments: [...moments], householdId: input.householdId, yield: { amount, unitId }, lines } };
}

export async function createRecipe(pool, data) {
  const client = await pool.connect();
  const id = randomUUID();
  try {
    await client.query('BEGIN');
    await lockHouseholdInventory(client,data.householdId);
    await client.query(
      `INSERT INTO recipes (id, household_id, name, description, yield_amount, yield_unit_id, instructions, source_url, recipe_type, production_type, meal_moments,separate_starch,cooking_factors)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,$12,$13::jsonb)`,
      [id, data.householdId, data.name, data.description, data.yield.amount, data.yield.unitId, data.instructions, data.sourceUrl, data.recipeType, data.productionType, data.mealMoments,data.separateStarch ?? false,JSON.stringify(data.cookingFactors ?? {main:1,starch:3})],
    );
    for (const [index, line] of data.lines.entries()) {
      await client.query(
        `INSERT INTO recipe_lines (id, recipe_id, food_id, quantity, unit_id, sort_order,serving_part,cooking_factor)
         VALUES ($1, $2, $3, $4, $5, $6,$7,$8)`,
        [randomUUID(), id, line.foodId, line.quantity, line.unitId, index,line.servingPart ?? 'main',line.cookingFactor ?? null],
      );
    }
    await syncServingParts(client,id,data);
    const recipe = await readRecipe(client, id);
    await client.query('COMMIT');
    return recipe;
  } catch (error) {
    await client.query('ROLLBACK');
    if (['serving-weight-conversion-required','invalid-serving-weight','serving-part-removal-not-supported'].includes(error.message)) return {error:error.message};
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

export async function updateRecipe(pool, id, data) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await lockHouseholdInventory(client,data.householdId);
    const prepared=await client.query(`SELECT 1 FROM planned_meals m JOIN planned_meal_items i ON i.meal_id=m.id
      JOIN recipes used ON used.id=i.recipe_id WHERE m.household_id=$1 AND m.prepared_at IS NOT NULL
      AND (used.id=$2 OR used.parent_recipe_id=$2) LIMIT 1`,[data.householdId,id]);
    if(prepared.rowCount){await client.query('ROLLBACK');return {error:'recipe-used-in-prepared-meal'};}
    const updated = await client.query(
      `UPDATE recipes SET name = $3, description = $4, yield_amount = $5,
              yield_unit_id = $6, instructions = $7, source_url = $8, recipe_type = $9, production_type = $10, meal_moments = $11,separate_starch=$12,cooking_factors=$13::jsonb, version = version + 1, updated_at = now()
        WHERE id = $1 AND household_id = $2 AND parent_recipe_id IS NULL RETURNING id`,
      [id, data.householdId, data.name, data.description, data.yield.amount, data.yield.unitId, data.instructions, data.sourceUrl, data.recipeType, data.productionType, data.mealMoments,data.separateStarch ?? false,JSON.stringify(data.cookingFactors ?? {main:1,starch:3})],
    );
    if (!updated.rowCount) {
      await client.query('ROLLBACK');
      return null;
    }
    if (!data.separateStarch) {
      const parts = await client.query('SELECT id FROM recipes WHERE parent_recipe_id=$1', [id]);
      if (parts.rows.length) { await client.query('ROLLBACK'); return {error:'serving-parts-cannot-be-disabled'}; }
    }
    await client.query('DELETE FROM recipe_lines WHERE recipe_id = $1', [id]);
    for (const [index, line] of data.lines.entries()) {
      await client.query(
        `INSERT INTO recipe_lines (id, recipe_id, food_id, quantity, unit_id, sort_order,serving_part,cooking_factor)
         VALUES ($1, $2, $3, $4, $5, $6,$7,$8)`,
        [randomUUID(), id, line.foodId, line.quantity, line.unitId, index,line.servingPart ?? 'main',line.cookingFactor ?? null],
      );
    }
    await syncServingParts(client,id,data);
    const recipe = await readRecipe(client, id);
    await client.query('COMMIT');
    return recipe;
  } catch (error) {
    await client.query('ROLLBACK');
    if (['serving-weight-conversion-required','invalid-serving-weight','serving-part-removal-not-supported'].includes(error.message)) return {error:error.message};
    if (error.code === '23503') return { error: 'unknown-household-food-or-unit' };
    throw error;
  } finally {
    client.release();
  }
}

export async function readRecipe(client, id) {
  const recipeResult = await client.query(
    `SELECT id, name, description, yield_amount, yield_unit_id, instructions, source_url, recipe_type, production_type, meal_moments,separate_starch,serving_weights,cooking_factors,parent_recipe_id,serving_part
       FROM recipes WHERE id = $1`, [id],
  );
  const row = recipeResult.rows[0];
  if (!row) return null;
  const linesResult = await client.query(
    `SELECT id, food_id, quantity, unit_id, sort_order,serving_part,cooking_factor FROM recipe_lines
      WHERE recipe_id = $1 ORDER BY sort_order`, [id],
  );
  const lines = linesResult.rows.map((line) => ({
    id: line.id, foodId: line.food_id, quantity: Number(line.quantity), unitId: line.unit_id,
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
  const nutrition = calculateRecipeNutrition(lines, foods, Number(row.yield_amount));
  if (row.parent_recipe_id) nutrition.perYieldUnit = Object.fromEntries(Object.entries(nutrition.batch).map(([key,value]) => [key,value == null ? null : value / Number(row.yield_amount)]));
  const foodById = new Map(foods.map((food) => [food.id, food]));
  const servingParts = [];
  if (row.separate_starch) {
    const children = await client.query('SELECT id FROM recipes WHERE parent_recipe_id=$1 ORDER BY serving_part', [id]);
    for (const child of children.rows) servingParts.push(await readRecipe(client,child.id));
  }
  return {
    separateStarch:row.separate_starch ?? false,servingWeights:row.serving_weights ?? {},cookingFactors:row.cooking_factors ?? {main:1,starch:3},parentRecipeId:row.parent_recipe_id ?? null,servingPart:row.serving_part ?? null,servingParts,
    id: row.id, name: row.name, description: row.description, instructions: row.instructions ?? '', sourceUrl: row.source_url ?? null,
    recipeType: row.recipe_type ?? 'dish', productionType: row.production_type ?? 'none', mealMoments: row.meal_moments ?? [],
    yield: { amount: Number(row.yield_amount), unitId: row.yield_unit_id },
    lines: lines.map((line, index) => ({ ...line, foodName: foodById.get(line.foodId)?.name ?? null, resolved: !nutrition.unresolvedLineIndexes.includes(index) })),
    nutrition,
  };
}

function isUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
