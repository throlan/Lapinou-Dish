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
  const alert = stock.quantityG <= stock.minimumG || projectedG <= stock.minimumG;
  return { ...stock,neededG,projectedG,complete,alert,
    orderG: Math.max(0, neededG + stock.minimumG - stock.quantityG, alert ? stock.targetG-stock.quantityG : 0),
  };
}

export async function listIngredientStock(pool, householdId) {
  const stocks = await readIngredientStock(pool, householdId);
  const today = (await pool.query('SELECT CURRENT_DATE::text AS today')).rows[0].today;
  const requirements = new Map();
  for (const days of new Set(stocks.map(row => row.leadDays))) {
    const end = new Date(today+'T12:00:00Z'); end.setUTCDate(end.getUTCDate()+days);
    requirements.set(days, await rawShoppingRequirements(pool,householdId,today,end.toISOString().slice(0,10)));
  }
  return stocks.map(stock => ingredientProjection(stock,requirements.get(stock.leadDays)));
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
