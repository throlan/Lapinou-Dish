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


test('allocates the slot budget between main recipe and accompaniment without reserving a drink share', () => {
  const base = { dailyTargetKcal: 2000, slot: 'breakfast', recipeKcal: 100, recipeUnit: 'portion' };
  const main = suggestQuantity({ ...base, budgetShare: 0.7 });
  const accompaniment = suggestQuantity({ ...base, budgetShare: 0.2 });
  assert.equal(main.slotBudgetKcal, 500);
  assert.equal(main.estimatedKcal, 350);
  assert.equal(accompaniment.estimatedKcal, 100);
});


test('preserves the chosen beverage quantity and reduces food portions to the slot budget', () => {
  const result = rebalanceNaturalPortions([
    { role: 'main', quantity: 3, step: 1, recipeKcal: 100 },
    { role: 'accompaniment', quantity: 1, step: 1, recipeKcal: 80 },
    { role: 'beverage', quantity: 3, step: 1, recipeKcal: 50 },
  ], 350);
  assert.equal(result.proposals[0].quantity, 1);
  assert.equal(result.proposals[2].quantity, 3);
  assert.equal(result.withinBudget, true);
  assert.equal(result.estimatedKcal, 330);
});

test('keeps zero as no beverage and reports when the minimum food portions still exceed the budget', () => {
  const result = rebalanceNaturalPortions([
    { role: 'main', quantity: 1, step: 1, recipeKcal: 300 },
    { role: 'accompaniment', quantity: 1, step: 1, recipeKcal: 100 },
    { role: 'beverage', quantity: 0, step: 1, recipeKcal: 150 },
  ], 350);
  assert.equal(result.proposals[2].quantity, 0);
  assert.equal(result.withinBudget, false);
  assert.equal(result.estimatedKcal, 400);
});

test('caps gram-based accompaniment portions at 1.5 yields and 200 g', async () => {
  const { capAccompanimentQuantity } = await import('../web/portion-planner.js');
  assert.equal(capAccompanimentQuantity(620, { recipeUnit: 'g', recipeYieldAmount: 100 }), 150);
  assert.equal(capAccompanimentQuantity(240, { recipeUnit: 'g', recipeYieldAmount: 300 }), 200);
  assert.equal(capAccompanimentQuantity(620, { recipeUnit: 'piece', recipeYieldAmount: 4 }), 620);
});

test('rebalances to the 4 g protein floor when there is calorie room and respects the cap', () => {
  const result = rebalanceNaturalPortions([
    { role: 'main', quantity: 1, step: 1, recipeKcal: 100, proteinG: 3, maxQuantity: Infinity },
    { role: 'accompaniment', quantity: 0, step: 10, recipeKcal: 0.6, proteinG: 0.1, maxQuantity: 150 },
  ], 200);
  assert.equal(result.proposals[0].quantity, 1);
  assert.equal(result.proposals[1].quantity, 10);
  assert.equal(result.estimatedProteinG, 4);
  assert.equal(result.proteinTargetMet, true);
  assert.equal(result.withinBudget, true);
});

test('reports when protein values are unknown instead of claiming the floor is met', () => {
  const result = rebalanceNaturalPortions([
    { role: 'main', quantity: 1, step: 1, recipeKcal: 100, proteinG: null },
  ], 200);
  assert.equal(result.proteinKnown, false);
  assert.equal(result.proteinTargetMet, false);
  assert.equal(result.estimatedProteinG, null);
});
