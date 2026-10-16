import { randomUUID } from 'node:crypto';
import { toGrams } from '../domain/foods.ts';

export function validateServingParts(input, recipeType) {
  if (input.servingMode != null && (!['original','whole','separate','three'].includes(input.servingMode)
    || (input.servingMode === 'original' ? input.separateStarch === true : input.separateStarch !== true))) return {error:'invalid-serving-parts'};
  if (input.separateStarch == null || input.separateStarch === false) return { data: { separateStarch: false, servingWeights: {}, cookingFactors: { main: 1, starch: 3 } } };
  if (input.separateStarch !== true) return { error: 'invalid-serving-parts' };
  const groups = new Set((input.lines ?? []).map(line => line?.servingPart ?? 'main'));
  if (['separate','three'].includes(input.servingMode) && !groups.has('starch')) return {error:'starch-ingredients-required'};
  if (input.servingMode === 'three' && !groups.has('vegetables')) return {error:'vegetable-ingredients-required'};
  if (input.servingMode === 'whole' && groups.size !== 1) return {error:'invalid-serving-parts'};
  if (input.servingMode === 'separate' && groups.has('vegetables')) return {error:'invalid-serving-parts'};
  if (!groups.has('main') || [...groups].some(key => !['main','starch','vegetables'].includes(key))) return { error: 'invalid-serving-parts' };
  if (groups.has('starch') && !['dish','salad'].includes(recipeType)) return { error: 'invalid-serving-parts' };
  const factors = {};
  for (const key of groups) {
    const factor = input.cookingFactors?.[key] ?? (key === 'starch' ? 3 : 1);
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
  const old = await client.query('SELECT id, serving_part,yield_amount FROM recipes WHERE parent_recipe_id=$1 FOR UPDATE', [id]);
  if (old.rows.some(row => !Object.hasOwn(data.servingWeights, row.serving_part))) throw new Error('serving-part-removal-not-supported');
  const childParts = [];
  for (const [part, weight] of Object.entries(data.servingWeights)) {
    const childId = old.rows.find(row => row.serving_part === part)?.id ?? randomUUID();
    childParts.push({id:childId,part,weight});
    const label = part === 'main' ? (Object.hasOwn(data.servingWeights,'vegetables') ? 'Viande / protéines' : Object.hasOwn(data.servingWeights,'starch') ? 'Viande et légumes' : 'Préparation entière') : part === 'vegetables' ? 'Légumes' : 'Féculents';
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
  const added = childParts.filter(part => !old.rows.some(row=>row.serving_part === part.part));
  const oldMain = old.rows.find(row=>row.serving_part === 'main');
  if (oldMain && added.length) {
    await splitExistingWholePreparation(client,oldMain,[childParts.find(part=>part.part === 'main'),...added],data.householdId);
  }
  // Convert whole-recipe reservations and lots once; no ingredient deduction is repeated.
  const planned = await client.query('SELECT id,meal_id,sort_order,role FROM planned_meal_items WHERE recipe_id=$1 FOR UPDATE',[id]);
  for (const item of planned.rows) {
    const amounts = await client.query('SELECT person_id,quantity FROM planned_amounts WHERE planned_item_id=$1',[item.id]);
    await client.query('DELETE FROM planned_meal_items WHERE id=$1',[item.id]);
    for (const child of childParts) {
      const itemId = randomUUID();
      await client.query('INSERT INTO planned_meal_items(id,meal_id,recipe_id,sort_order,role) VALUES($1,$2,$3,$4,$5)',[itemId,item.meal_id,child.id,item.sort_order,child.part !== 'main' ? 'accompaniment' : item.role]);
      for (const amount of amounts.rows) await client.query('INSERT INTO planned_amounts(planned_item_id,person_id,quantity) VALUES($1,$2,$3)',[itemId,amount.person_id,Number(amount.quantity)/data.yield.amount*child.weight]);
    }
  }
  const lots = await client.query('SELECT id,produced_on::text AS produced_on,quantity,storage,note FROM stock_lots WHERE recipe_id=$1 AND cancelled_at IS NULL AND NOT is_serving_bundle FOR UPDATE',[id]);
  for (const lot of lots.rows) {
    await client.query('UPDATE stock_lots SET is_serving_bundle=true WHERE id=$1',[lot.id]);
    for (const child of childParts) await client.query('INSERT INTO stock_lots(id,household_id,recipe_id,produced_on,quantity,storage,note,parent_lot_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[randomUUID(),data.householdId,child.id,lot.produced_on,Number(lot.quantity)/data.yield.amount*child.weight,lot.storage,lot.note,lot.id]);
  }
}

export async function restoreOriginalServingMode(client, id) {
  const parent=await client.query('SELECT yield_amount FROM recipes WHERE id=$1 FOR UPDATE',[id]);
  const parts = await client.query('SELECT id,serving_part,yield_amount FROM recipes WHERE parent_recipe_id=$1 FOR UPDATE', [id]);
  if (!parts.rows.length) return;
  // A whole-preparation mode has one gram-based child, so its quantities can be
  // converted back to the recipe yield without guessing between serving parts.
  if (parts.rowCount !== 1 || parts.rows[0].serving_part !== 'main' || !(Number(parts.rows[0].yield_amount) > 0)) {
    throw new Error('serving-parts-cannot-be-disabled');
  }
  const part = parts.rows[0];
  const yieldAmount = Number(parent.rows[0]?.yield_amount);
  const gramYield = Number(part.yield_amount);
  const planned = await client.query(
    `SELECT i.id,a.person_id,a.quantity FROM planned_meal_items i
       JOIN planned_amounts a ON a.planned_item_id=i.id
      WHERE i.recipe_id=$1 ORDER BY i.meal_id,i.sort_order FOR UPDATE OF i,a`, [part.id]);
  await client.query('UPDATE planned_meal_items SET recipe_id=$2 WHERE recipe_id=$1',[part.id,id]);
  for (const row of planned.rows) await client.query(
    'UPDATE planned_amounts SET quantity=$3 WHERE planned_item_id=$1 AND person_id=$2',
    [row.id,row.person_id,Number(row.quantity)/gramYield*yieldAmount]);

  const childLots=await client.query('SELECT id,parent_lot_id FROM stock_lots WHERE recipe_id=$1 FOR UPDATE',[part.id]);
  const linked=childLots.rows.filter(lot=>lot.parent_lot_id);
  if (linked.length) {
    await client.query('UPDATE stock_lots SET is_serving_bundle=false WHERE id=ANY($1::uuid[])',[linked.map(lot=>lot.parent_lot_id)]);
    await client.query('DELETE FROM stock_lots WHERE id=ANY($1::uuid[])',[linked.map(lot=>lot.id)]);
  }
  const standalone=childLots.rows.filter(lot=>!lot.parent_lot_id).map(lot=>lot.id);
  if (standalone.length) await client.query(
    'UPDATE stock_lots SET recipe_id=$2,quantity=quantity*$3 WHERE id=ANY($1::uuid[])',
    [standalone,id,yieldAmount/gramYield]);
  await client.query('DELETE FROM recipe_lines WHERE recipe_id=$1',[part.id]);
  await client.query('DELETE FROM recipes WHERE id=$1',[part.id]);
}

async function splitExistingWholePreparation(client, oldMain, parts, householdId) {
  const main = parts.find(part=>part.part === 'main');
  const extraParts = parts.filter(part=>part.part !== 'main');
  const oldWeight = Number(oldMain.yield_amount);
  const items = await client.query('SELECT id,meal_id,sort_order FROM planned_meal_items WHERE recipe_id=$1 FOR UPDATE',[oldMain.id]);
  for (const item of items.rows) {
    const amounts = await client.query('SELECT person_id,quantity FROM planned_amounts WHERE planned_item_id=$1',[item.id]);
    for (const amount of amounts.rows) {
      const fraction = Number(amount.quantity)/oldWeight;
      await client.query('UPDATE planned_amounts SET quantity=$3 WHERE planned_item_id=$1 AND person_id=$2',[item.id,amount.person_id,fraction*main.weight]);
    }
    const lastOrder = await client.query('SELECT COALESCE(MAX(sort_order),0) AS last_order FROM planned_meal_items WHERE meal_id=$1',[item.meal_id]);
    for (const [index,part] of extraParts.entries()) {
      const itemId = randomUUID();
      await client.query('INSERT INTO planned_meal_items(id,meal_id,recipe_id,sort_order,role) VALUES($1,$2,$3,$4,\'accompaniment\')',[itemId,item.meal_id,part.id,Number(lastOrder.rows[0].last_order)+1+index]);
      for (const amount of amounts.rows) await client.query('INSERT INTO planned_amounts(planned_item_id,person_id,quantity) VALUES($1,$2,$3)',[itemId,amount.person_id,Number(amount.quantity)/oldWeight*part.weight]);
    }
  }
  const lots = await client.query('SELECT id,parent_lot_id,produced_on::text AS produced_on,quantity,storage,note FROM stock_lots WHERE recipe_id=$1 AND household_id=$2 AND cancelled_at IS NULL AND NOT is_serving_bundle FOR UPDATE',[oldMain.id,householdId]);
  for (const lot of lots.rows) {
    const fraction = Number(lot.quantity)/oldWeight;
    // A directly produced whole preparation also becomes a bundle; its deduction ledger stays on it.
    const parentId = lot.parent_lot_id ?? lot.id;
    if (lot.parent_lot_id) {
      await client.query('UPDATE stock_lots SET quantity=$2 WHERE id=$1',[lot.id,fraction*main.weight]);
    } else {
      await client.query('UPDATE stock_lots SET is_serving_bundle=true WHERE id=$1',[lot.id]);
      await client.query('INSERT INTO stock_lots(id,household_id,recipe_id,produced_on,quantity,storage,note,parent_lot_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[randomUUID(),householdId,main.id,lot.produced_on,fraction*main.weight,lot.storage,lot.note,parentId]);
    }
    for (const part of extraParts) await client.query('INSERT INTO stock_lots(id,household_id,recipe_id,produced_on,quantity,storage,note,parent_lot_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[randomUUID(),householdId,part.id,lot.produced_on,fraction*part.weight,lot.storage,lot.note,parentId]);
  }
}
