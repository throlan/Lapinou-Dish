import { randomUUID } from 'node:crypto';
import { toGrams } from '../domain/foods.ts';

export function validateServingParts(input, recipeType) {
  if (input.separateStarch == null || input.separateStarch === false) return { data: { separateStarch: false, servingWeights: {}, cookingFactors: { main: 1, starch: 3 } } };
  if (input.separateStarch !== true) return { error: 'invalid-serving-parts' };
  const groups = new Set((input.lines ?? []).map(line => line?.servingPart ?? 'main'));
  if (!groups.has('main') || [...groups].some(key => !['main','starch'].includes(key))) return { error: 'invalid-serving-parts' };
  if (groups.has('starch') && recipeType !== 'dish') return { error: 'invalid-serving-parts' };
  const factors = {};
  for (const key of groups) {
    const factor = input.cookingFactors?.[key] ?? (key === 'main' ? 1 : 3);
    if (typeof factor !== 'number' || !Number.isFinite(factor) || factor <= 0 || factor > 10) return { error: 'invalid-cooking-factor' };
    factors[key] = factor;
  }
  return { data: { separateStarch: true, servingWeights: {}, cookingFactors: factors } };
}

export async function syncServingParts(client, id, data) {
  if (!data.separateStarch) return;
  const foods = await client.query(
    `SELECT f.id, f.grams_per_millilitre, COALESCE((SELECT jsonb_object_agg(unit_id,grams_per_unit) FROM food_unit_conversions WHERE food_id=f.id),'{}'::jsonb) AS grams_per_unit
     FROM foods f WHERE f.id=ANY($1::uuid[])`, [[...new Set(data.lines.map(line => line.foodId))]]);
  const foodById = new Map(foods.rows.map(row => [row.id, { gramsPerMillilitre: row.grams_per_millilitre == null ? null : Number(row.grams_per_millilitre), gramsPerUnit: Object.fromEntries(Object.entries(row.grams_per_unit).map(([key,value]) => [key,Number(value)])) }]));
  data.servingWeights = {};
  for (const line of data.lines) {
    const food = foodById.get(line.foodId);
    const grams = food ? toGrams(line.quantity,line.unitId,food) : null;
    if (grams == null) throw new Error('serving-weight-conversion-required');
    data.servingWeights[line.servingPart] = (data.servingWeights[line.servingPart] ?? 0) + grams * (line.cookingFactor ?? data.cookingFactors[line.servingPart]);
  }
  if (Object.values(data.servingWeights).some(weight => !(weight > 0) || weight > 100000)) throw new Error('invalid-serving-weight');
  await client.query('UPDATE recipes SET serving_weights=$2::jsonb WHERE id=$1', [id,JSON.stringify(data.servingWeights)]);
  const old = await client.query('SELECT id, serving_part FROM recipes WHERE parent_recipe_id=$1 FOR UPDATE', [id]);
  if (old.rows.some(row => !Object.hasOwn(data.servingWeights, row.serving_part))) throw new Error('serving-part-removal-not-supported');
  const childParts = [];
  for (const [part, weight] of Object.entries(data.servingWeights)) {
    const childId = old.rows.find(row => row.serving_part === part)?.id ?? randomUUID();
    childParts.push({id:childId,part,weight});
    const label = part === 'main' ? (Object.hasOwn(data.servingWeights,'starch') ? 'Viande et légumes' : 'Préparation entière') : 'Féculents';
    await client.query(
      `INSERT INTO recipes(id,household_id,name,description,yield_amount,yield_unit_id,recipe_type,production_type,meal_moments,parent_recipe_id,serving_part)
       VALUES($1,$2,$3,$4,$5,'g',$6,$7,$8,$9,$10)
       ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,yield_amount=EXCLUDED.yield_amount,
         recipe_type=EXCLUDED.recipe_type,production_type=EXCLUDED.production_type,meal_moments=EXCLUDED.meal_moments,version=recipes.version+1,updated_at=now()`,
      [childId,data.householdId,`${data.name} — ${label}`,data.description,weight,part === 'main' ? data.recipeType : 'accompaniment',data.productionType,data.mealMoments,id,part]);
    await client.query('DELETE FROM recipe_lines WHERE recipe_id=$1', [childId]);
    for (const [index, line] of data.lines.filter(line => line.servingPart === part).entries()) {
      await client.query('INSERT INTO recipe_lines(id,recipe_id,food_id,quantity,unit_id,sort_order) VALUES($1,$2,$3,$4,$5,$6)', [randomUUID(),childId,line.foodId,line.quantity,line.unitId,index]);
    }
  }
  // Convert whole-recipe reservations and lots once; no ingredient deduction is repeated.
  const planned = await client.query('SELECT id,meal_id,sort_order,role FROM planned_meal_items WHERE recipe_id=$1 FOR UPDATE',[id]);
  for (const item of planned.rows) {
    const amounts = await client.query('SELECT person_id,quantity FROM planned_amounts WHERE planned_item_id=$1',[item.id]);
    await client.query('DELETE FROM planned_meal_items WHERE id=$1',[item.id]);
    for (const child of childParts) {
      const itemId = randomUUID();
      await client.query('INSERT INTO planned_meal_items(id,meal_id,recipe_id,sort_order,role) VALUES($1,$2,$3,$4,$5)',[itemId,item.meal_id,child.id,item.sort_order,child.part === 'starch' ? 'accompaniment' : item.role]);
      for (const amount of amounts.rows) await client.query('INSERT INTO planned_amounts(planned_item_id,person_id,quantity) VALUES($1,$2,$3)',[itemId,amount.person_id,Number(amount.quantity)/data.yield.amount*child.weight]);
    }
  }
  const lots = await client.query('SELECT id,produced_on::text AS produced_on,quantity,storage,note FROM stock_lots WHERE recipe_id=$1 AND cancelled_at IS NULL AND NOT is_serving_bundle FOR UPDATE',[id]);
  for (const lot of lots.rows) {
    await client.query('UPDATE stock_lots SET is_serving_bundle=true WHERE id=$1',[lot.id]);
    for (const child of childParts) await client.query('INSERT INTO stock_lots(id,household_id,recipe_id,produced_on,quantity,storage,note,parent_lot_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[randomUUID(),data.householdId,child.id,lot.produced_on,Number(lot.quantity)/data.yield.amount*child.weight,lot.storage,lot.note,lot.id]);
  }
}
