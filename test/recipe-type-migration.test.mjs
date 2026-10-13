import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir,readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('removing ambiguous recipe types preserves moments and the previous classification',async t=>{
  const db=new PGlite();t.after(()=>db.close());
  const folder=new URL('../db/migrations/',import.meta.url),name='20261013_recipe_types_cleanup.sql';
  for(const file of (await readdir(folder)).filter(file=>file.endsWith('.sql')&&file!==name).sort())await db.exec(await readFile(new URL(file,folder),'utf8'));
  await db.exec(`
    INSERT INTO households(id,name) VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Synthetic household');
    INSERT INTO recipes(id,household_id,name,yield_amount,yield_unit_id,recipe_type,meal_moments) VALUES
    ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Former snack',1,'portion','snack',ARRAY['snack','breakfast']),
    ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Former other',1,'portion','other',ARRAY['dinner']),
    ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Dessert',1,'portion','dessert',ARRAY['snack']);
  `);
  const sql=await readFile(new URL(name,folder),'utf8');await db.exec(sql);
  const result=await db.query('SELECT recipe_type,meal_moments,legacy_recipe_type,version FROM recipes ORDER BY name');
  assert.deepEqual(result.rows,[
    {recipe_type:'dessert',meal_moments:['snack'],legacy_recipe_type:null,version:1},
    {recipe_type:'dish',meal_moments:['dinner'],legacy_recipe_type:'other',version:2},
    {recipe_type:'dish',meal_moments:['snack','breakfast'],legacy_recipe_type:'snack',version:2},
  ]);
  await db.exec(sql);assert.deepEqual((await db.query('SELECT recipe_type,meal_moments,legacy_recipe_type,version FROM recipes ORDER BY name')).rows,result.rows);
  await assert.rejects(db.query("UPDATE recipes SET recipe_type='snack'"),/check constraint/);
});
