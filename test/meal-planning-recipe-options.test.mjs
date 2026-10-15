import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../web/app.js', import.meta.url), 'utf8');
const start = source.indexOf('function recipesForPlanning(');
const end = source.indexOf('\nfunction renderPlannedItems(', start);
assert.ok(start >= 0 && end > start, 'planning recipe selector is present');

const recipes = [
  { id: 'breakfast-dessert', name: 'Dessert du matin', recipeType: 'dessert', mealMoments: ['breakfast', 'snack'] },
  { id: 'lunch-dessert', name: 'Dessert du déjeuner', recipeType: 'dessert', mealMoments: ['lunch'] },
  { id: 'breakfast-dish', name: 'Plat du matin', recipeType: 'dish', mealMoments: ['breakfast'] },
  { id: 'breakfast-drink', name: 'Boisson du matin', recipeType: 'beverage', mealMoments: ['breakfast'] },
];
const context = { allPlanningRecipes: () => recipes, isIndividualRole: role => ['beverage', 'dessert'].includes(role) };
runInNewContext(source.slice(start, end) + '\nglobalThis.selectRecipes = recipesForPlanning;', context);

test('breakfast desserts can be shared; moment tags and individual dessert choices still apply', () => {
  assert.deepEqual(
    Array.from(context.selectRecipes('breakfast', 'main'), recipe => recipe.id),
    ['breakfast-dessert', 'breakfast-dish'],
  );
  assert.deepEqual(
    Array.from(context.selectRecipes('lunch', 'main'), recipe => recipe.id),
    [],
  );
  assert.deepEqual(
    Array.from(context.selectRecipes('lunch', 'dessert'), recipe => recipe.id),
    ['lunch-dessert'],
  );
});
