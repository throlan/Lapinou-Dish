import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRecipeInput } from '../src/server/recipes.mjs';

const base = {
  name: 'Petit déjeuner',
  householdId: '10101010-1010-4010-8010-101010101010',
  yield: { amount: 4, unitId: 'portion' },
  lines: [{ foodId: '20202020-2020-4020-8020-202020202020', quantity: 100, unitId: 'g' }],
};

test('recipe taxonomy defaults to an unfiltered dish for legacy clients', () => {
  const result = validateRecipeInput(base);
  assert.equal(result.data.recipeType, 'dish');
  assert.deepEqual(result.data.mealMoments, []);
});

test('recipe taxonomy accepts a beverage restricted to breakfast and snack', () => {
  const result = validateRecipeInput({ ...base, recipeType: 'beverage', mealMoments: ['breakfast', 'snack'] });
  assert.equal(result.data.recipeType, 'beverage');
  assert.deepEqual(result.data.mealMoments, ['breakfast', 'snack']);
});

test('recipe taxonomy rejects unsupported tags and duplicate moments', () => {
  for(const recipeType of ['snack','other'])assert.equal(validateRecipeInput({...base,recipeType}).error,'invalid-recipe-type');
  assert.equal(validateRecipeInput({ ...base, recipeType: 'drink' }).error, 'invalid-recipe-type');
  assert.equal(validateRecipeInput({ ...base, mealMoments: ['breakfast', 'breakfast'] }).error, 'invalid-meal-moments');
});
