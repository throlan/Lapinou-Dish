import { randomUUID } from 'node:crypto';
import { readRecipe } from './recipes.mjs';
import { lockHouseholdInventory } from './ingredient-stock.mjs';

const slots = new Set(['breakfast', 'lunch', 'dinner', 'snack', 'evening_snack']);

export function validatePlannedMeal(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'invalid-body' };
  if (!isUuid(input.householdId)) return { error: 'invalid-household-id' };
  if (!isDate(input.mealDate)) return { error: 'invalid-meal-date' };
  if (!slots.has(input.slot)) return { error: 'invalid-meal-slot' };
  const notes = typeof input.notes === 'string' ? input.notes.trim() : '';
  if (notes.length > 1000) return { error: 'notes-too-long' };
  const isOccasion = input.isOccasion === true;
  const occasionTitle = typeof input.occasionTitle === 'string' ? input.occasionTitle.trim() : '';
  if (isOccasion && (!occasionTitle || occasionTitle.length > 200)) return { error: 'occasion-title-required' };
  if (!Array.isArray(input.attendeeIds) || input.attendeeIds.length < 1 || input.attendeeIds.length > 30) return { error: 'attendees-required' };
  const attendeeIds = [...new Set(input.attendeeIds)];
  if (attendeeIds.length !== input.attendeeIds.length || attendeeIds.some((id) => !isUuid(id))) return { error: 'invalid-attendee-ids' };
  if (!Array.isArray(input.items) || input.items.length > 30 || (!isOccasion && input.items.length < 1) || (isOccasion && input.items.length)) return { error: isOccasion ? 'occasion-cannot-have-recipes' : 'planned-items-required' };
  const occasionEnergy = [];
  if (isOccasion) {
    if (!Array.isArray(input.occasionEnergy) || input.occasionEnergy.length !== attendeeIds.length) return { error: 'occasion-energy-required' };
    const seenEnergy = new Set();
    for (const entry of input.occasionEnergy) {
      const kcal = Number(entry?.kcal);
      if (!isUuid(entry?.personId) || !attendeeIds.includes(entry.personId) || seenEnergy.has(entry.personId) || !Number.isFinite(kcal) || kcal < 0 || kcal > 100000) return { error: 'invalid-occasion-energy' };
      seenEnergy.add(entry.personId); occasionEnergy.push({ personId: entry.personId, kcal });
    }
  }
  const items = [];
  for (const item of input.items) {
    if (!item || !isUuid(item.recipeId) || !Array.isArray(item.amounts)) return { error: 'invalid-planned-item' };
    const role = item.role ?? 'main';
    if (!['main', 'accompaniment', 'beverage', 'dessert', 'sauce'].includes(role)) return { error: 'invalid-planned-item-role' };
    const optional = ['beverage','dessert','sauce'].includes(role);
    if (!optional && item.amounts.length !== attendeeIds.length) return { error: 'amounts-must-match-attendees' };
    if (optional && (item.amounts.length < 1 || item.amounts.length > attendeeIds.length)) return { error: `invalid-${role}-amounts` };
    const seen = new Set();
    const amounts = [];
    for (const amount of item.amounts) {
      if (!amount || !isUuid(amount.personId) || !attendeeIds.includes(amount.personId) || seen.has(amount.personId)) return { error: 'invalid-planned-amount-person' };
      const quantity = Number(amount.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100000) return { error: 'invalid-planned-quantity' };
      seen.add(amount.personId);
      amounts.push({ personId: amount.personId, quantity });
    }
    if (!optional && seen.size !== attendeeIds.length) return { error: 'amounts-must-match-attendees' };
    items.push({ recipeId: item.recipeId, role, amounts });
  }
  return { data: { householdId: input.householdId, mealDate: input.mealDate, slot: input.slot, notes, attendeeIds, items, isOccasion, occasionTitle, occasionEnergy } };
}

export async function listPlannedMeals(pool, householdId, weekStart) {
  const result = await pool.query(
    'SELECT id, meal_date::text AS meal_date, slot, notes, is_occasion, occasion_title, prepared_at FROM planned_meals WHERE household_id = $1 AND meal_date >= $2::date AND meal_date < $2::date + 7 ORDER BY meal_date, CASE slot WHEN \'breakfast\' THEN 1 WHEN \'lunch\' THEN 2 WHEN \'snack\' THEN 3 WHEN \'dinner\' THEN 4 ELSE 5 END, created_at',
    [householdId, weekStart],
  );
  const meals = [];
  for (const row of result.rows) meals.push(await readPlannedMeal(pool, row, householdId));
  return meals;
}

export async function listPlannedRecipeIds(pool, householdId, fromDate) {
  const result = await pool.query(
    `SELECT DISTINCT COALESCE(r.parent_recipe_id,r.id) AS recipe_id
     FROM planned_meals m
     JOIN planned_meal_items i ON i.meal_id=m.id
     JOIN recipes r ON r.id=i.recipe_id AND r.household_id=m.household_id
     WHERE m.household_id=$1 AND m.meal_date >= $2::date
     ORDER BY recipe_id`,
    [householdId, fromDate],
  );
  return result.rows.map(row => row.recipe_id);
}

