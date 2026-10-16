import { randomUUID } from 'node:crypto';
import { toGrams } from '../domain/foods.ts';
import { rawShoppingRequirements } from './shopping-requirements.mjs';

export function validateIngredientStock(input) {
  const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  const amount = value => Number.isFinite(value) && value >= 0 && value <= 100000000;
  if (!input || !uuid(input.householdId) || !uuid(input.foodId)
    || !amount(input.quantityG) || !amount(input.minimumG) || !amount(input.targetG)
    || input.targetG < input.minimumG || !Number.isInteger(input.leadDays) || input.leadDays < 0 || input.leadDays > 60
    || !Number.isInteger(input.version) || input.version < 0) return { error: 'invalid-ingredient-stock' };
  return { data: input };
}

export async function lockHouseholdInventory(client, householdId) {
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['ingredient-stock:' + householdId]);
}

export function validatePurchaseReceipt(input) {
  const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  if (!input || !uuid(input.householdId) || !uuid(input.foodId) || !uuid(input.requestId)
    || !Number.isFinite(input.quantity) || input.quantity <= 0 || input.quantity > 100000000
    || !['g','kg','ml','l','piece','tsp','tbsp','cup','pinch','scoop'].includes(input.unitId)) return {error:'invalid-purchase-receipt'};
  return {data:{householdId:input.householdId,foodId:input.foodId,requestId:input.requestId,
    quantity:input.quantity,unitId:input.unitId}};
}

export function validateProductCount(input) {
  const checked=validatePurchaseReceipt({...input,quantity:input?.quantity===0?1:input?.quantity,
    requestId:'11111111-1111-4111-8111-111111111111'});
  if(checked.error || !Number.isFinite(input.quantity) || input.quantity<0
    || !Number.isInteger(input.version) || input.version<0)return {error:'invalid-product-count'};
  return {data:{householdId:input.householdId,foodId:input.foodId,quantity:input.quantity,
    unitId:input.unitId,version:input.version}};
}

async function foodMassDetails(client,foodId) {
  const food=await client.query(`SELECT f.grams_per_millilitre AS "gramsPerMillilitre",
    COALESCE((SELECT jsonb_object_agg(unit_id,grams_per_unit) FROM food_unit_conversions WHERE food_id=f.id),'{}'::jsonb) AS "gramsPerUnit"
    FROM foods f WHERE f.id=$1`,[foodId]);
  if(!food.rowCount)return null;
  const row=food.rows[0];
  return {gramsPerMillilitre:row.gramsPerMillilitre==null?null:Number(row.gramsPerMillilitre),
    gramsPerUnit:Object.fromEntries(Object.entries(row.gramsPerUnit).map(([unit,value])=>[unit,Number(value)]))};
}

export async function countProductInventory(pool,input) {
  const client=await pool.connect();
  try{
    await client.query('BEGIN');await lockHouseholdInventory(client,input.householdId);
    const existing=await client.query('SELECT quantity_g,version FROM household_ingredient_stock WHERE household_id=$1 AND food_id=$2 FOR UPDATE',[input.householdId,input.foodId]);
    if(Number(existing.rows[0]?.version??0)!==input.version){await client.query('ROLLBACK');return {error:'ingredient-stock-changed'};}
    const food=await foodMassDetails(client,input.foodId);
    if(!food){await client.query('ROLLBACK');return {error:'food-not-found'};}
    const grams=input.quantity===0?0:toGrams(input.quantity,input.unitId,food);
    if(grams==null){await client.query('ROLLBACK');return {error:'ingredient-conversion-missing'};}
    const quantityG=Math.round(grams*100000)/100000;
    if(quantityG>100000000){await client.query('ROLLBACK');return {error:'invalid-product-count'};}
    await client.query(`INSERT INTO household_ingredient_stock(household_id,food_id,quantity_g,minimum_g,target_g,lead_days)
      VALUES($1,$2,$3,0,0,0) ON CONFLICT(household_id,food_id) DO UPDATE SET
      quantity_g=$3,version=household_ingredient_stock.version+1,updated_at=now()`,[input.householdId,input.foodId,quantityG]);
    await client.query(`INSERT INTO ingredient_stock_movements(id,household_id,food_id,delta_g,reason,source_quantity,source_unit_id)
      VALUES($1,$2,$3,$4,'inventory',$5,$6)`,[randomUUID(),input.householdId,input.foodId,quantityG-Number(existing.rows[0]?.quantity_g??0),input.quantity,input.unitId]);
    await client.query('COMMIT');return {saved:true,quantityG};
  }catch(error){await client.query('ROLLBACK');if(error.code==='23503')return {error:'unknown-household-or-food'};throw error;}
  finally{client.release();}
}

