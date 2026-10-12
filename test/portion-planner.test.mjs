import test from 'node:test';
import assert from 'node:assert/strict';
import { SLOT_RATIOS, suggestQuantity } from '../web/portion-planner.js';

test('uses the same daily energy ratios for every profile and slot', () => {
  assert.deepEqual(SLOT_RATIOS, { breakfast: 0.2, lunch: 0.4, dinner: 0.3, snack: 0.1 });
  assert.equal(suggestQuantity({ dailyTargetKcal: 2000, slot: 'lunch', recipeKcal: 200, recipeUnit: 'piece' }).slotBudgetKcal, 900);
  assert.equal(suggestQuantity({ dailyTargetKcal: 2500, slot: 'lunch', recipeKcal: 200, recipeUnit: 'piece' }).slotBudgetKcal, 1100);
});

test('rounds down to natural recipe units and never exceeds the shared daily envelope', () => {
  const suggestion = suggestQuantity({ dailyTargetKcal: 2000, slot: 'breakfast', recipeKcal: 180, recipeUnit: 'piece', plannedOtherKcal: 1500 });
  assert.equal(suggestion.quantity, 2);
  assert.ok(suggestion.estimatedKcal + 1500 <= 2000);
  assert.equal(suggestQuantity({ dailyTargetKcal: 2000, slot: 'lunch', recipeKcal: 250, recipeUnit: 'portion' }).quantity, 3.5);
  assert.equal(suggestQuantity({ dailyTargetKcal: 2000, slot: 'snack', recipeKcal: 0.8, recipeUnit: 'g' }).quantity % 10, 0);
});

test('returns an explicit reason instead of inventing a portion when data or budget is missing', () => {
  assert.equal(suggestQuantity({ dailyTargetKcal: null, slot: 'dinner', recipeKcal: 200 }).reason, 'daily-target-missing');
  assert.equal(suggestQuantity({ dailyTargetKcal: 2000, slot: 'dinner', recipeKcal: null }).reason, 'recipe-energy-missing');
  assert.equal(suggestQuantity({ dailyTargetKcal: 2000, slot: 'breakfast', recipeKcal: 1000, recipeUnit: 'piece' }).reason, 'no-natural-portion-fits');
});
