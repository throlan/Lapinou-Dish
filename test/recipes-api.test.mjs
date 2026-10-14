import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest } from '../src/server/app.mjs';

test('recipe list validates the household before querying', async () => {
  const response = await invoke('/api/recipes?householdId=bad', { query: async () => { throw new Error('must not query'); } });
  assert.equal(response.status, 400);
  assert.deepEqual(response.body, { error: 'invalid-household-id' });
});

test('recipe list returns recipes for the selected household', async () => {
  const householdId = '10101010-1010-4010-8010-101010101010';
  const pool = { query: async (sql, values) => {
    assert.match(sql, /FROM recipes WHERE household_id/);
    assert.deepEqual(values, [householdId]);
    return { rows: [] };
  } };
  const response = await invoke(`/api/recipes?householdId=${householdId}`, pool);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { recipes: [] });
});

test('recipe update returns 404 and rolls back when the recipe is outside the household', async () => {
  const householdId = '10101010-1010-4010-8010-101010101010';
  const calls = [];
  const client = { query: async (sql) => { calls.push(sql); return { rowCount: 0, rows: [] }; }, release() {} };
  const pool = { connect: async () => client };
  const response = await invoke('/api/recipes/30303030-3030-4030-8030-303030303030', pool, {
    method: 'PUT',
    body: { householdId, name: 'Muffins', yield: { amount: 4, unitId: 'piece' }, lines: [{ foodId: '20202020-2020-4020-8020-202020202020', quantity: 100, unitId: 'g' }] },
  });
  assert.equal(response.status, 404);
  assert.deepEqual(response.body, { error: 'recipe-not-found' });
  assert.equal(calls[0], 'BEGIN');
  assert.ok(calls.some(sql=>/UPDATE recipes/.test(sql)));
  assert.equal(calls.at(-1), 'ROLLBACK');
});

test('recipe update replaces its lines atomically and recalculates nutrition', async () => {
  const recipeId = '30303030-3030-4030-8030-303030303030';
  const householdId = '10101010-1010-4010-8010-101010101010';
  const foodId = '20202020-2020-4020-8020-202020202020';
  const calls = [];
  let updateValues;
  const client = { query: async (sql, values) => {
    calls.push(sql);
    if (sql.includes('m.prepared_at IS NOT NULL')) return { rowCount: 0, rows: [] };
    if (sql.startsWith('UPDATE recipes')) updateValues = values;
    if (sql.startsWith('UPDATE recipes')) return { rowCount: 1, rows: [{ id: recipeId }] };
    if (sql.startsWith('SELECT id, name, description')) return { rows: [{ id: recipeId, name: 'Muffins revus', description: '', yield_amount: '2', yield_unit_id: 'piece', recipe_type: 'beverage', meal_moments: ['breakfast', 'snack'] }] };
    if (sql.startsWith('SELECT id, food_id')) return { rows: [{ id: '40404040-4040-4040-8040-404040404040', food_id: foodId, quantity: '200', unit_id: 'g', sort_order: 0 }] };
    if (sql.startsWith('SELECT f.id')) return { rows: [{ id: foodId, name: 'Skyr nature', source: 'manual', nutrient_values: { energy_kcal: '60', protein_g: '10', carbohydrate_g: '4', fat_g: '0', fibre_g: null }, grams_per_unit: {}, grams_per_millilitre: null }] };
    return { rowCount: 1, rows: [] };
  }, release() {} };
  const pool = { connect: async () => client };
  const response = await invoke(`/api/recipes/${recipeId}`, pool, {
    method: 'PUT',
    body: { householdId, name: 'Cappuccino maison', recipeType: 'beverage', mealMoments: ['breakfast', 'snack'], yield: { amount: 2, unitId: 'piece' }, lines: [{ foodId, quantity: 200, unitId: 'g' }] },
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.recipe.nutrition.batch.energyKcal, 120);
  assert.equal(response.body.recipe.nutrition.perYieldUnit.energyKcal, 60);
  assert.equal(updateValues[8], 'beverage');
  assert.equal(updateValues[9], 'none');
  assert.deepEqual(updateValues[10], ['breakfast', 'snack']);
  assert.equal(calls[0], 'BEGIN');
  assert.ok(calls.some((sql) => sql.startsWith('DELETE FROM recipe_lines')));
  assert.ok(calls.some((sql) => sql.startsWith('INSERT INTO recipe_lines')));
  assert.equal(calls.at(-1), 'COMMIT');
});

test('recipe text import stores a reviewable draft and its parsed ingredients', async () => {
  const householdId = '10101010-1010-4010-8010-101010101010';
  const calls = [];
  const client = { query: async (sql, values = []) => { calls.push({ sql, values }); return { rowCount: 1, rows: [] }; }, release() {} };
  const response = await invoke('/api/recipe-imports/text', { connect: async () => client }, {
    method: 'POST', body: { householdId, sourceUrl: 'https://www.instagram.com/p/example/', text: 'Muffins protéinés : environ 80 kcal\nPour 9 muffins :\n100 g de compote\n2 œufs\nTu mélanges puis tu cuis.' },
  });
  assert.equal(response.status, 201);
  assert.equal(response.body.drafts.length, 1);
  assert.ok(calls.some(({ sql }) => sql.includes("'draft'")));
  const lineInsert = calls.find(({ sql }) => sql.startsWith('INSERT INTO recipe_import_draft_lines'));
  assert.match(lineInsert.values[2], /100 g de compote/);
  assert.equal(lineInsert.values[4], 'compote');
  assert.equal(calls.at(-1).sql, 'COMMIT');
});

async function invoke(url, pool, { method = 'GET', body, headers = {} } = {}) {
  const response = {
    status: 200,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    writeHead(status) { this.status = status; },
    end(value) { this.body = JSON.parse(value); },
  };
  const request = { method, url, headers, socket: { remoteAddress: Math.random().toString() }, async *[Symbol.asyncIterator]() { if (body !== undefined) yield Buffer.from(JSON.stringify(body)); } };
  await handleRequest(request, response, pool);
  return response;
}