export async function recordPurchaseReceipt(pool,input) {
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    await lockHouseholdInventory(client,input.householdId);
    const previous=await client.query(`SELECT food_id AS "foodId",source_quantity AS quantity,source_unit_id AS "unitId",delta_g AS "quantityG"
      FROM ingredient_stock_movements WHERE household_id=$1 AND request_id=$2`,[input.householdId,input.requestId]);
    if(previous.rowCount){
      const row=previous.rows[0];await client.query('ROLLBACK');
      if(row.foodId!==input.foodId || Number(row.quantity)!==input.quantity || row.unitId!==input.unitId)return {error:'purchase-request-conflict'};
      return {saved:true,replayed:true,quantityG:Number(row.quantityG)};
    }
    const food=await foodMassDetails(client,input.foodId);
    if(!food){await client.query('ROLLBACK');return {error:'food-not-found'};}
    const grams=toGrams(input.quantity,input.unitId,food);
    if(grams==null){await client.query('ROLLBACK');return {error:'ingredient-conversion-missing'};}
    const quantityG=Math.round(grams*100000)/100000;
    if(quantityG<=0 || quantityG>100000000){await client.query('ROLLBACK');return {error:'invalid-purchase-receipt'};}
    await client.query(`INSERT INTO household_ingredient_stock(household_id,food_id,quantity_g,minimum_g,target_g,lead_days)
      VALUES($1,$2,$3,0,0,0) ON CONFLICT(household_id,food_id) DO UPDATE SET
      quantity_g=household_ingredient_stock.quantity_g+$3,version=household_ingredient_stock.version+1,updated_at=now()`,
    [input.householdId,input.foodId,quantityG]);
    await client.query(`INSERT INTO ingredient_stock_movements(id,household_id,food_id,delta_g,reason,request_id,source_quantity,source_unit_id)
      VALUES($1,$2,$3,$4,'purchase',$5,$6,$7)`,
    [randomUUID(),input.householdId,input.foodId,quantityG,input.requestId,input.quantity,input.unitId]);
    await client.query('COMMIT');return {saved:true,quantityG};
  }catch(error){await client.query('ROLLBACK');if(error.code==='23503')return {error:'unknown-household-or-food'};throw error;}
  finally{client.release();}
}

export async function saveIngredientStock(pool, input) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await lockHouseholdInventory(client, input.householdId);
    const existing = await client.query('SELECT quantity_g, version FROM household_ingredient_stock WHERE household_id=$1 AND food_id=$2 FOR UPDATE', [input.householdId,input.foodId]);
    const old = existing.rows[0];
    if ((old?.version ?? 0) !== input.version) {
      await client.query('ROLLBACK'); return { error: 'ingredient-stock-changed' };
    }
    await client.query(
      `INSERT INTO household_ingredient_stock (household_id,food_id,quantity_g,minimum_g,target_g,lead_days)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (household_id,food_id) DO UPDATE SET quantity_g=$3,minimum_g=$4,target_g=$5,lead_days=$6,
         version=household_ingredient_stock.version+1,updated_at=now()`,
      [input.householdId,input.foodId,input.quantityG,input.minimumG,input.targetG,input.leadDays],
    );
    await client.query(
      `INSERT INTO ingredient_stock_movements(id,household_id,food_id,delta_g,reason) VALUES ($1,$2,$3,$4,'inventory')`,
      [randomUUID(),input.householdId,input.foodId,input.quantityG - Number(old?.quantity_g ?? 0)],
    );
    await client.query('COMMIT'); return { saved: true };
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23503') return { error: 'unknown-household-or-food' };
    throw error;
  } finally { client.release(); }
}

