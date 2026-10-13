import { randomUUID } from 'node:crypto';
import { readRecipe } from './recipes.mjs';

const DAY_MS = 86400000;
export const ROLLING_RESERVE_DAYS = 30;

export function isAdultOn(birthDate, date) {
  if (!birthDate || !isDate(date)) return false;
  const birth = String(birthDate).slice(0, 10);
  const cutoff = new Date(`${date}T12:00:00Z`);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 18);
  return birth <= cutoff.toISOString().slice(0, 10);
}

export function calculateReserveBalance(days, { windowDays = ROLLING_RESERVE_DAYS } = {}) {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const lastDate = sorted.at(-1)?.date;
  if (!lastDate || !Number.isInteger(windowDays) || windowDays < 1) return { balanceKcal: 0, days: [] };
  const firstDate = addDays(lastDate, -(windowDays - 1));
  const included = sorted.filter((day) => day.date >= firstDate && day.date <= lastDate);
  // Two windows are enough to reconstruct spend that consumed a credit which expires at the boundary.
  const processingStart=addDays(firstDate,-(windowDays-1));
  const processingDays=sorted.filter((day)=>day.date>=processingStart&&day.date<=lastDate);
  const credits=[],debts=[];
  for(const day of processingDays){
    while(credits.length && credits[0].expiresOn<day.date)credits.shift();
    while(debts.length && debts[0].expiresOn<day.date)debts.shift();
    if(!Number.isFinite(day.deltaKcal)||day.deltaKcal===0)continue;
    let amount=Math.abs(day.deltaKcal);
    if(day.deltaKcal>0){
      while(amount>1e-8&&debts.length){const used=Math.min(amount,debts[0].kcal);amount-=used;debts[0].kcal-=used;if(debts[0].kcal<=1e-8)debts.shift();}
      if(amount>1e-8)credits.push({kcal:amount,expiresOn:addDays(day.date,windowDays-1)});
    }else{
      while(amount>1e-8&&credits.length){const used=Math.min(amount,credits[0].kcal);amount-=used;credits[0].kcal-=used;if(credits[0].kcal<=1e-8)credits.shift();}
      if(amount>1e-8)debts.push({kcal:amount,expiresOn:addDays(day.date,windowDays-1)});
    }
  }
  const balanceKcal=credits.reduce((sum,lot)=>sum+lot.kcal,0)-debts.reduce((sum,lot)=>sum+lot.kcal,0);
  return { balanceKcal: roundKcal(balanceKcal), days: included, startsOn: firstDate, endsOn: lastDate };
}

export function validateSavingPlan(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || !isUuid(input.householdId) || !isUuid(input.personId)
    || !isDate(input.startsOn) || !isDate(input.endsOn) || input.endsOn < input.startsOn) return { error: 'invalid-saving-plan' };
  const dayCount = Math.round((Date.parse(`${input.endsOn}T00:00:00Z`) - Date.parse(`${input.startsOn}T00:00:00Z`)) / DAY_MS) + 1;
  const dailyKcal = Number(input.dailyKcal);
  if (dayCount > 30 || !Number.isFinite(dailyKcal) || dailyKcal <= 0 || dailyKcal > 1000) return { error: 'invalid-saving-plan' };
  return { data: { householdId: input.householdId, personId: input.personId, startsOn: input.startsOn, endsOn: input.endsOn, dailyKcal } };
}

