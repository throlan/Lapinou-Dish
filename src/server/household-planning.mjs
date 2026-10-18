import {recipeRequirements,preparationInputs,recordRecipeUses} from './recipe-ingredients.mjs';
import { randomUUID } from 'node:crypto';
import { listFoodStores } from './food-stores.mjs';
import { rawShoppingRequirements } from './shopping-requirements.mjs';
import { purchaseDescription,suggestedPurchaseUnit } from './shopping-presentation.mjs';
import { applyPackageUnits,applyPurchaseUnits,listPurchaseUnits } from './purchase-units.mjs';
import { ingredientProjection, lockHouseholdInventory, productionDeductions, readIngredientStock } from './ingredient-stock.mjs';

const routineDefaults = [
  ['bulk_shopping', 'monthly'],
  ['fresh_shopping', 'weekly'],
  ['whey_flour_order', 'monthly'],
  ['pasta_pastry_production', 'monthly'],
  ['bread_production', 'monthly'],
  ['batch_cooking', 'weekly'],
];
const frequencies = new Set(['weekly', 'biweekly', 'monthly']);
const storageTypes = new Set(['pantry', 'fridge', 'freezer']);
const shoppingGroups = new Set(['bulk', 'fresh', 'whey_flour', 'other']);

export function validateRoutineSettings(input) {
  if (!Array.isArray(input) || input.length !== routineDefaults.length) return { error: 'invalid-routines' };
  const seen = new Set();
  const routines = [];
  for (const routine of input) {
    if (!routine || typeof routine !== 'object' || !routineDefaults.some(([id]) => id === routine.routineId)
      || seen.has(routine.routineId) || !frequencies.has(routine.frequency) || !isDate(routine.nextDate)) return { error: 'invalid-routine' };
    seen.add(routine.routineId);
    routines.push({ routineId: routine.routineId, frequency: routine.frequency, nextDate: routine.nextDate });
  }
  return { data: routines };
}

export function validateOrderLinkInput(input) {
  if (!input || typeof input !== 'object' || !isUuid(input.householdId)
    || typeof input.label !== 'string' || !input.label.trim() || input.label.trim().length > 100
    || (input.url != null && typeof input.url !== 'string') || (input.url?.length ?? 0) > 2048
    || (input.homeAssistantEntityId != null && input.homeAssistantEntityId !== ''
      && (typeof input.homeAssistantEntityId !== 'string' || !/^todo\.[a-z0-9_]+$/.test(input.homeAssistantEntityId)))) return { error: 'invalid-order-link' };
  let url = null;
  if (input.url?.trim()) {
    let parsed;
    try { parsed = new URL(input.url.trim()); } catch { return { error: 'invalid-order-link' }; }
    if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.username || parsed.password) return { error: 'invalid-order-link' };
    url = parsed.toString();
  }
  return { data: { id: isUuid(input.id) ? input.id : randomUUID(), householdId: input.householdId, label: input.label.trim(), url,
    homeAssistantEntityId:input.homeAssistantEntityId || null } };
}

export async function listOrderLinks(pool, householdId) {
  const result = await pool.query(
    'SELECT id, label, url, home_assistant_entity_id AS "homeAssistantEntityId" FROM household_order_links WHERE household_id=$1 ORDER BY created_at,id', [householdId]);
  return result.rows;
}

export async function saveOrderLink(pool, link) {
  const result = await pool.query(
    `INSERT INTO household_order_links(id,household_id,label,url,home_assistant_entity_id) VALUES($1,$2,$3,$4,$5)
     ON CONFLICT(id) DO UPDATE SET label=EXCLUDED.label,url=EXCLUDED.url,
       home_assistant_entity_id=EXCLUDED.home_assistant_entity_id,updated_at=now()
     WHERE household_order_links.household_id=EXCLUDED.household_id
     RETURNING id,label,url,home_assistant_entity_id AS "homeAssistantEntityId"`,
    [link.id,link.householdId,link.label,link.url,link.homeAssistantEntityId??null]);
  return result.rows[0] ?? null;
}