export async function savePlannedMeal(pool, id, data) {
  const client = await pool.connect();
  const mealId = id ?? randomUUID();
  try {
    await client.query('BEGIN');
    await lockHouseholdInventory(client,data.householdId);
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
    const normalizedItems = [];
    for (const item of data.items) {
      const recipe = await client.query('SELECT id,yield_amount,separate_starch FROM recipes WHERE id=$1',[item.recipeId]);
      if (recipe.rows[0]?.separate_starch) {
        const parts = await client.query('SELECT id,serving_part,yield_amount FROM recipes WHERE parent_recipe_id=$1',[item.recipeId]);
        if (!parts.rows.length) { await client.query('ROLLBACK'); return {error:'serving-parts-missing'}; }
        for (const part of parts.rows) normalizedItems.push({recipeId:part.id,role:part.serving_part !== 'main' ? 'accompaniment' : item.role,amounts:item.amounts.map(amount=>({personId:amount.personId,quantity:amount.quantity/Number(recipe.rows[0].yield_amount)*Number(part.yield_amount)}))});
      } else normalizedItems.push(item);
    }
    if (normalizedItems.some(item=>item.amounts.some(amount=>!Number.isFinite(amount.quantity) || amount.quantity > 100000))) { await client.query('ROLLBACK'); return {error:'invalid-planned-quantity'}; }
    if (id) {
      const existing=await client.query('SELECT prepared_at FROM planned_meals WHERE id=$1 AND household_id=$2 FOR UPDATE',[id,data.householdId]);
      if(existing.rows[0]?.prepared_at){await client.query('ROLLBACK');return {error:'prepared-meal-locked'};}
      const updated = await client.query(
        'UPDATE planned_meals SET meal_date = $3, slot = $4, notes = $5, is_occasion=$6, occasion_title=$7, updated_at = now() WHERE id = $1 AND household_id = $2 RETURNING id',
        [id, data.householdId, data.mealDate, data.slot, data.notes, data.isOccasion ?? false, data.occasionTitle ?? ''],
      );
      if (!updated.rowCount) { await client.query('ROLLBACK'); return null; }
      await client.query('DELETE FROM planned_meal_attendees WHERE meal_id = $1', [id]);
      await client.query('DELETE FROM planned_meal_items WHERE meal_id = $1', [id]);
      await client.query('DELETE FROM planned_occasion_energy WHERE meal_id=$1',[id]);
    } else {
      await client.query(
        'INSERT INTO planned_meals (id, household_id, meal_date, slot, notes, is_occasion, occasion_title) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [mealId, data.householdId, data.mealDate, data.slot, data.notes, data.isOccasion ?? false, data.occasionTitle ?? ''],
      );
    }
    for (const personId of data.attendeeIds) {
      await client.query('INSERT INTO planned_meal_attendees (meal_id, person_id) VALUES ($1,$2)', [mealId, personId]);
    }
    for (const entry of data.occasionEnergy ?? []) await client.query('INSERT INTO planned_occasion_energy(meal_id,person_id,energy_kcal) VALUES($1,$2,$3)',[mealId,entry.personId,entry.kcal]);
    for (const [index, item] of normalizedItems.entries()) {
      const itemId = randomUUID();
      await client.query('INSERT INTO planned_meal_items (id, meal_id, recipe_id, sort_order, role) VALUES ($1,$2,$3,$4,$5)', [itemId, mealId, item.recipeId, index, item.role]);
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
  const result = await pool.query('DELETE FROM planned_meals WHERE id = $1 AND household_id = $2 AND prepared_at IS NULL RETURNING id', [id, householdId]);
  if(result.rowCount)return true;
  const existing=await pool.query('SELECT prepared_at FROM planned_meals WHERE id=$1 AND household_id=$2',[id,householdId]);
  return existing.rows[0]?.prepared_at?{error:'prepared-meal-locked'}:false;
}

export function validateMealDuplication(input) {
  if (!input || !isUuid(input.householdId) || !isUuid(input.requestId)
    || !slots.has(input.slot) || !Array.isArray(input.dates) || !input.dates.length || input.dates.length > 62
    || input.dates.some(date=>!isDate(date)) || new Set(input.dates).size !== input.dates.length) return { error:'invalid-meal-duplication' };
  return {data:{householdId:input.householdId,requestId:input.requestId,slot:input.slot,dates:[...input.dates].sort()}};
}

export async function duplicatePlannedMeal(pool, sourceId, input) {
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    await lockHouseholdInventory(client,input.householdId);
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',['meal-copy:'+input.householdId+':'+input.requestId]);
    const previous=await client.query('SELECT source_meal_id, target_dates::text[] AS dates, slot, meal_ids FROM planned_meal_duplications WHERE household_id=$1 AND request_id=$2',[input.householdId,input.requestId]);
    if(previous.rowCount){
      const saved=previous.rows[0];await client.query('ROLLBACK');
      if(saved.source_meal_id!==sourceId || saved.slot!==input.slot || JSON.stringify(saved.dates)!==JSON.stringify(input.dates))return {error:'duplication-request-conflict'};
      return {mealIds:saved.meal_ids,replayed:true};
    }
    const source=await client.query('SELECT meal_date::text AS date, slot, notes, is_occasion, occasion_title FROM planned_meals WHERE id=$1 AND household_id=$2 FOR SHARE',[sourceId,input.householdId]);
    if(!source.rowCount){await client.query('ROLLBACK');return {error:'source-meal-not-found'};}
    if(input.slot===source.rows[0].slot && input.dates.includes(source.rows[0].date)){
      await client.query('ROLLBACK');return {error:'source-date-selected'};
    }
    const items=await client.query('SELECT id,recipe_id,sort_order,role FROM planned_meal_items WHERE meal_id=$1 ORDER BY sort_order',[sourceId]);
    const mealIds=[];
    for(const date of input.dates){
      const id=randomUUID();mealIds.push(id);
      await client.query('INSERT INTO planned_meals(id,household_id,meal_date,slot,notes,is_occasion,occasion_title) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,input.householdId,date,input.slot,source.rows[0].notes,source.rows[0].is_occasion,source.rows[0].occasion_title]);
      await client.query('INSERT INTO planned_meal_attendees(meal_id,person_id) SELECT $1,person_id FROM planned_meal_attendees WHERE meal_id=$2',[id,sourceId]);
      if(source.rows[0].is_occasion)await client.query('INSERT INTO planned_occasion_energy(meal_id,person_id,energy_kcal) SELECT $1,person_id,energy_kcal FROM planned_occasion_energy WHERE meal_id=$2',[id,sourceId]);
      for(const item of items.rows){
        const newId=randomUUID();
        await client.query('INSERT INTO planned_meal_items(id,meal_id,recipe_id,sort_order,role) VALUES($1,$2,$3,$4,$5)',[newId,id,item.recipe_id,item.sort_order,item.role]);
        await client.query('INSERT INTO planned_amounts(planned_item_id,person_id,quantity) SELECT $1,person_id,quantity FROM planned_amounts WHERE planned_item_id=$2',[newId,item.id]);
      }
    }
    await client.query('INSERT INTO planned_meal_duplications(household_id,request_id,source_meal_id,target_dates,slot,meal_ids) VALUES($1,$2,$3,$4,$5,$6)',[input.householdId,input.requestId,sourceId,input.dates,input.slot,mealIds]);
    await client.query('COMMIT');return {mealIds};
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}

async function readPlannedMeal(client, meal, householdId) {
  let row = meal;
  if (meal.meal_date == null) {
    const result = await client.query('SELECT id, meal_date::text AS meal_date, slot, notes, is_occasion, occasion_title, prepared_at FROM planned_meals WHERE id = $1 AND household_id = $2', [meal.id, householdId]);
    row = result.rows[0];
  }
  if (!row) return null;
  const [attendeesResult, itemsResult] = await Promise.all([
    client.query(
      'SELECT p.id, p.display_name FROM planned_meal_attendees a JOIN people p ON p.id = a.person_id WHERE a.meal_id = $1 ORDER BY p.display_name',
      [row.id],
    ),
    client.query('SELECT id, recipe_id, role FROM planned_meal_items WHERE meal_id = $1 ORDER BY sort_order', [row.id]),
  ]);
  const items = [];
  for (const item of itemsResult.rows) {
    const [recipe, amounts] = await Promise.all([
      readRecipe(client, item.recipe_id),
      client.query('SELECT person_id, quantity FROM planned_amounts WHERE planned_item_id = $1', [item.id]),
    ]);
    items.push({
      recipeId: item.recipe_id, role: item.role ?? 'main', recipe,
      amounts: amounts.rows.map((amount) => ({ personId: amount.person_id, quantity: Number(amount.quantity) })),
    });
  }
  const occasionEnergy = row.is_occasion ? (await client.query('SELECT person_id,energy_kcal FROM planned_occasion_energy WHERE meal_id=$1',[row.id])).rows.map((entry)=>({personId:entry.person_id,kcal:Number(entry.energy_kcal)})) : [];
  return {
    id: row.id, mealDate: typeof row.meal_date === 'string' ? row.meal_date.slice(0, 10) : row.meal_date.toISOString().slice(0, 10),
    slot: row.slot, notes: row.notes, isOccasion: Boolean(row.is_occasion), occasionTitle: row.occasion_title ?? '', occasionEnergy,
    preparedAt:row.prepared_at??null,
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