export async function saveSavingPlan(pool, data) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const person = (await client.query('SELECT birth_date::text AS birth_date, active FROM people WHERE id=$1 AND household_id=$2 FOR UPDATE', [data.personId, data.householdId])).rows[0];
    if (!person?.active) { await client.query('ROLLBACK'); return { error: 'person-not-found' }; }
    if (!isAdultOn(person.birth_date, data.startsOn) || !isAdultOn(person.birth_date, data.endsOn)) { await client.query('ROLLBACK'); return { error: 'saving-adults-only' }; }
    const profile = (await client.query('SELECT daily_energy_kcal FROM person_profile_history WHERE person_id=$1 AND effective_from<=$2 ORDER BY effective_from DESC LIMIT 1', [data.personId, data.startsOn])).rows[0];
    if (!Number(profile?.daily_energy_kcal) || data.dailyKcal >= Number(profile.daily_energy_kcal)) { await client.query('ROLLBACK'); return { error: 'saving-exceeds-daily-target' }; }
    const futureTargets=await client.query('SELECT daily_energy_kcal FROM person_profile_history WHERE person_id=$1 AND effective_from>$2 AND effective_from<=$3',[data.personId,data.startsOn,data.endsOn]);
    if(futureTargets.rows.some(row=>!Number(row.daily_energy_kcal)||data.dailyKcal>=Number(row.daily_energy_kcal))){await client.query('ROLLBACK');return{error:'saving-exceeds-daily-target'};}
    const overlaps = await client.query('SELECT id FROM energy_saving_plans WHERE person_id=$1 AND starts_on<=$3 AND ends_on>=$2', [data.personId, data.startsOn, data.endsOn]);
    if (overlaps.rowCount) { await client.query('ROLLBACK'); return { error: 'saving-period-overlap' }; }
    const result = await client.query('INSERT INTO energy_saving_plans(id,household_id,person_id,starts_on,ends_on,daily_kcal) VALUES($1,$2,$3,$4,$5,$6) RETURNING id', [randomUUID(), data.householdId, data.personId, data.startsOn, data.endsOn, data.dailyKcal]);
    await client.query('COMMIT');
    return { id: result.rows[0].id };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

export async function deleteSavingPlan(pool, householdId, planId) {
  const result = await pool.query('DELETE FROM energy_saving_plans WHERE household_id=$1 AND id=$2 RETURNING id', [householdId, planId]);
  return Boolean(result.rowCount);
}

