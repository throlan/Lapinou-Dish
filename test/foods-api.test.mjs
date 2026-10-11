import test from 'node:test';
import assert from 'node:assert/strict';
import { fillMissingNutrientsFromCiqual, validateFoodInput } from '../src/server/foods.mjs';
import { readRecipe, validateRecipeInput } from '../src/server/recipes.mjs';

test('manual food validation allows unknown nutrients and preserves known zero values', () => {
  const result = validateFoodInput({
    name: 'Skyr nature',
    nutrientsPer100g: { energyKcal: 60, proteinG: 10, carbohydrateG: 0, fatG: 0 },
    gramsPerMillilitre: null,
    gramsPerUnit: { piece: 100 },
    aliases: ['skyr', 'Skyr nature'],
  }, { creating: true });
  assert.equal(result.error, undefined);
  assert.equal(result.data.nutrients.fibreG, null);
  assert.equal(result.data.nutrients.carbohydrateG, 0);
  assert.deepEqual(result.data.gramsPerUnit, { piece: 100 });
});

test('recipe lines require canonical food IDs and a positive named yield', () => {
  const result = validateRecipeInput({
    name: 'Muffins', householdId: '10101010-1010-4010-8010-101010101010',
    yield: { amount: 12, unitId: 'piece' },
    lines: [{ foodId: '20202020-2020-4020-8020-202020202020', quantity: 200, unitId: 'g' }],
  });
  assert.equal(result.error, undefined);
  assert.equal(result.data.lines[0].foodId, '20202020-2020-4020-8020-202020202020');
  assert.equal(validateRecipeInput({ ...result.data, yield: { amount: 0, unitId: 'piece' } }).error, 'invalid-yield');
  assert.equal(validateRecipeInput({ ...result.data, lines: [{ importText: '200g farine' }] }).error, 'invalid-food-id');
});

test('saved recipe nutrition is recalculated from linked food values and recipe yield', async () => {
  const foodId = '20202020-2020-4020-8020-202020202020';
  const rows = [
    [{ id: '30303030-3030-4030-8030-303030303030', name: 'Muffins', description: '', yield_amount: '2', yield_unit_id: 'portion' }],
    [{ id: '40404040-4040-4040-8040-404040404040', food_id: foodId, quantity: '200', unit_id: 'g', sort_order: 0 }],
    [{ id: foodId, name: 'Skyr nature', source: 'manual', nutrient_values: { energy_kcal: '60', protein_g: '10', carbohydrate_g: '4', fat_g: '0', fibre_g: null }, grams_per_unit: {}, grams_per_millilitre: null }],
  ];
  const client = { query: async () => ({ rows: rows.shift() }) };
  const recipe = await readRecipe(client, '30303030-3030-4030-8030-303030303030');
  assert.equal(recipe.nutrition.complete, true);
  assert.equal(recipe.nutrition.batch.energyKcal, 120);
  assert.equal(recipe.nutrition.perYieldUnit.proteinG, 10);
  assert.equal(recipe.nutrition.perYieldUnit.fibreG, null);
  assert.equal(recipe.lines[0].foodName, 'Skyr nature');
});

test('food validation rejects negative values, malformed units and empty updates', () => {
  assert.equal(validateFoodInput({}, { creating: true }).error, 'invalid-name');
  assert.equal(validateFoodInput({ name: 'Huile', nutrientsPer100g: { fatG: -1 } }, { creating: true }).error, 'invalid-fatG');
  assert.equal(validateFoodInput({ name: 'Riz', nutrientsPer100g: {}, gramsPerUnit: { 'one cup': 200 } }, { creating: true }).error, 'invalid-unit-conversions');
  assert.equal(validateFoodInput({}).error, 'empty-update');
});

test('Ciqual completion fills only missing nutrients and returns the updated food', async () => {
  const targetId = '10101010-1010-4010-8010-101010101010';
  const sourceId = '20202020-2020-4020-8020-202020202020';
  const calls = [];
  const client = {
    async query(sql, values) {
      calls.push({ sql, values });
      if (sql.includes('SELECT id FROM foods')) return { rows: [{ id: targetId }] };
      if (sql.includes('SELECT canonical_name')) return { rows: [{ canonical_name: 'Oignon jaune, cru', source_reference: '20239' }] };
      if (sql.includes('INSERT INTO food_nutrients')) return { rows: [{ nutrient_id: 'fat_g' }] };
      if (sql.includes('SELECT f.id')) return { rows: [{
        id: targetId, name: 'Oignon jaune', nutrient_values: { energy_kcal: '35.9', protein_g: '1.19', carbohydrate_g: '6.39', fat_g: '0.1', fibre_g: '2.6' },
        grams_per_unit: {}, aliases: [], grams_per_millilitre: null,
      }] };
      return { rows: [] };
    },
    release() { calls.push({ sql: 'RELEASE' }); },
  };
  const result = await fillMissingNutrientsFromCiqual({ connect: async () => client }, targetId, sourceId);
  const insert = calls.find(({ sql }) => sql.includes('INSERT INTO food_nutrients'));
  assert.match(insert.sql, /source_nutrient\.value_per_100g IS NOT NULL/);
  assert.match(insert.sql, /WHERE food_nutrients\.value_per_100g IS NULL/);
  assert.deepEqual(insert.values.slice(0, 2), [targetId, sourceId]);
  assert.deepEqual(result.filledNutrients, ['fat_g']);
  assert.equal(result.sourceReference, '20239');
  assert.equal(result.food.nutrientsPer100g.fatG, 0.1);
  assert.ok(calls.some(({ sql }) => sql === 'COMMIT'));
  assert.ok(calls.some(({ sql }) => sql === 'RELEASE'));
});
