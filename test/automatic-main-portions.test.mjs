import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import * as planner from '../web/portion-planner.js';

const source = await readFile(new URL('../web/app.js', import.meta.url), 'utf8');
const start = source.indexOf('function applyAutomaticPortions(');
const end = source.indexOf('function mealProteinSummary(', start);

test('automatic meat and vegetable servings stay within one batch portion for all four profiles', () => {
  const parent = { id: 'parent', yield: { amount: 4, unitId: 'portion' } };
  const main = { id: 'main', parentRecipeId: parent.id, servingPart: 'main', yield: { amount: 1660, unitId: 'g' }, nutrition: { perYieldUnit: { energyKcal: 1.3, proteinG: 0.075 } } };
  const rice = { id: 'rice', parentRecipeId: parent.id, servingPart: 'starch', yield: { amount: 750, unitId: 'g' }, nutrition: { perYieldUnit: { energyKcal: 1.2, proteinG: 0.02 } } };
  const people = [1600, 3200, 2200, 2600].map((energy, i) => ({ id: String(i), displayName: String(i), energy }));
  const items = { 0: { recipeId: main.id, role: 'main' }, 1: { recipeId: rice.id, role: 'accompaniment' } };
  const root = { replaceChildren() {} };
  const context = { ...planner, state: { recipes: [parent], people, calendarMeals: [] },
    $: selector => selector === '#meal-form' ? { elements: { mealDate: { value: '2026-10-19' }, slot: { value: 'lunch' } } } : root,
    allPlanningRecipes: () => [parent, main, rice], isIndividualRole: () => false,
    latestProfile: person => ({ dailyEnergyKcal: person.energy }), plannedCaloriesForPerson: () => 0,
    document: { createElement: () => ({ append() {} }) } };
  runInNewContext(source.slice(start, end) + '\nglobalThis.calculate = applyAutomaticPortions;', context);
  context.calculate(items, people.map(person => person.id));
  for (const person of people) {
    assert.ok(Number(items[0].amounts[person.id]) > 0);
    assert.ok(Number(items[0].amounts[person.id]) <= 410);
    assert.ok(Number(items[1].amounts[person.id]) > 0);
  }
});

test('protein adjustment cannot bypass the main serving ceiling; piece recipes keep their own portions', () => {
  const parent = { yield: { amount: 4, unitId: 'portion' } };
  const child = { servingPart: 'main', yield: { amount: 1660, unitId: 'g' } };
  const limit = planner.mainServingLimit(child, parent);
  const result = planner.rebalanceNaturalPortions([{ role: 'main', quantity: limit, step: 10, recipeKcal: 1, proteinG: 0.01, maxQuantity: limit }], 2000);
  assert.equal(result.proposals[0].quantity, 410);
  assert.equal(result.proteinTargetMet, false);
  assert.equal(planner.mainServingLimit(child, { yield: { amount: 24, unitId: 'piece' } }), Infinity);
  assert.equal(planner.mainServingLimit({ ...child, servingPart: 'starch' }, parent), Infinity);
});
