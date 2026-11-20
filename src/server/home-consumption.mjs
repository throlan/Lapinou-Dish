import {randomUUID} from 'node:crypto';
import {lockHouseholdInventory} from './ingredient-stock.mjs';
import {readPlannedMeal} from './planning.mjs';
import {consumptionParts, itemMacro, confirmedMacro} from '../../web/day-meals.js';

export async function readHomeConsumption(pool, householdId, personId, date) {
  const {rows} = await pool.query(`SELECT c.parts,c.revision FROM person_daily_home_consumption c
    JOIN people p ON p.id=c.person_id WHERE p.household_id=$1 AND p.id=$2 AND c.consumption_date=$3`,
  [householdId, personId, date]);
  return rows[0] ?? {parts:[], revision:null};
}

export async function listHomeConsumption(pool, householdId, weekStart) {
  const {rows} = await pool.query(`SELECT c.person_id AS "personId", c.consumption_date::text AS date, c.parts
    FROM person_daily_home_consumption c JOIN people p ON p.id=c.person_id
    WHERE p.household_id=$1 AND c.consumption_date >= $2::date AND c.consumption_date < $2::date+7`,
  [householdId, weekStart]);
  return rows.filter(row => row.parts.length).map(({personId, date, parts}) => ({
    personId, date, carbohydrate:confirmedMacro(parts,'carbohydrate'), fat:confirmedMacro(parts,'fat')
  }));
}

export async function saveHomeConsumption(pool, householdId, personId, date, selections, revision) {
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
    const priorParts = new Map(previous.parts.map(part => [part.itemId, part]));
    const eligibleByMeal = new Map();
    const parts = [];
    for (const {mealId, itemId} of selections) {
      const confirmed = priorParts.get(itemId);
      if (confirmed?.mealId === mealId) {
        parts.push(confirmed);
        continue;
      }
      if (!eligibleByMeal.has(mealId)) {
        const meal = await readPlannedMeal(client, {id:mealId}, householdId);
        const eligible = meal ? consumptionParts([meal], personId, date) : [];
        eligibleByMeal.set(mealId, new Map(eligible.map(part => [part.itemId, part])));
      }
      const eligible = eligibleByMeal.get(mealId).get(itemId);
      if (!eligible) {
        await client.query('ROLLBACK');
        return {error:'part-not-confirmable'};
      }
      const {item, ...part} = eligible;
      parts.push({...part, carbohydrate:itemMacro(item, personId, 'carbohydrateG'),
        fat:itemMacro(item, personId, 'fatG')});
    }
    const nextRevision = randomUUID();
    await client.query(`INSERT INTO person_daily_home_consumption(person_id,consumption_date,parts,revision)
      VALUES($1,$2,$3::jsonb,$4) ON CONFLICT(person_id,consumption_date)
      DO UPDATE SET parts=excluded.parts,revision=excluded.revision`, [personId,date,JSON.stringify(parts),nextRevision]);
    await client.query('COMMIT');
    return {parts, revision:nextRevision};
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
