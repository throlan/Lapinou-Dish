import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {scopedOperation} from '../src/server/accounts.mjs';
import {saveHomeConsumption,readHomeConsumption} from '../src/server/home-consumption.mjs';
import {createRecipe,validateRecipeInput} from '../src/server/recipes.mjs';
import {savePlannedMeal} from '../src/server/planning.mjs';

test('home consumption confirms only the participant’s meals, snapshots macros and rejects stale or private changes',async t=>{
  const db=new PGlite();
  t.after(()=>db.close());
  const dir=new URL('../db/migrations/',import.meta.url);
  for(const file of (await readdir(dir)).filter(file=>file.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,dir),'utf8'));
  const pool={
    async query(sql,values=[]){const result=await db.query(sql,values);return {...result,rowCount:result.rows.length||result.affectedRows||0};},
    async connect(){return {...this,release(){}};}
  };
  const [h,person,other,food]=Array.from({length:4},()=>randomUUID()),date='2026-11-19';
  await pool.query("INSERT INTO households(id,name) VALUES($1,'Test')",[h]);
  await pool.query("INSERT INTO people(id,household_id,display_name) VALUES($1,$3,'A'),($2,$3,'B')",[person,other,h]);
  await pool.query("INSERT INTO foods(id,canonical_name,source) VALUES($1,'Test','manual')",[food]);
  await pool.query("INSERT INTO food_nutrients(food_id,nutrient_id,value_per_100g) VALUES($1,'carbohydrate_g',14),($1,'fat_g',6)",[food]);
  const recipe=await createRecipe(pool,validateRecipeInput({householdId:h,name:'Plat fictif',yield:{amount:1,unitId:'portion'},lines:[{foodId:food,quantity:100,unitId:'g'}]}).data);
  const meal=(slot,personId)=>savePlannedMeal(pool,null,{householdId:h,mealDate:date,slot,notes:'',attendeeIds:[personId],
    items:[{recipeId:recipe.id,role:'main',amounts:[{personId,quantity:2}]}]});
  const lunch=await meal('lunch',other), dinner=await meal('dinner',person);
  const actor={householdId:h,personId:person,role:'member'};
  const save=(ids,revision)=>scopedOperation(pool,actor,scoped=>saveHomeConsumption(scoped,h,person,date,ids,revision));
  assert.equal((await save([lunch.id],null)).error,'meal-not-confirmable');
  const confirmed=await save([dinner.id],null);
  assert.deepEqual(confirmed.meals[0].carbohydrate,{grams:28,incomplete:false});
  assert.deepEqual(confirmed.meals[0].fat,{grams:12,incomplete:false});
  assert.equal((await save([],null)).error,'consumption-changed');
  await pool.query("UPDATE food_nutrients SET value_per_100g=24 WHERE food_id=$1 AND nutrient_id='carbohydrate_g'",[food]);
  const checked=await save([dinner.id],confirmed.revision);
  assert.deepEqual(checked.meals,confirmed.meals);
  const hidden=await scopedOperation(pool,{...actor,personId:other},scoped=>readHomeConsumption(scoped,h,person,date));
  assert.deepEqual(hidden,{meals:[],revision:null});
  const cleared=await save([],checked.revision);
  assert.deepEqual(cleared.meals,[]);
});
