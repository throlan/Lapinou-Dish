import test from 'node:test';
import assert from 'node:assert/strict';
import { listPlannedMeals, validatePlannedMeal } from '../src/server/planning.mjs';

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
  assert.equal(result.data.items[0].role, 'main');
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

test('planned meals keep their exact calendar date when listed', async () => {
  const mealId = '55555555-5555-4555-8555-555555555555';
  const queries = [];
  const pool = { query: async (sql, values) => {
    queries.push(sql);
    if (sql.includes('FROM planned_meals WHERE household_id')) {
      return { rows: [{ id: mealId, meal_date: '2026-10-12', slot: 'lunch', notes: '' }] };
    }
    if (sql.includes('FROM planned_meal_attendees')) return { rows: [{ id: personA, display_name: 'Lapinou' }] };
    if (sql.includes('FROM planned_meal_items')) return { rows: [] };
    throw new Error('Unexpected query');
  } };
  const meals = await listPlannedMeals(pool, householdId, '2026-10-12');
  assert.ok(queries[0].includes('meal_date::text AS meal_date'));
  assert.equal(meals[0].mealDate, '2026-10-12');
});


test('accepts meal item categories and rejects unsupported categories', () => {
  assert.equal(validatePlannedMeal(valid({ items: [{ recipeId, role: 'beverage', amounts: [{ personId: personA, quantity: 1 }, { personId: personB, quantity: 1 }] }] })).data.items[0].role, 'beverage');
  assert.equal(validatePlannedMeal(valid({ items: [{ recipeId, role: 'dessert', amounts: [{ personId: personA, quantity: 1 }, { personId: personB, quantity: 1 }] }] })).error, 'invalid-planned-item-role');
});