export async function readIngredientStock(pool, householdId) {
  const result = await pool.query(
    `SELECT s.food_id AS "foodId", f.canonical_name AS name, s.quantity_g AS "quantityG",
            s.minimum_g AS "minimumG", s.target_g AS "targetG", s.lead_days AS "leadDays", s.version
     FROM household_ingredient_stock s JOIN foods f ON f.id=s.food_id WHERE s.household_id=$1 ORDER BY f.canonical_name`, [householdId]);
  return result.rows.map(row => ({ ...row,quantityG:Number(row.quantityG),minimumG:Number(row.minimumG),targetG:Number(row.targetG) }));
}

export function ingredientProjection(stock, requirements) {
  let neededG = 0, complete = true;
  for (const row of requirements.filter(row => row.foodId === stock.foodId)) {
    const grams = toGrams(row.quantity, row.unitId, row);
    if (grams == null) complete = false; else neededG += grams;
  }
  const projectedG = stock.quantityG - neededG;
  const alert = projectedG < 0 || (stock.minimumG > 0 && projectedG <= stock.minimumG);
  return { ...stock,neededG,projectedG,complete,alert,
    orderG: Math.max(0, neededG + stock.minimumG - stock.quantityG, alert ? stock.targetG-stock.quantityG : 0),
  };
}

export async function listIngredientStock(pool, householdId) {
  const stocks = await readIngredientStock(pool, householdId);
  const history=await pool.query(`SELECT food_id AS "foodId",delta_g AS "deltaG",reason,created_at AS "createdAt",
    source_quantity AS "sourceQuantity",source_unit_id AS "sourceUnitId" FROM (
      SELECT food_id,delta_g,reason,created_at,source_quantity,source_unit_id,
        row_number() OVER (PARTITION BY food_id ORDER BY created_at DESC,id DESC) AS rank
      FROM ingredient_stock_movements WHERE household_id=$1
    ) recent WHERE rank<=5 ORDER BY created_at DESC`,[householdId]);
  const today = (await pool.query('SELECT CURRENT_DATE::text AS today')).rows[0].today;
  const requirements = new Map();
  for (const days of new Set(stocks.map(row => row.leadDays))) {
    const end = new Date(today+'T12:00:00Z'); end.setUTCDate(end.getUTCDate()+days);
    requirements.set(days, await rawShoppingRequirements(pool,householdId,today,end.toISOString().slice(0,10)));
  }
  return stocks.map(stock => ({...ingredientProjection(stock,requirements.get(stock.leadDays)),
    movements:history.rows.filter(row=>row.foodId===stock.foodId).map(row=>({...row,deltaG:Number(row.deltaG),
      sourceQuantity:row.sourceQuantity==null?null:Number(row.sourceQuantity)}))}));
}

// Aggregate duplicate ingredient lines and use the same documented conversions
// as nutrition. Never assume that 1 ml or one piece weighs one gram.
export function productionDeductions(lines, quantity, yieldAmount) {
  const deductions = new Map();
  for (const line of lines) {
    const grams = toGrams(Number(line.quantity) * quantity / yieldAmount, line.unitId, {
      gramsPerMillilitre: line.gramsPerMillilitre == null ? null : Number(line.gramsPerMillilitre),
      gramsPerUnit: Object.fromEntries(Object.entries(line.gramsPerUnit ?? {}).map(([key,value]) => [key,Number(value)])),
    });
    if (grams == null) return { error: 'ingredient-conversion-missing', name: line.name };
    const previous = deductions.get(line.foodId);
    deductions.set(line.foodId,{foodId:line.foodId,name:line.name,quantityG:Number(line.quantityG),usedG:(previous?.usedG ?? 0)+grams});
  }
  const items = [...deductions.values()].map(row => ({...row,usedG: Math.round(row.usedG * 100000)/100000}));
  const insufficient = items.find(row => row.usedG > row.quantityG);
  return insufficient ? {error:'ingredient-stock-insufficient',name:insufficient.name,requiredG:insufficient.usedG,availableG:insufficient.quantityG} : {items};
}