export async function deleteOrderLink(pool, householdId, linkId) {
  const result = await pool.query('DELETE FROM household_order_links WHERE household_id=$1 AND id=$2', [householdId,linkId]);
  return result.rowCount > 0;
}

export async function getRoutineSettings(pool, householdId) {
  for (const [routineId, frequency] of routineDefaults) {
    await pool.query(
      `INSERT INTO household_routines (household_id, routine_id, frequency, next_date)
       VALUES ($1, $2, $3, CASE WHEN $3 = 'weekly' THEN CURRENT_DATE + ((8 - EXTRACT(ISODOW FROM CURRENT_DATE)::int) % 7) ELSE CURRENT_DATE END)
       ON CONFLICT (household_id, routine_id) DO NOTHING`,
      [householdId, routineId, frequency],
    );
  }
  const result = await pool.query(
    'SELECT routine_id AS "routineId", frequency, next_date::text AS "nextDate" FROM household_routines WHERE household_id = $1 ORDER BY routine_id',
    [householdId],
  );
  return result.rows;
}

export async function saveRoutineSettings(pool, householdId, routines) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const routine of routines) {
      await client.query(
        `INSERT INTO household_routines (household_id, routine_id, frequency, next_date)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (household_id, routine_id) DO UPDATE
           SET frequency = EXCLUDED.frequency, next_date = EXCLUDED.next_date, updated_at = now()`,
        [householdId, routine.routineId, routine.frequency, routine.nextDate],
      );
    }
    await client.query('COMMIT');
    return routines;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

export async function completeRoutine(pool, householdId, routineId) {
  if (!routineDefaults.some(([id]) => id === routineId)) return null;
  const result = await pool.query(
    `UPDATE household_routines
        SET next_date = CASE frequency
          WHEN 'weekly' THEN next_date + 7
          WHEN 'biweekly' THEN next_date + 14
          ELSE (next_date + INTERVAL '1 month')::date
        END,
        updated_at = now()
      WHERE household_id = $1 AND routine_id = $2
      RETURNING routine_id AS "routineId", frequency, next_date::text AS "nextDate"`,
    [householdId, routineId],
  );
  return result.rows[0] ?? null;
}

export function validateProductionInput(input) {
  const split = input?.servingQuantities != null;
  if (!input || typeof input !== 'object' || !isUuid(input.householdId) || !isUuid(input.recipeId)
    || !isDate(input.producedOn)
    || (!split && (!Number.isFinite(input.quantity) || input.quantity <= 0 || input.quantity > 100000))
    || !storageTypes.has(input.storage ?? 'freezer')
    || (input.note != null && (typeof input.note !== 'string' || input.note.length > 500))
    || (input.requestId != null && !isUuid(input.requestId))) return { error: 'invalid-production' };
  if (split && (!Array.isArray(input.servingQuantities) || input.servingQuantities.length < 2 || input.servingQuantities.length > 3
    || input.servingQuantities.some(part => !part || !isUuid(part.recipeId) || !Number.isFinite(part.quantity)
      || part.quantity < 0 || part.quantity > 100000 || Math.abs(part.quantity * 1000 - Math.round(part.quantity * 1000)) > 0.000001)
    || new Set(input.servingQuantities.map(part => part.recipeId)).size !== input.servingQuantities.length
    || !input.servingQuantities.some(part => part.quantity > 0))) return {error:'invalid-production-parts'};
  return { data: {
    householdId: input.householdId, recipeId: input.recipeId,
    producedOn: input.producedOn, quantity: input.quantity, storage: input.storage ?? 'freezer',
    note: typeof input.note === 'string' ? input.note.trim() : '',
    requestId: input.requestId ?? null,
    ...(split ? {servingQuantities:input.servingQuantities.map(part=>({recipeId:part.recipeId,quantity:part.quantity}))} : {}),
  } };
}

