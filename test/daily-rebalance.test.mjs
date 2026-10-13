import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile,readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { rebalanceDailyEnergy,isAdultOn,previewDailyRebalance,applyDailyRebalance } from '../src/server/daily-rebalance.mjs';
import { createRecipe,validateRecipeInput } from '../src/server/recipes.mjs';
import { savePlannedMeal,listPlannedMeals } from '../src/server/planning.mjs';
import { breakfastServingLimit,suggestQuantity,rebalanceNaturalPortions } from '../web/portion-planner.js';

const row=(overrides={})=>({itemId:'main',mealId:'lunch',personId:'adult',slot:'lunch',role:'main',quantity:200,recipeName:'Main',unitId:'g',energyKcal:2,proteinG:0.2,complete:true,...overrides});
test('lunch and dinner absorb excess while preserving proteins, drinks, desserts and adolescent portions',()=>{
  const rows=[row({itemId:'breakfast',slot:'breakfast',mealId:'breakfast',unitId:'piece',quantity:2,energyKcal:150,proteinG:10}),row(),row({itemId:'veg',role:'accompaniment',energyKcal:0.3,proteinG:0}),row({itemId:'dinner',mealId:'dinner',slot:'dinner',quantity:250}),row({itemId:'rice',mealId:'dinner',slot:'dinner',role:'accompaniment',quantity:100,proteinG:0.02}),row({itemId:'drink',mealId:'lunch',role:'beverage',quantity:1,unitId:'piece',energyKcal:30,proteinG:0}),row({itemId:'dessert',mealId:'dinner',slot:'dinner',role:'dessert',quantity:1,unitId:'piece',energyKcal:100,proteinG:3})];
  const kid=rows.map(r=>({...r,personId:'teen'}));
  const result=rebalanceDailyEnergy([...rows,...kid],[{id:'adult',name:'Adult',targetKcal:1350},{id:'teen',name:'Teen',targetKcal:1000,reason:'minor-profile'}]);
  assert.ok(result.results[0].afterKcal<=1350);assert.ok(result.changes.some(c=>c.slot==='lunch'));assert.ok(result.changes.some(c=>c.slot==='dinner'));
  assert.ok(result.changes.every(c=>c.personId==='adult' && !['drink','dessert','breakfast'].includes(c.itemId)));
  for(const mealId of ['lunch','dinner']) {
    const protein=rows.filter(r=>r.mealId===mealId).reduce((sum,r)=>sum+(result.changes.find(c=>c.itemId===r.itemId)?.after ?? r.quantity)*r.proteinG,0);
    assert.ok(protein>=40-1e-6);
  }
});
test('four breakfast pieces become two before any lunch or dinner reduction, even within the daily envelope',()=>{
  const result=rebalanceDailyEnergy([row({slot:'breakfast',unitId:'piece',quantity:4,energyKcal:100,proteinG:8,breakfastLimit:2})],[{id:'adult',name:'Adult',targetKcal:1000}]);
  assert.equal(result.changes[0].after,2);assert.equal(result.results[0].beforeKcal,400);assert.equal(result.results[0].afterKcal,200);
  assert.equal(breakfastServingLimit({yield:{unitId:'piece'}}),2);
  assert.equal(breakfastServingLimit({yield:{unitId:'g',amount:2400}},{yield:{unitId:'piece',amount:24}}),200);
  const suggestion=suggestQuantity({dailyTargetKcal:1850,slot:'breakfast',recipeKcal:113,recipeUnit:'piece'});
  const balanced=rebalanceNaturalPortions([{role:'main',quantity:Math.min(suggestion.quantity,2),step:1,recipeKcal:113,proteinG:8,maxQuantity:2}],suggestion.slotBudgetKcal);
  assert.equal(balanced.proposals[0].quantity,2);assert.equal(balanced.proteinTargetMet,false);
});
test('unknown nutrition or binding protein floors prevent unsupported reductions',()=>{
  assert.equal(rebalanceDailyEnergy([row({complete:false})],[{id:'adult',targetKcal:100}]).changes.length,0);
  const limited=rebalanceDailyEnergy([row()],[{id:'adult',targetKcal:100}]);
  assert.equal(limited.changes.length,0);assert.equal(limited.results[0].reason,'cannot-fully-rebalance');
  assert.equal(isAdultOn('2010-10-20','2026-10-20'),false);assert.equal(isAdultOn('2008-10-20','2026-10-19'),false);assert.equal(isAdultOn('2008-10-20','2026-10-20'),true);assert.equal(isAdultOn(null,'2026-10-20'),false);
});

