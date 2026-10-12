import { randomUUID } from 'node:crypto';

const routineDefaults = [
  ['bulk_shopping', 'monthly'],
  ['fresh_shopping', 'weekly'],
  ['whey_flour_order', 'monthly'],
  ['pasta_pastry_production', 'monthly'],
  ['bread_production', 'monthly'],
  ['batch_cooking', 'weekly'],
];
const frequencies = new Set(['weekly', 'biweekly', 'monthly']);
const productionTypes = new Set(['batch_cooking', 'pasta', 'pastry', 'bread']);
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
  if (!input || typeof input !== 'object' || !isUuid(input.householdId) || !isUuid(input.recipeId)
    || !productionTypes.has(input.productionType) || !isDate(input.producedOn)
    || !Number.isFinite(input.quantity) || input.quantity <= 0 || input.quantity > 100000
    || !storageTypes.has(input.storage ?? 'freezer')
    || (input.note != null && (typeof input.note !== 'string' || input.note.length > 500))) return { error: 'invalid-production' };
  return { data: {
    householdId: input.householdId, recipeId: input.recipeId, productionType: input.productionType,
    producedOn: input.producedOn, quantity: input.quantity, storage: input.storage ?? 'freezer',
    note: typeof input.note === 'string' ? input.note.trim() : '',
  } };
}

export async function addStockLot(pool, input) {
  const client = await pool.connect();
  const id = randomUUID();
  try {
    const recipe = await client.query(
      'SELECT id, yield_unit_id FROM recipes WHERE id = $1 AND household_id = $2',
      [input.recipeId, input.householdId],
    );
    if (!recipe.rowCount) return { error: 'recipe-not-found' };
    await client.query(
      `INSERT INTO stock_lots (id, household_id, recipe_id, production_type, produced_on, quantity, storage, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, input.householdId, input.recipeId, input.productionType, input.producedOn, input.quantity, input.storage, input.note],
    );
    return { id, recipeId: input.recipeId, productionType: input.productionType, producedOn: input.producedOn, quantity: input.quantity, unitId: recipe.rows[0].yield_unit_id, storage: input.storage, note: input.note };
  } catch (error) {
    if (error.code === '23503') return { error: 'recipe-not-found' };
    throw error;
  } finally { client.release(); }
}

export async function listStock(pool, householdId) {
  const result = await pool.query(
    `WITH produced AS (
       SELECT recipe_id, production_type, sum(quantity) AS quantity,
              max(produced_on) AS latest_production, array_agg(DISTINCT storage) AS storage
         FROM stock_lots WHERE household_id = $1 GROUP BY recipe_id, production_type
     ), planned AS (
       SELECT i.recipe_id, sum(a.quantity) AS quantity
         FROM planned_meal_items i
         JOIN planned_meals m ON m.id = i.meal_id
         JOIN planned_amounts a ON a.planned_item_id = i.id
        WHERE m.household_id = $1 GROUP BY i.recipe_id
     )
     SELECT r.id AS "recipeId", r.name, r.yield_unit_id AS "unitId", p.production_type AS "productionType",
            p.quantity AS "producedQuantity", p.latest_production::text AS "latestProduction",
            p.storage, COALESCE(pl.quantity, 0) AS "plannedQuantity",
            COALESCE(p.quantity, 0) - COALESCE(pl.quantity, 0) AS "availableQuantity"
       FROM produced p
       JOIN recipes r ON r.id = p.recipe_id
       LEFT JOIN planned pl ON pl.recipe_id = r.id
      WHERE r.household_id = $1
     UNION ALL
     SELECT r.id AS "recipeId", r.name, r.yield_unit_id AS "unitId", 'batch_cooking' AS "productionType",
            0 AS "producedQuantity", NULL::text AS "latestProduction", ARRAY[]::text[] AS storage,
            pl.quantity AS "plannedQuantity", -pl.quantity AS "availableQuantity"
       FROM planned pl JOIN recipes r ON r.id = pl.recipe_id
      WHERE r.household_id = $1 AND NOT EXISTS (SELECT 1 FROM produced p WHERE p.recipe_id = r.id)
      ORDER BY name`,
    [householdId],
  );
  return result.rows.map((row) => ({
    ...row,
    producedQuantity: Number(row.producedQuantity),
    plannedQuantity: Number(row.plannedQuantity),
    availableQuantity: Number(row.availableQuantity),
  }));
}

export async function listShoppingRequirements(pool, householdId, startDate, endDate) {
  const result = await pool.query(
    `SELECT f.id AS "foodId", f.canonical_name AS name, rl.unit_id AS "unitId",
            sum(rl.quantity * a.quantity / r.yield_amount) AS quantity,
            COALESCE(g.group_id, 'bulk') AS "groupId", COALESCE(c.checked, false) AS checked
       FROM planned_meals m
       JOIN planned_meal_items i ON i.meal_id = m.id
       JOIN planned_amounts a ON a.planned_item_id = i.id
       JOIN recipes r ON r.id = i.recipe_id
       JOIN recipe_lines rl ON rl.recipe_id = r.id
       JOIN foods f ON f.id = rl.food_id
       LEFT JOIN household_food_shopping_groups g
         ON g.household_id = m.household_id AND g.food_id = f.id AND g.unit_id = rl.unit_id
       LEFT JOIN household_shopping_checks c
         ON c.household_id = m.household_id AND c.period_start = $2 AND c.period_end = $3
        AND c.food_id = f.id AND c.unit_id = rl.unit_id
      WHERE m.household_id = $1 AND m.meal_date BETWEEN $2::date AND $3::date
      GROUP BY f.id, f.canonical_name, rl.unit_id, g.group_id, c.checked
      ORDER BY group_id, name, unit_id`,
    [householdId, startDate, endDate],
  );
  return result.rows.map((row) => ({ ...row, quantity: Number(row.quantity) }));
}

export function validateShoppingLineState(input) {
  if (!input || typeof input !== 'object' || !isUuid(input.householdId) || !isUuid(input.foodId)
    || !isDate(input.startDate) || !isDate(input.endDate) || input.endDate < input.startDate
    || typeof input.unitId !== 'string' || !/^[a-z][a-z0-9_-]{0,30}$/.test(input.unitId)
    || !shoppingGroups.has(input.groupId) || typeof input.checked !== 'boolean') return { error: 'invalid-shopping-line' };
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
