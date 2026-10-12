import { randomUUID } from 'node:crypto';

const ACTIVITY_LEVELS = new Set(['sedentary', 'light', 'moderate', 'active', 'very_active']);
const ENERGY_ORIGINS = new Set(['manual', 'clinician', 'estimate']);

export function validatePersonInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'invalid-body' };
  const displayName = typeof input.displayName === 'string' ? input.displayName.trim() : '';
  if (!displayName || displayName.length > 80) return { error: 'invalid-display-name' };
  const birthDate = input.birthDate == null || input.birthDate === '' ? null : input.birthDate;
  if (birthDate != null && !isDate(birthDate)) return { error: 'invalid-birth-date' };
  return { data: { displayName, birthDate } };
}

export function validateWeightInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'invalid-body' };
  if (!isDate(input.measuredOn)) return { error: 'invalid-measured-on' };
  const weightKg = Number(input.weightKg);
  if (!Number.isFinite(weightKg) || weightKg <= 0 || weightKg > 500) return { error: 'invalid-weight' };
  return { data: { measuredOn: input.measuredOn, weightKg } };
}

export function validateProfileHistoryInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'invalid-body' };
  if (!isDate(input.effectiveFrom)) return { error: 'invalid-effective-date' };
  const heightCm = input.heightCm === '' || input.heightCm == null ? null : Number(input.heightCm);
  if (heightCm != null && (!Number.isFinite(heightCm) || heightCm < 50 || heightCm > 260)) return { error: 'invalid-height' };
  const activityLevel = input.activityLevel || null;
  if (activityLevel != null && !ACTIVITY_LEVELS.has(activityLevel)) return { error: 'invalid-activity-level' };
  const dailyEnergyKcal = input.dailyEnergyKcal === '' || input.dailyEnergyKcal == null ? null : Number(input.dailyEnergyKcal);
  if (dailyEnergyKcal != null && (!Number.isInteger(dailyEnergyKcal) || dailyEnergyKcal < 500 || dailyEnergyKcal > 10000)) return { error: 'invalid-daily-energy' };
  const dailyEnergyOrigin = dailyEnergyKcal == null ? null : input.dailyEnergyOrigin;
  if (dailyEnergyKcal != null && !ENERGY_ORIGINS.has(dailyEnergyOrigin)) return { error: 'invalid-daily-energy-origin' };
  const dailyEnergyMethod = dailyEnergyKcal == null ? null : String(input.dailyEnergyMethod ?? '').trim().slice(0, 500);
  return { data: { effectiveFrom: input.effectiveFrom, heightCm, activityLevel, dailyEnergyKcal, dailyEnergyOrigin, dailyEnergyMethod } };
}

export async function listPeople(pool, householdId) {
  const people = (await pool.query(
    'SELECT id, display_name, birth_date, active FROM people WHERE household_id = $1 ORDER BY display_name',
    [householdId],
  )).rows;
  if (!people.length) return [];
  const ids = people.map((person) => person.id);
  const [weights, profiles] = await Promise.all([
    pool.query('SELECT id, person_id, measured_on::text AS measured_on, weight_kg FROM person_weight_entries WHERE person_id = ANY($1::uuid[]) ORDER BY measured_on DESC', [ids]),
    pool.query('SELECT id, person_id, effective_from::text AS effective_from, height_cm, activity_level, daily_energy_kcal, daily_energy_origin, daily_energy_method FROM person_profile_history WHERE person_id = ANY($1::uuid[]) ORDER BY effective_from DESC', [ids]),
  ]);
  return people.map((person) => ({
    id: person.id, displayName: person.display_name, birthDate: person.birth_date, active: person.active,
    weightHistory: weights.rows.filter((entry) => entry.person_id === person.id).map((entry) => ({ id: entry.id, measuredOn: entry.measured_on, weightKg: Number(entry.weight_kg) })),
    profileHistory: profiles.rows.filter((entry) => entry.person_id === person.id).map((entry) => ({
      id: entry.id, effectiveFrom: entry.effective_from, heightCm: entry.height_cm == null ? null : Number(entry.height_cm),
      activityLevel: entry.activity_level, dailyEnergyKcal: entry.daily_energy_kcal == null ? null : Number(entry.daily_energy_kcal),
      dailyEnergyOrigin: entry.daily_energy_origin, dailyEnergyMethod: entry.daily_energy_method,
    })),
  }));
}

export async function createPerson(pool, householdId, data) {
  const result = await pool.query(
    'INSERT INTO people (id, household_id, display_name, birth_date) VALUES ($1,$2,$3,$4) RETURNING id, display_name, birth_date, active',
    [randomUUID(), householdId, data.displayName, data.birthDate],
  );
  const row = result.rows[0];
  return { id: row.id, displayName: row.display_name, birthDate: row.birth_date, active: row.active, weightHistory: [], profileHistory: [] };
}

export async function addWeightEntry(pool, personId, householdId, data) {
  const result = await pool.query(
    'INSERT INTO person_weight_entries (id, person_id, measured_on, weight_kg) SELECT $1, p.id, $3, $4 FROM people p WHERE p.id = $2 AND p.household_id = $5 RETURNING id, measured_on::text AS measured_on, weight_kg',
    [randomUUID(), personId, data.measuredOn, data.weightKg, householdId],
  );
  if (!result.rowCount) return null;
  return { id: result.rows[0].id, measuredOn: result.rows[0].measured_on, weightKg: Number(result.rows[0].weight_kg) };
}

export async function addProfileHistory(pool, personId, householdId, data) {
  const result = await pool.query(
    'INSERT INTO person_profile_history (id, person_id, effective_from, height_cm, activity_level, daily_energy_kcal, daily_energy_origin, daily_energy_method) SELECT $1, p.id, $3, $4, $5, $6, $7, $8 FROM people p WHERE p.id = $2 AND p.household_id = $9 ON CONFLICT (person_id, effective_from) DO UPDATE SET height_cm = EXCLUDED.height_cm, activity_level = EXCLUDED.activity_level, daily_energy_kcal = EXCLUDED.daily_energy_kcal, daily_energy_origin = EXCLUDED.daily_energy_origin, daily_energy_method = EXCLUDED.daily_energy_method RETURNING id, effective_from::text AS effective_from, height_cm, activity_level, daily_energy_kcal, daily_energy_origin, daily_energy_method',
    [randomUUID(), personId, data.effectiveFrom, data.heightCm, data.activityLevel, data.dailyEnergyKcal, data.dailyEnergyOrigin, data.dailyEnergyMethod, householdId],
  );
  if (!result.rowCount) return null;
  const row = result.rows[0];
  return {
    id: row.id, effectiveFrom: row.effective_from, heightCm: row.height_cm == null ? null : Number(row.height_cm),
    activityLevel: row.activity_level, dailyEnergyKcal: row.daily_energy_kcal == null ? null : Number(row.daily_energy_kcal),
    dailyEnergyOrigin: row.daily_energy_origin, dailyEnergyMethod: row.daily_energy_method,
  };
}

function isDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