export async function getEnergyReserveOverview(pool, householdId, asOf) {
  if (!isUuid(householdId) || !isDate(asOf)) return { error: 'invalid-energy-reserve-query' };
  const startsOn = addDays(asOf, -(ROLLING_RESERVE_DAYS - 1));
  const processingStartsOn=addDays(asOf,-(ROLLING_RESERVE_DAYS*2-2));
  const plansThrough=addDays(asOf,ROLLING_RESERVE_DAYS);
  const [peopleResult, profileResult, mealResult, savingResult] = await Promise.all([
    pool.query('SELECT id,display_name,birth_date::text AS birth_date,active FROM people WHERE household_id=$1 AND active=true ORDER BY display_name', [householdId]),
    pool.query('SELECT ph.person_id,ph.effective_from::text AS effective_from,ph.daily_energy_kcal FROM person_profile_history ph JOIN people p ON p.id=ph.person_id WHERE p.household_id=$1 AND ph.effective_from<=$2 ORDER BY ph.person_id,ph.effective_from', [householdId, asOf]),
    pool.query(`SELECT m.id,m.meal_date::text AS date,m.is_occasion,m.occasion_title,a.person_id,
      e.energy_kcal AS occasion_kcal,i.id AS item_id,i.recipe_id,i.role,pa.quantity
      FROM planned_meals m JOIN planned_meal_attendees a ON a.meal_id=m.id
      LEFT JOIN planned_occasion_energy e ON e.meal_id=m.id AND e.person_id=a.person_id
      LEFT JOIN planned_meal_items i ON i.meal_id=m.id
      LEFT JOIN planned_amounts pa ON pa.planned_item_id=i.id AND pa.person_id=a.person_id
      WHERE m.household_id=$1 AND m.meal_date BETWEEN $2 AND $3
      ORDER BY m.meal_date,m.id,i.sort_order`, [householdId, processingStartsOn, asOf]),
    pool.query(`SELECT id,person_id,starts_on::text AS starts_on,ends_on::text AS ends_on,daily_kcal
      FROM energy_saving_plans WHERE household_id=$1 AND starts_on<=$2 AND ends_on>=$3 ORDER BY starts_on`, [householdId, plansThrough, processingStartsOn]),
  ]);
  const people = peopleResult.rows;
  const histories = new Map();
  for (const row of profileResult.rows) histories.set(row.person_id, [...(histories.get(row.person_id) ?? []), row]);
  const mealGroups = new Map();
  for (const row of mealResult.rows) {
    const key = `${row.id}:${row.person_id}`;
    let group = mealGroups.get(key);
    if (!group) {
      group = { id: row.id, date: row.date, personId: row.person_id, isOccasion: row.is_occasion, title: row.occasion_title, kcal: 0, complete: true, lineCount: 0, occasionKcal: row.occasion_kcal == null ? null : Number(row.occasion_kcal) };
      mealGroups.set(key, group);
    }
    if (row.is_occasion) {
      if (group.occasionKcal == null) group.complete = false;
      else { group.kcal = group.occasionKcal; group.lineCount = 1; }
      continue;
    }
    if (!row.item_id || row.quantity == null) continue;
    const recipe = await readRecipeCached(pool, row.recipe_id);
    const energy = recipe?.nutrition?.perYieldUnit?.energyKcal;
    if (energy == null || !Number.isFinite(Number(energy))) group.complete = false;
    if (energy != null && Number.isFinite(Number(energy))) group.kcal += Number(row.quantity) * Number(energy);
    group.lineCount++;
  }
  const groupsByDay = new Map();
  for (const meal of mealGroups.values()) {
    const key = `${meal.date}:${meal.personId}`;
    groupsByDay.set(key, [...(groupsByDay.get(key) ?? []), meal]);
  }
  const plans = savingResult.rows.map((plan) => ({ ...plan, dailyKcal: Number(plan.daily_kcal), personId: plan.person_id }));
  const accounts = [];
  for (const person of people) {
    if (!isAdultOn(person.birth_date, asOf)) continue;
    const days = [];
    for (let offset = 0; offset < ROLLING_RESERVE_DAYS*2-1; offset++) {
      const date = addDays(processingStartsOn, offset);
      const meals = groupsByDay.get(`${date}:${person.id}`) ?? [];
      const target = targetAt(histories.get(person.id) ?? [], date);
      const plan = plans.find((entry) => entry.personId === person.id && entry.starts_on <= date && entry.ends_on >= date);
      if (!meals.length) {
        days.push({ date, targetKcal: target, plannedKcal: null, deltaKcal: null, incomplete: false, hasPlan: false, extraSavingKcal: plan?.dailyKcal ?? 0 });
        continue;
      }
      const complete = meals.every((meal) => meal.complete && meal.lineCount > 0);
      const plannedKcal = complete ? meals.reduce((sum, meal) => sum + meal.kcal, 0) : null;
      const deltaKcal = target != null && plannedKcal != null ? roundKcal(target - plannedKcal) : null;
      days.push({ date, targetKcal: target, plannedKcal, deltaKcal, incomplete: !complete || target == null, hasPlan: true, extraSavingKcal: plan?.dailyKcal ?? 0 });
    }
    const balance = calculateReserveBalance(days, { windowDays: ROLLING_RESERVE_DAYS });
    const knownDays = balance.days.filter((day) => Number.isFinite(day.deltaKcal));
    const currentPlan = plans.filter((plan) => plan.personId === person.id);
    accounts.push({
      personId: person.id, name: person.display_name, startsOn, endsOn: asOf,
      balanceKcal: balance.balanceKcal,
      knownDays: knownDays.length,
      incompleteDays: balance.days.filter((day) => day.incomplete).length,
      days: balance.days,
      savingsPlans: currentPlan.map(({ id, starts_on, ends_on, dailyKcal }) => ({ id, startsOn: starts_on, endsOn: ends_on, dailyKcal })),
    });
  }
  return { asOf, startsOn, windowDays: ROLLING_RESERVE_DAYS, accounts };
}

const recipeCache = new WeakMap();
async function readRecipeCached(pool, id) {
  let cache = recipeCache.get(pool);
  if (!cache) { cache = new Map(); recipeCache.set(pool, cache); }
  if (!cache.has(id)) cache.set(id, await readRecipe(pool, id));
  return cache.get(id);
}

function targetAt(history, date) {
  let target = null;
  for (const row of history) if (row.effective_from <= date) target = row.daily_energy_kcal;
  return target == null ? null : Number(target);
}
function roundKcal(value) { return Math.round((value + Number.EPSILON) * 100) / 100; }
function addDays(value, days) { const date = new Date(`${value}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }
function isDate(value) { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value; }
function isUuid(value) { return typeof value === 'string' && /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(value); }
