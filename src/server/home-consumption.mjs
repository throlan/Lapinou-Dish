import {randomUUID} from 'node:crypto';
import {lockHouseholdInventory} from './ingredient-stock.mjs';
import {readPlannedMeal} from './planning.mjs';
import {consumptionParts,itemMacro,homeConsumptionTotals,CONSUMPTION_NUTRIENTS} from '../../web/day-meals.js';

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
  return rows.map(({personId, date, parts}) => ({
    personId, date, ...homeConsumptionTotals(parts),
  }));
}

export async function readHomeConsumptionDay(pool, householdId, date) {
  const {rows} = await pool.query(`SELECT c.person_id AS "personId", c.parts, c.revision
    FROM person_daily_home_consumption c JOIN people p ON p.id=c.person_id
    WHERE p.household_id=$1 AND c.consumption_date=$2::date`, [householdId,date]);
  return {entries:rows};
}

export async function saveHomeConsumption(pool, householdId, personId, date, selections, revision) {
  const result = await saveHomeConsumptionDay(pool,householdId,date,[{personId,selections,revision}]);
  if (result.error) return result;
  const [{parts, revision:nextRevision}] = result.entries;
  return {parts,revision:nextRevision};
}

export async function saveHomeConsumptionDay(pool, householdId, date, entries) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await lockHouseholdInventory(client, householdId);
    const people = await client.query('SELECT id FROM people WHERE household_id=$1 AND id=ANY($2::uuid[]) FOR UPDATE',
      [householdId,entries.map(entry=>entry.personId)]);
    if (people.rows.length !== entries.length) {
      await client.query('ROLLBACK');
      return {error:'person-not-found'};
    }
    const previous = new Map((await readHomeConsumptionDay(client,householdId,date)).entries.map(entry=>[entry.personId,entry]));
    const meals = new Map(), saved = [];
    for (const {personId, revision, selections} of entries) {
      const record = previous.get(personId);
      if ((record?.revision ?? null) !== revision) {
        await client.query('ROLLBACK');
        return {error:'consumption-changed'};
      }
      const priorParts = new Map((record?.parts ?? []).map(part=>[part.itemId,part]));
      const eligibleByMeal = new Map(), parts = [];
      for (const {mealId,itemId} of selections) {
        const confirmed = priorParts.get(itemId);
        if (confirmed?.mealId === mealId) {
          parts.push(confirmed);
          continue;
        }
        if (!eligibleByMeal.has(mealId)) {
          if (!meals.has(mealId)) meals.set(mealId,await readPlannedMeal(client,{id:mealId},householdId));
          const meal = meals.get(mealId);
          const eligible = meal ? consumptionParts([meal],personId,date) : [];
          eligibleByMeal.set(mealId,new Map(eligible.map(part=>[part.itemId,part])));
        }
        if (!eligibleByMeal.get(mealId).has(itemId)) {
          await client.query('ROLLBACK');
          return {error:'part-not-confirmable'};
        }
        const {item,...part} = eligibleByMeal.get(mealId).get(itemId);
        const nutrients = Object.fromEntries(Object.entries(CONSUMPTION_NUTRIENTS).map(([key,nutrient])=>[
          key,itemMacro(item,personId,nutrient),
        ]));
        parts.push({...part,...nutrients});
      }
      const nextRevision = randomUUID();
      await client.query(`INSERT INTO person_daily_home_consumption(person_id,consumption_date,parts,revision)
        VALUES($1,$2,$3::jsonb,$4) ON CONFLICT(person_id,consumption_date)
        DO UPDATE SET parts=excluded.parts,revision=excluded.revision`, [personId,date,JSON.stringify(parts),nextRevision]);
      saved.push({personId,parts,revision:nextRevision});
    }
    await client.query('COMMIT');
    return {entries:saved};
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
