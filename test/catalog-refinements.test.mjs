import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCommonFoodRefinements, normalizeAlias } from '../src/domain/catalog-refinements.mjs';

test('common egg and broth aliases are normalized and seeded idempotently', async () => {
  assert.equal(normalizeAlias('Œuf (moyen)'), 'oeuf moyen');
  const calls = [];
  const connection = { query: async (sql, values = []) => {
    calls.push({ sql, values });
    if (sql.startsWith('SELECT id FROM foods')) return { rows: [{ id: `food-${values[0]}` }] };
    return { rows: [] };
  } };
  await applyCommonFoodRefinements(connection);
  assert.ok(calls.some(({ sql, values }) => sql.includes('food_aliases') && values.includes('oeuf moyen')));
  assert.ok(calls.some(({ sql, values }) => sql.includes('food_unit_conversions') && values[1] === 50));
  assert.ok(calls.some(({ sql, values }) => sql.includes('food_unit_conversions') && values[1] === 100));
  assert.ok(calls.some(({ sql, values }) => sql.includes('food_unit_conversions') && values[1] === 3));
  assert.ok(calls.some(({ sql, values }) => sql.includes('grams_per_millilitre = COALESCE') && values[1] === 1));
  assert.ok(calls.some(({ sql, values }) => values.includes('bouillon de boeuf deshydrate')));
});
