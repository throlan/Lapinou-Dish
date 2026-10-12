import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePlannedMeal } from '../src/server/planning.mjs';

const householdId = '11111111-1111-4111-8111-111111111111';
const recipeId = '22222222-2222-4222-8222-222222222222';
const personA = '33333333-3333-4333-8333-333333333333';
const personB = '44444444-4444-4444-8444-444444444444';

function valid(overrides = {}) {
  return {
    householdId, mealDate: '2026-10-12', slot: 'lunch', notes: '',
    attendeeIds: [personA, personB],
    items: [{ recipeId, amounts: [{ personId: personA, quantity: 1 }, { personId: personB, quantity: 0.5 }] }],
    ...overrides,
  };
}

test('accepts a planned recipe with explicit attendees and separate quantities', () => {
  const result = validatePlannedMeal(valid());
  assert.equal(result.error, undefined);
  assert.equal(result.data.items[0].amounts[1].quantity, 0.5);
});

test('requires a person to be explicitly selected', () => {
  assert.equal(validatePlannedMeal(valid({ attendeeIds: [] })).error, 'attendees-required');
});

test('requires a positive amount for every attendee on each recipe', () => {
  assert.equal(validatePlannedMeal(valid({ items: [{ recipeId, amounts: [{ personId: personA, quantity: 1 }] }] })).error, 'amounts-must-match-attendees');
  assert.equal(validatePlannedMeal(valid({ items: [{ recipeId, amounts: [{ personId: personA, quantity: 0 }, { personId: personB, quantity: 1 }] }] })).error, 'invalid-planned-quantity');
});

test('rejects invalid dates, slots and people outside the attendee set', () => {
  assert.equal(validatePlannedMeal(valid({ mealDate: '2026-02-30' })).error, 'invalid-meal-date');
  assert.equal(validatePlannedMeal(valid({ slot: 'midnight' })).error, 'invalid-meal-slot');
  assert.equal(validatePlannedMeal(valid({ items: [{ recipeId, amounts: [{ personId: '55555555-5555-4555-8555-555555555555', quantity: 1 }, { personId: personB, quantity: 1 }] }] })).error, 'invalid-planned-amount-person');
});
