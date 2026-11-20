import {randomUUID} from 'node:crypto';
import {lockHouseholdInventory} from './ingredient-stock.mjs';
import {readPlannedMeal} from './planning.mjs';
import {plannedMacro} from '../../web/day-meals.js';

export async function readHomeConsumption(pool, householdId, personId, date) {
  const {rows} = await pool.query(`SELECT c.meals,c.revision FROM person_daily_home_consumption c
    JOIN people p ON p.id=c.person_id WHERE p.household_id=$1 AND p.id=$2 AND c.consumption_date=$3`,
  [householdId, personId, date]);
  return rows[0] ?? {meals:[], revision:null};
}

export async function saveHomeConsumption(pool, householdId, personId, date, mealIds, revision) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await lockHouseholdInventory(client, householdId);
    const person = await client.query('SELECT id FROM people WHERE id=$1 AND household_id=$2 FOR UPDATE', [personId, householdId]);
    if (!person.rows.length) {
      await client.query('ROLLBACK');
      return {error:'person-not-found'};
    }
    const previous = await readHomeConsumption(client, householdId, personId, date);
    if (previous.revision !== revision) {
      await client.query('ROLLBACK');
      return {error:'consumption-changed'};
    }
    const meals = [];
    for (const id of mealIds) {
      const confirmed = previous.meals.find(meal => meal.id === id);
      if (confirmed) { meals.push(confirmed); continue; }
      const meal = await readPlannedMeal(client, {id}, householdId);
      if (!meal || meal.mealDate !== date || meal.isOccasion || !meal.attendees.some(person => person.id === personId)
        || !meal.items.some(item => item.amounts.some(amount => amount.personId === personId && amount.quantity > 0))) {
        await client.query('ROLLBACK');
        return {error:'meal-not-confirmable'};
      }
      meals.push({
        id, slot:meal.slot,
        name:meal.items.filter(item => item.amounts.some(amount => amount.personId === personId && amount.quantity > 0))
          .map(item => item.recipe?.name ?? 'Recette supprimée').join(' · '),
        carbohydrate:plannedMacro([meal], personId, date, 'carbohydrateG'),
        fat:plannedMacro([meal], personId, date, 'fatG')
      });
    }
    const nextRevision = randomUUID();
    await client.query(`INSERT INTO person_daily_home_consumption(person_id,consumption_date,meals,revision)
      VALUES($1,$2,$3::jsonb,$4) ON CONFLICT(person_id,consumption_date)
      DO UPDATE SET meals=excluded.meals,revision=excluded.revision`, [personId,date,JSON.stringify(meals),nextRevision]);
    await client.query('COMMIT');
    return {meals, revision:nextRevision};
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
