import test from 'node:test';
import assert from 'node:assert/strict';
import { createFood, fillMissingNutritionFromExternal, validateFoodInput } from '../src/server/foods.mjs';
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
  assert.equal(validateRecipeInput({...result.data,recipeType:'custom-patisserie'}).data.recipeType,'custom-patisserie');
  assert.equal(validateRecipeInput({...result.data,recipeType:'custom-'+'x'.repeat(34)}).error,'invalid-recipe-type');
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

test('food validation accepts provenance notes for a copied nutrition profile', () => {
  const result = validateFoodInput({
    name: 'Flocons d’avoine gros', nutrientsPer100g: { energyKcal: 370 }, gramsPerUnit: {},
    sourceNote: 'Copie de flocons d’avoine fins.', nutrientSourceNote: 'Valeurs copiées depuis Ciqual ; à vérifier.',
  }, { creating: true });
  assert.equal(result.error, undefined);
  assert.equal(result.data.sourceNote, 'Copie de flocons d’avoine fins.');
  assert.equal(result.data.nutrientSourceNote, 'Valeurs copiées depuis Ciqual ; à vérifier.');
  assert.equal(validateFoodInput({ name: 'Flocons', nutrientSourceNote: 'x'.repeat(501) }, { creating: true }).error, 'invalid-nutrientSourceNote');
});

test('created food records copied nutrient provenance and unit conversions', async () => {
  const calls = [];
  const id = '10101010-1010-4010-8010-101010101010';
  const client = { async query(sql, values = []) {
    calls.push({ sql, values });
    if (sql.includes('SELECT DISTINCT f.id')) return { rows: [] };
    if (sql.includes('SELECT f.id, f.canonical_name')) return { rows: [{
      id, name: 'Flocons d’avoine gros', brand: null, source: 'manual', source_reference: null, source_note: 'Copie contrôlée',
      grams_per_millilitre: null, nutrient_values: {}, grams_per_unit: { tbsp: '8' }, aliases: ['Flocons d’avoine gros'],
    }] };
    return { rows: [] };
  }, release() {} };
  const food = await createFood({ connect: async () => client }, {
    name: 'Flocons d’avoine gros', brand: null, sourceNote: 'Copie contrôlée', nutrientSourceNote: 'Valeurs initialisées depuis Ciqual ; à vérifier.',
    nutrients: { energyKcal: 370, proteinG: 13, carbohydrateG: 60, fatG: 7, fibreG: 10 }, gramsPerMillilitre: null,
    gramsPerUnit: { tbsp: 8 }, aliases: [],
  });
  assert.equal(food.name, 'Flocons d’avoine gros');
  assert.equal(calls.find(({ sql }) => sql.includes('INSERT INTO foods')).values[3], 'Copie contrôlée');
  assert.ok(calls.filter(({ sql }) => sql.includes('INSERT INTO food_nutrients')).every(({ values }) => values[3] === 'Valeurs initialisées depuis Ciqual ; à vérifier.'));
  assert.ok(calls.some(({ sql, values }) => sql.includes('INSERT INTO food_unit_conversions') && values[1] === 'tbsp' && values[2] === 8));
});

test('external completion fills only missing nutrients and records its source', async () => {
  const targetId = '10101010-1010-4010-8010-101010101010';
  const calls = [];
  const client = {
    async query(sql, values) {
      calls.push({ sql, values });
      if (sql.includes('SELECT id FROM foods')) return { rows: [{ id: targetId }] };
      if (sql.includes('INSERT INTO food_nutrients')) return values[1] === 'fat_g' ? { rows: [{ nutrient_id: 'fat_g' }] } : { rows: [] };
      if (sql.includes('SELECT f.id')) return { rows: [{
        id: targetId, name: 'Oignon jaune', nutrient_values: { energy_kcal: '35.9', protein_g: '1.19', carbohydrate_g: '6.39', fat_g: '0.1', fibre_g: '2.6' },
        grams_per_unit: {}, aliases: [], grams_per_millilitre: null,
      }] };
      return { rows: [] };
    },
    release() { calls.push({ sql: 'RELEASE' }); },
  };
  const product = { barcode: '12345678', name: 'Oignon jaune', brand: 'Exemple', url: 'https://world.openfoodfacts.org/product/12345678', nutrientsPer100g: { energyKcal: 35.9, proteinG: 1.19, carbohydrateG: 6.39, fatG: 0.1, fibreG: 2.6 } };
  const result = await fillMissingNutritionFromExternal({ connect: async () => client }, targetId, product);
  const insert = calls.find(({ sql, values }) => sql.includes('INSERT INTO food_nutrients') && values[1] === 'fat_g');
  assert.match(insert.sql, /WHERE food_nutrients\.value_per_100g IS NULL/);
  assert.deepEqual(insert.values.slice(0, 3), [targetId, 'fat_g', 0.1]);
  assert.match(insert.values[3], /Open Food Facts.*12345678/);
  assert.deepEqual(result.filledNutrients, ['fat_g']);
  assert.equal(result.sourceReference, '12345678');
  assert.equal(result.food.nutrientsPer100g.fatG, 0.1);
  const changeLog = calls.find(({ sql }) => sql.includes('INSERT INTO food_change_log'));
  assert.equal(changeLog.values[2], 'Complément nutritionnel externe');
  assert.ok(calls.some(({ sql }) => sql === 'COMMIT'));
  assert.ok(calls.some(({ sql }) => sql === 'RELEASE'));
});

test('external completion rejects an invalid source reference before database access', async () => {
  const result = await fillMissingNutritionFromExternal({ connect: async () => { throw new Error('must not connect'); } }, 'food-id', { barcode: 'invalid' });
  assert.deepEqual(result, { error: 'invalid-nutrition-source' });
});
