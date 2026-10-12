import test from 'node:test';
import assert from 'node:assert/strict';
import { SLOT_RATIOS, rebalanceNaturalPortions, suggestQuantity } from '../web/portion-planner.js';

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


test('allocates the slot budget with the requested main, accompaniment and beverage shares', () => {
  const base = { dailyTargetKcal: 2000, slot: 'breakfast', recipeKcal: 100, recipeUnit: 'portion' };
  const main = suggestQuantity({ ...base, budgetShare: 0.7 });
  const accompaniment = suggestQuantity({ ...base, budgetShare: 0.2 });
  const beverage = suggestQuantity({ ...base, budgetShare: 0.1 });
  assert.equal(main.slotBudgetKcal, 500);
  assert.equal(main.estimatedKcal, 350);
  assert.equal(accompaniment.estimatedKcal, 100);
  assert.equal(beverage.estimatedKcal, 50);
});


test('lets a whole breakfast drink exceed its soft share by reducing the main recipe within the slot budget', () => {
  const result = rebalanceNaturalPortions([
    { role: 'main', quantity: 3, step: 1, recipeKcal: 100 },
    { role: 'accompaniment', quantity: 1, step: 1, recipeKcal: 80 },
    { role: 'beverage', quantity: null, reason: 'no-natural-portion-fits', step: 1, recipeKcal: 150 },
  ], 400);
  assert.equal(result.beverageAdded, true);
  assert.equal(result.proposals[0].quantity, 1);
  assert.equal(result.proposals[2].quantity, 1);
  assert.ok(result.estimatedKcal <= 400);
});

test('does not invent a drink when minimum natural portions cannot fit the slot budget', () => {
  const result = rebalanceNaturalPortions([
    { role: 'main', quantity: 1, step: 1, recipeKcal: 300 },
    { role: 'accompaniment', quantity: 1, step: 1, recipeKcal: 100 },
    { role: 'beverage', quantity: null, reason: 'no-natural-portion-fits', step: 1, recipeKcal: 150 },
  ], 500);
  assert.equal(result.beverageAdded, false);
  assert.equal(result.proposals[2].quantity, null);
  assert.equal(result.estimatedKcal, 400);
});
