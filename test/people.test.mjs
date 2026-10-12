import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePersonInput, validateProfileHistoryInput, validateWeightInput } from '../src/server/people.mjs';

test('profile creation requires a display name and accepts an optional valid birth date', () => {
  assert.deepEqual(validatePersonInput({ displayName: '  Camille ', birthDate: '2010-04-18' }), { data: { displayName: 'Camille', birthDate: '2010-04-18' } });
  assert.equal(validatePersonInput({ displayName: '  ' }).error, 'invalid-display-name');
  assert.equal(validatePersonInput({ displayName: 'Camille', birthDate: '2025-02-30' }).error, 'invalid-birth-date');
});

test('weekly weight entries require a real date and a positive plausible value', () => {
  assert.deepEqual(validateWeightInput({ measuredOn: '2026-10-12', weightKg: '72.4' }), { data: { measuredOn: '2026-10-12', weightKg: 72.4 } });
  assert.equal(validateWeightInput({ measuredOn: '2026-02-30', weightKg: 72 }).error, 'invalid-measured-on');
  assert.equal(validateWeightInput({ measuredOn: '2026-10-12', weightKg: 0 }).error, 'invalid-weight');
});

test('profile history validates activity and keeps daily needs explicitly attributed', () => {
  assert.deepEqual(validateProfileHistoryInput({ effectiveFrom: '2026-10-12', heightCm: '168', activityLevel: 'moderate', dailyEnergyKcal: '2100', dailyEnergyOrigin: 'clinician', dailyEnergyMethod: 'Mesure validée' }), {
    data: { effectiveFrom: '2026-10-12', heightCm: 168, activityLevel: 'moderate', dailyEnergyKcal: 2100, dailyEnergyOrigin: 'clinician', dailyEnergyMethod: 'Mesure validée' },
  });
  assert.equal(validateProfileHistoryInput({ effectiveFrom: '2026-10-12', activityLevel: 'extreme' }).error, 'invalid-activity-level');
  assert.equal(validateProfileHistoryInput({ effectiveFrom: '2026-10-12', dailyEnergyKcal: 2100 }).error, 'invalid-daily-energy-origin');
});


test('saving profile history updates an existing date instead of rejecting it', async () => {
  const existingId = '49a9ae37-8f1a-4b3b-98a3-481cbb344259';
  let statement = '';
  let values = [];
  const pool = { query: async (sql, parameters) => {
    statement = sql;
    values = parameters;
    return { rowCount: 1, rows: [{ id: existingId, effective_from: '2026-10-12', height_cm: '173.0', activity_level: 'sedentary', daily_energy_kcal: 2050, daily_energy_origin: 'estimate', daily_energy_method: 'Test' }] };
  } };
  const result = await addProfileHistory(pool, 'f4a02d74-0eab-4b92-8873-0a7238b09e98', '1903fe37-7b79-4d11-9e10-0cdaf89d4f17', {
    effectiveFrom: '2026-10-12', heightCm: 173, activityLevel: 'sedentary', dailyEnergyKcal: 2050, dailyEnergyOrigin: 'estimate', dailyEnergyMethod: 'Test',
  });
  assert.match(statement, /ON CONFLICT \(person_id, effective_from\) DO UPDATE/);
  assert.equal(values[2], '2026-10-12');
  assert.equal(values[5], 2050);
  assert.equal(result.id, existingId);
  assert.equal(result.effectiveFrom, '2026-10-12');
  assert.equal(result.dailyEnergyKcal, 2050);
});
