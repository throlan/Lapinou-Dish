import { randomUUID } from 'node:crypto';
import { readRecipe } from './recipes.mjs';

const slots = new Set(['breakfast', 'lunch', 'dinner', 'snack']);

export function validatePlannedMeal(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'invalid-body' };
  if (!isUuid(input.householdId)) return { error: 'invalid-household-id' };
  if (!isDate(input.mealDate)) return { error: 'invalid-meal-date' };
  if (!slots.has(input.slot)) return { error: 'invalid-meal-slot' };
  const notes = typeof input.notes === 'string' ? input.notes.trim() : '';
  if (notes.length > 1000) return { error: 'notes-too-long' };
  if (!Array.isArray(input.attendeeIds) || input.attendeeIds.length < 1 || input.attendeeIds.length > 30) return { error: 'attendees-required' };
  const attendeeIds = [...new Set(input.attendeeIds)];
  if (attendeeIds.length !== input.attendeeIds.length || attendeeIds.some((id) => !isUuid(id))) return { error: 'invalid-attendee-ids' };
  if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 30) return { error: 'planned-items-required' };
  const items = [];
  for (const item of input.items) {
    if (!item || !isUuid(item.recipeId) || !Array.isArray(item.amounts)) return { error: 'invalid-planned-item' };
    if (item.amounts.length !== attendeeIds.length) return { error: 'amounts-must-match-attendees' };
    const seen = new Set();
    const amounts = [];
    for (const amount of item.amounts) {
      if (!amount || !isUuid(amount.personId) || !attendeeIds.includes(amount.personId) || seen.has(amount.personId)) return { error: 'invalid-planned-amount-person' };
      const quantity = Number(amount.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100000) return { error: 'invalid-planned-quantity' };
      seen.add(amount.personId);
      amounts.push({ personId: amount.personId, quantity });
    }
    if (seen.size !== attendeeIds.length) return { error: 'amounts-must-match-attendees' };
    items.push({ recipeId: item.recipeId, amounts });
  }
  return { data: { householdId: input.householdId, mealDate: input.mealDate, slot: input.slot, notes, attendeeIds, items } };
}

export async function listPlannedMeals(pool, householdId, weekStart) {
  const result = await pool.query(
    'SELECT id, meal_date, slot, notes FROM planned_meals WHERE household_id = $1 AND meal_date >= $2::date AND meal_date < $2::date + 7 ORDER BY meal_date, CASE slot WHEN \'breakfast\' THEN 1 WHEN \'lunch\' THEN 2 WHEN \'dinner\' THEN 3 ELSE 4 END, created_at',
    [householdId, weekStart],
  );
  const meals = [];
  for (const row of result.rows) meals.push(await readPlannedMeal(pool, row, householdId));
  return meals;
}

export async function savePlannedMeal(pool, id, data) {
  const client = await pool.connect();
  const mealId = id ?? randomUUID();
  try {
    await client.query('BEGIN');
    const people = await client.query(
      'SELECT id FROM people WHERE household_id = $1 AND active = true AND id = ANY($2::uuid[])',
      [data.householdId, data.attendeeIds],
    );
    if (people.rowCount !== data.attendeeIds.length) {
      await client.query('ROLLBACK');
      return { error: 'attendee-not-in-household' };
    }
    const recipes = await client.query(
      'SELECT id FROM recipes WHERE household_id = $1 AND id = ANY($2::uuid[])',
      [data.householdId, [...new Set(data.items.map((item) => item.recipeId))]],
    );
    if (recipes.rowCount !== new Set(data.items.map((item) => item.recipeId)).size) {
      await client.query('ROLLBACK');
      return { error: 'recipe-not-in-household' };
    }
    if (id) {
      const updated = await client.query(
        'UPDATE planned_meals SET meal_date = $3, slot = $4, notes = $5, updated_at = now() WHERE id = $1 AND household_id = $2 RETURNING id',
        [id, data.householdId, data.mealDate, data.slot, data.notes],
      );
      if (!updated.rowCount) { await client.query('ROLLBACK'); return null; }
      await client.query('DELETE FROM planned_meal_attendees WHERE meal_id = $1', [id]);
      await client.query('DELETE FROM planned_meal_items WHERE meal_id = $1', [id]);
    } else {
      await client.query(
        'INSERT INTO planned_meals (id, household_id, meal_date, slot, notes) VALUES ($1,$2,$3,$4,$5)',
        [mealId, data.householdId, data.mealDate, data.slot, data.notes],
      );
    }
    for (const personId of data.attendeeIds) {
      await client.query('INSERT INTO planned_meal_attendees (meal_id, person_id) VALUES ($1,$2)', [mealId, personId]);
    }
    for (const [index, item] of data.items.entries()) {
      const itemId = randomUUID();
      await client.query('INSERT INTO planned_meal_items (id, meal_id, recipe_id, sort_order) VALUES ($1,$2,$3,$4)', [itemId, mealId, item.recipeId, index]);
      for (const amount of item.amounts) {
        await client.query('INSERT INTO planned_amounts (planned_item_id, person_id, quantity) VALUES ($1,$2,$3)', [itemId, amount.personId, amount.quantity]);
      }
    }
    const saved = await readPlannedMeal(client, { id: mealId }, data.householdId);
    await client.query('COMMIT');
    return saved;
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23503') return { error: 'invalid-planned-reference' };
    throw error;
  } finally {
    client.release();
  }
}

export async function deletePlannedMeal(pool, id, householdId) {
  const result = await pool.query('DELETE FROM planned_meals WHERE id = $1 AND household_id = $2 RETURNING id', [id, householdId]);
  return Boolean(result.rowCount);
}

async function readPlannedMeal(client, meal, householdId) {
  let row = meal;
  if (meal.meal_date == null) {
    const result = await client.query('SELECT id, meal_date, slot, notes FROM planned_meals WHERE id = $1 AND household_id = $2', [meal.id, householdId]);
    row = result.rows[0];
  }
  if (!row) return null;
  const [attendeesResult, itemsResult] = await Promise.all([
    client.query(
      'SELECT p.id, p.display_name FROM planned_meal_attendees a JOIN people p ON p.id = a.person_id WHERE a.meal_id = $1 ORDER BY p.display_name',
      [row.id],
    ),
    client.query('SELECT id, recipe_id FROM planned_meal_items WHERE meal_id = $1 ORDER BY sort_order', [row.id]),
  ]);
  const items = [];
  for (const item of itemsResult.rows) {
    const [recipe, amounts] = await Promise.all([
      readRecipe(client, item.recipe_id),
      client.query('SELECT person_id, quantity FROM planned_amounts WHERE planned_item_id = $1', [item.id]),
    ]);
    items.push({
      recipeId: item.recipe_id, recipe,
      amounts: amounts.rows.map((amount) => ({ personId: amount.person_id, quantity: Number(amount.quantity) })),
    });
  }
  return {
    id: row.id, mealDate: typeof row.meal_date === 'string' ? row.meal_date.slice(0, 10) : row.meal_date.toISOString().slice(0, 10),
    slot: row.slot, notes: row.notes,
    attendees: attendeesResult.rows.map((person) => ({ id: person.id, displayName: person.display_name })),
    items,
  };
}

function isUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
function isDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
