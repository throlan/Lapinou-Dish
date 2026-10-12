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