test('preview/apply is atomic, detects stale plans and preserves minors and raw stocks in PostgreSQL',async()=>{
  const db=new PGlite();
  try {
    const dir=new URL('../db/migrations/',import.meta.url);
    for(const file of (await readdir(dir)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,dir),'utf8'));
    const pool={async query(sql,args=[]){const r=await db.query(sql,args);return {...r,rowCount:r.rows.length||r.affectedRows||0};},async connect(){return {...this,release(){}};}};
    const h='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',adult='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',teen='cccccccc-cccc-4ccc-8ccc-cccccccccccc',food='dddddddd-dddd-4ddd-8ddd-dddddddddddd',date='2026-10-20';
    await pool.query('INSERT INTO households(id,name) VALUES($1,\'Test\')',[h]);
    for(const [id,birth]of [[adult,'1975-10-23'],[teen,'2010-01-01']]) {
      await pool.query('INSERT INTO people(id,household_id,display_name,birth_date) VALUES($1,$2,$3,$4)',[id,h,id,birth]);
      await pool.query('INSERT INTO person_profile_history(id,person_id,effective_from,daily_energy_kcal,daily_energy_origin) VALUES($1,$1,\'2026-01-01\',500,\'manual\')',[id]);
    }
    await pool.query('INSERT INTO foods(id,canonical_name,source) VALUES($1,\'Synthetic muffin\',\'manual\')',[food]);
    for(const [n,v]of [['energy_kcal',100],['protein_g',8],['carbohydrate_g',10],['fat_g',2],['fibre_g',1]])await pool.query('INSERT INTO food_nutrients(food_id,nutrient_id,value_per_100g) VALUES($1,$2,$3)',[food,n,v]);
    const recipe=await createRecipe(pool,validateRecipeInput({householdId:h,name:'Muffin',yield:{amount:1,unitId:'piece'},lines:[{foodId:food,quantity:100,unitId:'g'}]}).data);
    const meal=await savePlannedMeal(pool,null,{householdId:h,mealDate:date,slot:'breakfast',notes:'Keep',attendeeIds:[adult,teen],items:[{recipeId:recipe.id,role:'main',amounts:[{personId:adult,quantity:4},{personId:teen,quantity:4}]}]});
    const preview=await previewDailyRebalance(pool,h,date);assert.equal(preview.changes.length,1);assert.equal(preview.changes[0].personId,adult);
    assert.equal((await listPlannedMeals(pool,h,'2026-10-19'))[0].items[0].amounts[0].quantity,4);
    await pool.query('UPDATE planned_amounts SET quantity=5 WHERE person_id=$1',[adult]);
    assert.equal((await applyDailyRebalance(pool,h,date,preview.token)).error,'rebalance-preview-stale');
    const fresh=await previewDailyRebalance(pool,h,date);assert.equal((await applyDailyRebalance(pool,h,date,fresh.token)).applied,1);
    const after=(await listPlannedMeals(pool,h,'2026-10-19'))[0];assert.equal(after.id,meal.id);assert.equal(after.notes,'Keep');
    assert.equal(after.items[0].amounts.find(a=>a.personId===adult).quantity,2);assert.equal(after.items[0].amounts.find(a=>a.personId===teen).quantity,4);
    assert.equal((await applyDailyRebalance(pool,h,date,fresh.token)).error,'rebalance-preview-stale');
    assert.equal((await pool.query('SELECT count(*) FROM ingredient_stock_movements')).rows[0].count,0);
  }finally{await db.close();}
});