export async function addStockLot(pool, input) {
  if (input.servingQuantities != null) {
    const validation=validateProductionInput(input);
    if(validation.error)return validation;
    input=validation.data;
  }
  const client = await pool.connect();
  const id = randomUUID();
  const requestedParts = input.servingQuantities
    ? Object.fromEntries(input.servingQuantities.map(part=>[part.recipeId,part.quantity])) : null;
  try {
    await client.query('BEGIN');
    await lockHouseholdInventory(client, input.householdId);
    if (input.requestId) {
      const previous = await client.query('SELECT *, produced_on::text AS produced_on FROM stock_lots WHERE household_id=$1 AND request_id=$2', [input.householdId,input.requestId]);
      if (previous.rowCount) {
        const lot = previous.rows[0];
        await client.query('ROLLBACK');
        if (lot.cancelled_at) return { error:'production-request-cancelled' };
        const savedParts=lot.serving_quantities;
        const sameParts=requestedParts && savedParts
          ? Object.keys(requestedParts).length===Object.keys(savedParts).length
            && Object.entries(requestedParts).every(([key,value])=>Number(savedParts[key])===value)
          : !requestedParts && !savedParts;
        if (!sameParts || lot.recipe_id !== input.recipeId || (!requestedParts && Number(lot.quantity) !== input.quantity)
          || String(lot.produced_on).slice(0,10) !== input.producedOn || lot.storage !== input.storage || lot.note !== input.note) return { error:'production-request-conflict' };
        return { id:lot.id, recipeId:input.recipeId, quantity:Number(lot.quantity), replayed:true };
      }
    }
    const recipe = await client.query(
      'SELECT id, yield_amount, yield_unit_id, production_type,separate_starch FROM recipes WHERE id = $1 AND household_id = $2 FOR SHARE',
      [input.recipeId, input.householdId],
    );
    if (!recipe.rowCount || recipe.rows[0].production_type === 'none') {
      await client.query('ROLLBACK'); return { error: !recipe.rowCount ? 'recipe-not-found' : 'recipe-not-for-production' };
    }
    let quantity=input.quantity,parts=null;
    if (requestedParts) {
      parts=await client.query('SELECT id,yield_amount FROM recipes WHERE parent_recipe_id=$1 AND household_id=$2 FOR SHARE',[input.recipeId,input.householdId]);
      if (!recipe.rows[0].separate_starch || parts.rows.length < 2 || parts.rows.length!==Object.keys(requestedParts).length
        || parts.rows.some(part=>!Object.hasOwn(requestedParts,part.id))) {
        await client.query('ROLLBACK');return {error:'invalid-production-parts'};
      }
      // Only a bookkeeping equivalent for the hidden bundle. Physical stock
      // and ingredient deductions use each child's requested grams below.
      const total=Object.values(requestedParts).reduce((sum,value)=>sum+value,0);
      const base=parts.rows.reduce((sum,part)=>sum+Number(part.yield_amount),0);
      quantity=Math.min(100000,Math.max(0.001,Math.round(total/base*Number(recipe.rows[0].yield_amount)*1000)/1000));
    }
    const targets=requestedParts
      ? parts.rows.filter(part=>requestedParts[part.id]>0).map(part=>({id:part.id,factor:requestedParts[part.id]/Number(part.yield_amount)}))
      : [{id:input.recipeId,factor:quantity/Number(recipe.rows[0].yield_amount)}];
    const inputs=await preparationInputs(client,input.householdId,targets);
    if(inputs.error){await client.query('ROLLBACK');return inputs;}
    const deductions=productionDeductions(inputs.lines,1,1);
    if (deductions.error) { await client.query('ROLLBACK'); return deductions; }
    await client.query(
      `INSERT INTO stock_lots (id, household_id, recipe_id, produced_on, quantity, storage, note, request_id,serving_quantities)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
      [id, input.householdId, input.recipeId, input.producedOn, quantity, input.storage, input.note,input.requestId,requestedParts?JSON.stringify(requestedParts):null],
    );
    if (recipe.rows[0].separate_starch) {
      parts ??= await client.query('SELECT id,yield_amount FROM recipes WHERE parent_recipe_id=$1 FOR SHARE', [input.recipeId]);
      if (!parts.rows.length) throw new Error('serving-parts-missing');
      await client.query('UPDATE stock_lots SET is_serving_bundle=true WHERE id=$1', [id]);
      for (const part of parts.rows) {
        const grams = requestedParts ? requestedParts[part.id] : quantity / Number(recipe.rows[0].yield_amount) * Number(part.yield_amount);
        if (grams===0) continue;
        await client.query(
          'INSERT INTO stock_lots(id,household_id,recipe_id,produced_on,quantity,storage,note,parent_lot_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
          [randomUUID(),input.householdId,part.id,input.producedOn,grams,input.storage,input.note,id]);
      }
    }
    await recordRecipeUses(client,input.householdId,inputs.uses,{lotId:id});
    for (const item of deductions.items) {
      await client.query('UPDATE household_ingredient_stock SET quantity_g=quantity_g-$3,version=version+1,updated_at=now() WHERE household_id=$1 AND food_id=$2', [input.householdId,item.foodId,item.usedG]);
      await client.query("INSERT INTO ingredient_stock_movements(id,household_id,food_id,delta_g,reason,stock_lot_id) VALUES ($1,$2,$3,$4,'production',$5)", [randomUUID(),input.householdId,item.foodId,-item.usedG,id]);
    }
    await client.query('COMMIT');
    return { id, recipeId: input.recipeId, productionType: recipe.rows[0].production_type, producedOn: input.producedOn, quantity, unitId: recipe.rows[0].yield_unit_id, storage: input.storage, note: input.note, deductions:deductions.items,
      ...(requestedParts?{servingQuantities:input.servingQuantities}:{}) };
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23503') return { error: 'recipe-not-found' };
    throw error;
  } finally { client.release(); }
}

export async function cancelStockLot(pool, householdId, lotId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await lockHouseholdInventory(client, householdId);
    let result = await client.query('SELECT id, cancelled_at,parent_lot_id FROM stock_lots WHERE id=$1 AND household_id=$2 FOR UPDATE', [lotId,householdId]);
    if (!result.rowCount) { await client.query('ROLLBACK'); return { error:'production-lot-not-found' }; }
    if (result.rows[0].parent_lot_id) {
      lotId = result.rows[0].parent_lot_id;
      result = await client.query('SELECT id,cancelled_at FROM stock_lots WHERE id=$1 AND household_id=$2 FOR UPDATE',[lotId,householdId]);
    }
    if (result.rows[0].cancelled_at) { await client.query('ROLLBACK'); return { cancelled:true,replayed:true,restored:[] }; }
    const cancelledRecipes=await client.query(`SELECT recipe_id,sum(quantity) AS quantity FROM stock_lots
      WHERE (id=$1 OR parent_lot_id=$1) AND NOT is_serving_bundle GROUP BY recipe_id`,[lotId]);
    for(const recipe of cancelledRecipes.rows){
      const remaining=await client.query(`SELECT COALESCE(sum(quantity),0) AS quantity FROM stock_lots
        WHERE household_id=$1 AND recipe_id=$2 AND cancelled_at IS NULL AND NOT is_serving_bundle
          AND id<>$3 AND parent_lot_id IS DISTINCT FROM $3`,[householdId,recipe.recipe_id,lotId]);
      const prepared=await client.query(`SELECT COALESCE(sum(a.quantity),0) AS quantity
        FROM planned_meals m JOIN planned_meal_items i ON i.meal_id=m.id JOIN planned_amounts a ON a.planned_item_id=i.id
        WHERE m.household_id=$1 AND m.prepared_at IS NOT NULL AND i.recipe_id=$2`,[householdId,recipe.recipe_id]);
      const used=await client.query('SELECT COALESCE(sum(quantity),0) AS quantity FROM recipe_stock_uses WHERE household_id=$1 AND recipe_id=$2 AND cancelled_at IS NULL AND stock_lot_id IS DISTINCT FROM $3',[householdId,recipe.recipe_id,lotId]);
      if(Number(remaining.rows[0].quantity)+0.00001<Number(prepared.rows[0].quantity)+Number(used.rows[0].quantity)){
        await client.query('ROLLBACK');return {error:'production-already-used'};
      }
    }
    const movements = await client.query(
      `SELECT m.food_id AS "foodId", f.canonical_name AS name, -sum(m.delta_g) AS "quantityG"
       FROM ingredient_stock_movements m JOIN foods f ON f.id=m.food_id
       WHERE m.household_id=$1 AND m.stock_lot_id=$2 AND m.reason='production'
       GROUP BY m.food_id,f.canonical_name ORDER BY m.food_id`, [householdId,lotId]);
    for (const movement of movements.rows) {
      await client.query('UPDATE household_ingredient_stock SET quantity_g=quantity_g+$3,version=version+1,updated_at=now() WHERE household_id=$1 AND food_id=$2', [householdId,movement.foodId,movement.quantityG]);
      await client.query(
        "INSERT INTO ingredient_stock_movements(id,household_id,food_id,delta_g,reason,stock_lot_id) VALUES ($1,$2,$3,$4,'production-cancelled',$5)",
        [randomUUID(),householdId,movement.foodId,movement.quantityG,lotId]);
    }
    await client.query('UPDATE recipe_stock_uses SET cancelled_at=now() WHERE stock_lot_id=$1 AND cancelled_at IS NULL',[lotId]);
    await client.query('UPDATE stock_lots SET cancelled_at=now() WHERE id=$1 OR parent_lot_id=$1', [lotId]);
    await client.query('COMMIT');
    return { cancelled:true,restored:movements.rows.map(row=>({...row,quantityG:Number(row.quantityG)})) };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

export async function listStock(pool, householdId) {
  const result = await pool.query(
    `WITH produced AS (
       SELECT recipe_id, sum(quantity) AS quantity,
              max(produced_on) AS latest_production, array_agg(DISTINCT storage) AS storage
         FROM stock_lots WHERE household_id = $1 AND cancelled_at IS NULL AND NOT is_serving_bundle GROUP BY recipe_id
     ), planned AS (
       SELECT i.recipe_id, sum(a.quantity) AS quantity
         FROM planned_meal_items i
         JOIN planned_meals m ON m.id = i.meal_id
         JOIN planned_amounts a ON a.planned_item_id = i.id
        WHERE m.household_id = $1 GROUP BY i.recipe_id
     )
     SELECT r.id AS "recipeId", r.name, r.yield_unit_id AS "unitId", r.production_type AS "productionType",
            p.quantity AS "producedQuantity", p.latest_production::text AS "latestProduction",
            p.storage, COALESCE(pl.quantity, 0) AS "plannedQuantity",
            COALESCE(p.quantity, 0) - COALESCE(pl.quantity, 0) AS "availableQuantity"
       FROM produced p
       JOIN recipes r ON r.id = p.recipe_id
       LEFT JOIN planned pl ON pl.recipe_id = r.id
      WHERE r.household_id = $1
     UNION ALL
     SELECT r.id AS "recipeId", r.name, r.yield_unit_id AS "unitId", r.production_type AS "productionType",
            0 AS "producedQuantity", NULL::text AS "latestProduction", ARRAY[]::text[] AS storage,
            pl.quantity AS "plannedQuantity", -pl.quantity AS "availableQuantity"
       FROM planned pl JOIN recipes r ON r.id = pl.recipe_id
      WHERE r.household_id = $1 AND r.production_type <> 'none' AND NOT EXISTS (SELECT 1 FROM produced p WHERE p.recipe_id = r.id)
      ORDER BY name`,
    [householdId],
  );
  const lots = await pool.query(
    `SELECT id, recipe_id AS "recipeId", produced_on::text AS "producedOn", quantity, storage, note,parent_lot_id AS "parentLotId"
     FROM stock_lots WHERE household_id=$1 AND cancelled_at IS NULL AND NOT is_serving_bundle ORDER BY produced_on DESC, created_at DESC`, [householdId]);
  const needs=await recipeRequirements(pool,householdId,'0001-01-01','9999-12-31');
  const rows=new Map(result.rows.map(row=>[row.recipeId,row]));
  for(const [id,quantity] of needs.reservations)if(!rows.has(id)){const r=needs.graph.get(id);rows.set(id,{recipeId:id,name:r.name,unitId:r.yield.unitId,productionType:r.productionType,producedQuantity:0,latestProduction:null,storage:[]});}
  return [...rows.values()].map((row) => ({
    ...row,
    lots: lots.rows.filter(lot=>lot.recipeId===row.recipeId).map(lot=>({...lot,quantity:Number(lot.quantity)})),
    producedQuantity: Number(row.producedQuantity),
    plannedQuantity: Number(row.producedQuantity)-(needs.initialStock.get(row.recipeId)??0)+(needs.reservations.get(row.recipeId)??0),
    availableQuantity: (needs.initialStock.get(row.recipeId)??0)-(needs.reservations.get(row.recipeId)??0),
  }));
}

export async function listPreparationsToMake(pool, householdId, startDate, endDate) {
  return (await recipeRequirements(pool,householdId,startDate,endDate)).preparations;
}

export async function listShoppingRequirements(pool, householdId, startDate, endDate) {
  const [requirements, stocks, settings, packages, stores, purchaseUnits] = await Promise.all([
    rawShoppingRequirements(pool,householdId,startDate,endDate),
    readIngredientStock(pool,householdId),
    pool.query(`SELECT g.food_id AS "foodId", g.unit_id AS "unitId", g.group_id AS "groupId", COALESCE(c.checked,false) AS checked
      FROM household_food_shopping_groups g LEFT JOIN household_shopping_checks c
      ON c.household_id=g.household_id AND c.food_id=g.food_id AND c.unit_id=g.unit_id AND c.period_start=$2 AND c.period_end=$3
      WHERE g.household_id=$1`, [householdId,startDate,endDate]),
    pool.query(`SELECT food_id AS "foodId", unit_id AS "unitId", package_quantity AS "packageQuantity"
      FROM household_food_purchase_packs WHERE household_id=$1`, [householdId]),
    listFoodStores(pool,householdId),
    listPurchaseUnits(pool,householdId),
  ]);
  const tracked = new Set(stocks.map(row => row.foodId));
  const items = requirements.filter(row => !tracked.has(row.foodId));
  for (const stock of stocks) {
    const projection = ingredientProjection(stock,requirements);
    if (!projection.complete) {
      // Keep the unresolved units visible; do not silently subtract grams from pieces.
      items.push(...requirements.filter(row => row.foodId===stock.foodId).map(row => ({...row,warning:'Conversion manquante : stock non déduit'})));
    } else if (projection.orderG > 0) {
      const recipes=[...new Map(requirements.filter(row=>row.foodId===stock.foodId).flatMap(row=>row.recipes??[]).map(recipe=>[recipe.id,recipe])).values()].sort((a,b)=>a.name.localeCompare(b.name));
      items.push({foodId:stock.foodId,name:stock.name,unitId:'g',quantity:projection.orderG,groupId:'whey_flour',recipes,
        warning:`Stock : ${stock.quantityG} g · besoin : ${projection.neededG} g · minimum : ${stock.minimumG} g`});
    }
  }
  return applyPurchaseUnits(applyPackageUnits(items,packages.rows),purchaseUnits).map(row => {
    const store=stores.find(item=>item.foodId===row.foodId);
    const setting = settings.rows.find(item => item.foodId===row.foodId && item.unitId===row.unitId);
    const purchasePack = packages.rows.find(item => item.foodId===row.foodId && item.unitId===row.unitId);
    const rawQuantity = Number(row.quantity);
    const packageQuantity = purchasePack ? Number(purchasePack.packageQuantity) : null;
    const quantity = packageQuantity ? Math.ceil(rawQuantity/packageQuantity)*packageQuantity : shoppingPurchaseQuantity(rawQuantity,row.unitId);
    const presented={...row,neededQuantity:rawQuantity,quantity,packageQuantity,packageCount:packageQuantity ? Math.ceil(rawQuantity/packageQuantity) : null};
    return {...presented,purchase:purchaseDescription(presented),
      purchaseRule:row.purchaseRule??null,purchaseRuleApplied:row.purchaseRuleApplied??false,
      purchaseRuleSuggestion:row.purchaseRule?null:suggestedPurchaseUnit(row),
      quantityRounded:quantity!==rawQuantity,baseGroupId:setting?.groupId ?? row.groupId ?? 'bulk',
      groupId:store?'whey_flour':setting?.groupId ?? row.groupId ?? 'bulk',
      store:store?{id:store.orderLinkId,label:store.label,url:store.url,homeAssistantEntityId:store.homeAssistantEntityId}:null,
      checked:row.sourceUnitIds?.length
        ? row.sourceUnitIds.every(unitId=>settings.rows.find(item=>item.foodId===row.foodId&&item.unitId===unitId)?.checked??false)
        : setting?.checked ?? false};
  }).sort((a,b)=>a.groupId.localeCompare(b.groupId)||a.name.localeCompare(b.name));
}

export function shoppingPurchaseQuantity(quantity, unitId) {
  return unitId === 'piece' ? Math.ceil(quantity) : quantity;
}

export function validateShoppingLineState(input) {
  if (!input || typeof input !== 'object' || !isUuid(input.householdId) || !isUuid(input.foodId)
    || !isDate(input.startDate) || !isDate(input.endDate) || input.endDate < input.startDate
    || typeof input.unitId !== 'string' || !/^[a-z][a-z0-9_-]{0,30}$/.test(input.unitId)
    || !shoppingGroups.has(input.groupId) || typeof input.checked !== 'boolean'
    || (Object.hasOwn(input,'packageQuantity') && input.packageQuantity !== null
      && (typeof input.packageQuantity !== 'number' || !Number.isFinite(input.packageQuantity) || input.packageQuantity <= 0 || input.packageQuantity > 100000000))) return { error: 'invalid-shopping-line' };
  return { data: input };
}

export async function saveShoppingLineState(pool, input) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO household_food_shopping_groups (household_id, food_id, unit_id, group_id)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (household_id, food_id, unit_id) DO UPDATE
         SET group_id = EXCLUDED.group_id, updated_at = now()`,
      [input.householdId, input.foodId, input.unitId, input.groupId],
    );
    await client.query(
      `INSERT INTO household_shopping_checks (household_id, period_start, period_end, food_id, unit_id, checked)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (household_id, period_start, period_end, food_id, unit_id) DO UPDATE
         SET checked = EXCLUDED.checked, updated_at = now()`,
      [input.householdId, input.startDate, input.endDate, input.foodId, input.unitId, input.checked],
    );
    if (Object.hasOwn(input,'packageQuantity')) {
      if (input.packageQuantity === null) {
        await client.query('DELETE FROM household_food_purchase_packs WHERE household_id=$1 AND food_id=$2 AND unit_id=$3',
          [input.householdId,input.foodId,input.unitId]);
      } else {
        await client.query(`INSERT INTO household_food_purchase_packs (household_id,food_id,unit_id,package_quantity)
          VALUES ($1,$2,$3,$4) ON CONFLICT (household_id,food_id,unit_id) DO UPDATE
          SET package_quantity=EXCLUDED.package_quantity,updated_at=now()`,
          [input.householdId,input.foodId,input.unitId,input.packageQuantity]);
      }
    }
    await client.query('COMMIT');
    return { saved: true };
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23503') return { error: 'food-not-found' };
    throw error;
  } finally { client.release(); }
}

function isUuid(value) { return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value); }
function isDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
