import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import {handleRequest} from '../src/server/app.mjs';
import { readRecipe, updateRecipeSettings, validateRecipeSettings } from '../src/server/recipes.mjs';

const householdId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const otherHouseholdId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const recipeId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const childId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const foodId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

test('quick recipe settings update only taxonomy and carry it to serving parts', async t => {
  const db = new PGlite();
  t.after(() => db.close());
  const pool = {
    async query(sql, params = []) { const result = await db.query(sql, params); return { ...result, rowCount: result.rows.length || result.affectedRows || 0 }; },
    async connect() { return { ...this, release() {} }; },
  };
  const dir = new URL('../db/migrations/', import.meta.url);
  for (const file of (await readdir(dir)).filter(file => file.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file, dir), 'utf8'));
  await db.exec(`
    INSERT INTO households(id,name) VALUES ('${householdId}','Home'),('${otherHouseholdId}','Other');
    INSERT INTO foods(id,canonical_name,source) VALUES ('${foodId}','Test rice','manual');
    INSERT INTO recipes(id,household_id,name,yield_amount,yield_unit_id,production_type,meal_moments)
      VALUES ('${recipeId}','${householdId}','Rice bowl',4,'portion','none',ARRAY['lunch']);
    INSERT INTO recipes(id,household_id,name,yield_amount,yield_unit_id,production_type,meal_moments,parent_recipe_id,serving_part)
      VALUES ('${childId}','${householdId}','Rice bowl — starch',500,'g','none',ARRAY['lunch'],'${recipeId}','starch');
    INSERT INTO recipe_lines(id,recipe_id,food_id,quantity,unit_id) VALUES
      ('11111111-1111-4111-8111-111111111111','${recipeId}','${foodId}',200,'g'),
      ('22222222-2222-4222-8222-222222222222','${childId}','${foodId}',200,'g');
  `);
  const before = await readRecipe(pool, recipeId);
  assert.equal(before.version, 1);
  const input = { householdId, version: before.version, productionType: 'batch_cooking', mealMoments: ['dinner', 'snack'] };
  assert.equal(validateRecipeSettings(input).error, undefined);
  const saved = await updateRecipeSettings(pool, recipeId, input);
  assert.equal(saved.version, before.version + 1);
  assert.equal(saved.productionType, 'batch_cooking');
  assert.deepEqual(saved.mealMoments, ['dinner', 'snack']);
  assert.deepEqual(saved.lines, before.lines);
  const child = await readRecipe(pool, childId);
  assert.equal(child.productionType, 'batch_cooking');
  assert.deepEqual(child.mealMoments, ['dinner', 'snack']);
  assert.equal(child.lines.length, 1);
  assert.deepEqual(await updateRecipeSettings(pool, recipeId, input), { error: 'recipe-version-conflict' });
  assert.equal(await updateRecipeSettings(pool, recipeId, { ...input, householdId: otherHouseholdId }), null);
  await db.exec(`
    INSERT INTO planned_meals(id,household_id,meal_date,slot,prepared_at)
      VALUES ('33333333-3333-4333-8333-333333333333','${householdId}','2026-10-15','lunch',now());
    INSERT INTO planned_meal_items(id,meal_id,recipe_id)
      VALUES ('44444444-4444-4444-8444-444444444444','33333333-3333-4333-8333-333333333333','${childId}');
  `);
  assert.deepEqual(await updateRecipeSettings(pool, recipeId, { ...input, version: saved.version, productionType: 'none' }), { error: 'recipe-used-in-prepared-meal' });
  const retagged = await updateRecipeSettings(pool, recipeId, { ...input, version: saved.version, mealMoments: ['lunch'] });
  assert.deepEqual(retagged.mealMoments, ['lunch']);
  assert.equal(retagged.productionType, 'batch_cooking');
  assert.equal(validateRecipeSettings({ ...input, mealMoments: ['snack', 'snack'] }).error, 'invalid-meal-moments');
  assert.equal(validateRecipeSettings({ ...input, productionType: 'unknown' }).error, 'invalid-production-type');
  const snapshot=await readRecipe(pool,recipeId),partBefore=await readRecipe(pool,childId);
  const response={setHeader(){},writeHead(code){this.code=code;},end(body){this.body=JSON.parse(body);}};
  const renameInput={householdId,version:snapshot.version,name:'  Nouveau titre — recette  '};
  const validation=validateRecipeSettings(renameInput);assert.equal(validation.data.name,'Nouveau titre — recette');
  for(const name of ['', '   ', 'x'.repeat(201), null])assert.equal(validateRecipeSettings({...renameInput,name}).error,'invalid-name');
  await handleRequest({method:'PATCH',url:`/api/recipes/${recipeId}`,headers:{},async *[Symbol.asyncIterator](){yield JSON.stringify(renameInput);}},response,pool);
  assert.equal(response.code,200,JSON.stringify(response.body));
  const renamed=response.body.recipe;
  assert.equal(renamed.name,'Nouveau titre — recette');assert.equal(renamed.productionType,snapshot.productionType);
  assert.deepEqual(renamed.lines,snapshot.lines);assert.deepEqual(renamed.yield,snapshot.yield);assert.deepEqual(renamed.nutrition,snapshot.nutrition);
  assert.equal(renamed.version,snapshot.version+1);
  const partAfter=await readRecipe(pool,childId);assert.equal(partAfter.name,'Nouveau titre — recette — Féculents');
  assert.deepEqual(partAfter.lines,partBefore.lines);assert.deepEqual(partAfter.yield,partBefore.yield);
  assert.deepEqual(await updateRecipeSettings(pool,recipeId,validation.data),{error:'recipe-version-conflict'});
  assert.equal(await updateRecipeSettings(pool,recipeId,{...validation.data,version:renamed.version,householdId:otherHouseholdId}),null);

});
