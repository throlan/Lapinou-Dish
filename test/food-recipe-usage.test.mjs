import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { listFoodRecipeUsage } from '../src/server/foods.mjs';
import { handleRequest } from '../src/server/app.mjs';

const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const household = uuid(1), foreign = uuid(2), used = uuid(3), unused = uuid(4);
const parent = uuid(5), child = uuid(6), sameName = uuid(7), foreignRecipe = uuid(8), childOnly = uuid(9);

test('food usage deduplicates ingredient lines and serving parts while preserving distinct recipes and household scope', async t => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    CREATE TABLE recipes (id uuid PRIMARY KEY, household_id uuid, name text, parent_recipe_id uuid REFERENCES recipes(id));
    CREATE TABLE recipe_lines (recipe_id uuid REFERENCES recipes(id), food_id uuid);
  `);
  for (const [id, householdId, name, parentId] of [
    [parent, household, 'Bowl', null], [child, household, 'Bowl — Riz', parent],
    [sameName, household, 'Bowl', null], [foreignRecipe, foreign, 'Autre foyer', null],
  ]) await db.query('INSERT INTO recipes VALUES ($1,$2,$3,$4)', [id,householdId,name,parentId]);
  for (const recipeId of [parent,parent,child,sameName,foreignRecipe]) {
    await db.query('INSERT INTO recipe_lines VALUES ($1,$2)', [recipeId,used]);
  }
  await db.query('INSERT INTO recipe_lines VALUES ($1,$2)', [child,childOnly]);
  const usage = await listFoodRecipeUsage(db,household,[used,unused,childOnly]);
  assert.deepEqual(usage, [
    { foodId: used, recipes: [{id:parent,name:'Bowl'},{id:sameName,name:'Bowl'}] },
    { foodId: unused, recipes: [] },
    { foodId: childOnly, recipes: [{id:parent,name:'Bowl'}] },
  ]);
  assert.deepEqual(await listFoodRecipeUsage(db,foreign,[used]),[{foodId:used,recipes:[{id:foreignRecipe,name:'Autre foyer'}]}]);
});

async function invoke(url,pool,password) {
  const response={setHeader(){},writeHead(status){this.status=status;},end(body){this.body=JSON.parse(body);}};
  await handleRequest({method:'GET',url,headers:{}},response,pool,password);
  return response;
}
const url = `/api/foods/recipe-usage?householdId=${household}&foodIds=${used}`;

test('food usage API requires authentication and validates the household and bounded food IDs before querying', async () => {
  const pool={query(){throw new Error('must not query');}};
  assert.equal((await invoke(url,pool,'password')).status,401);
  for (const invalid of [
    url.replace(household,'bad'), url.replace(used,'bad'),
    `/api/foods/recipe-usage?householdId=${household}`,
    `/api/foods/recipe-usage?householdId=${household}&foodIds=${Array.from({length:101},(_,n)=>uuid(n+100)).join(',')}`,
  ]) assert.equal((await invoke(invalid,pool)).status,400);
});

test('food usage API returns explicit zero usage and normalizes duplicate food IDs', async () => {
  let calls=0;
  const pool={query:async(sql,args)=>{calls++;assert.deepEqual(args,[household,[used,unused]]);return {rows:[{food_id:used,id:parent,name:'Bowl'}]};}};
  const response=await invoke(`${url},${used.toUpperCase()},${unused}`,pool);
  assert.equal(response.status,200);
  assert.equal(calls,1);
  assert.deepEqual(response.body,{usage:[{foodId:used,recipes:[{id:parent,name:'Bowl'}]},{foodId:unused,recipes:[]}]});
});

test('food usage failures never masquerade as an unused ingredient', async () => {
  const response=await invoke(url,{query:async()=>{throw new Error('database unavailable');}});
  assert.equal(response.status,500);
  assert.equal(response.body.error,'food-recipe-usage-failed');
  assert.equal(response.body.usage,undefined);
});
