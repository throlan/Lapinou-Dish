import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile,readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createRecipe,updateRecipe,readRecipe,listRecipes,validateRecipeInput } from '../src/server/recipes.mjs';
import { savePlannedMeal,listPlannedMeals,duplicatePlannedMeal } from '../src/server/planning.mjs';
import { addStockLot,cancelStockLot,listStock } from '../src/server/household-planning.mjs';
import { rawShoppingRequirements } from '../src/server/shopping-requirements.mjs';
import { saveIngredientStock,listIngredientStock } from '../src/server/ingredient-stock.mjs';

const h='11111111-1111-4111-8111-111111111111',person='22222222-2222-4222-8222-222222222222';
const beef='33333333-3333-4333-8333-333333333333',rice='44444444-4444-4444-8444-444444444444',veg='55555555-5555-4555-8555-555555555555';
const date='2026-10-19';
function input(overrides={}) { return {householdId:h,name:'Bœuf teriyaki',recipeType:'dish',productionType:'batch_cooking',mealMoments:['lunch'],yield:{amount:4,unitId:'portion'},separateStarch:true,cookingFactors:{main:1,starch:3},lines:[{foodId:beef,quantity:750,unitId:'g',servingPart:'main'},{foodId:veg,quantity:800,unitId:'g',servingPart:'main'},{foodId:rice,quantity:250,unitId:'g',servingPart:'starch'}],...overrides}; }
const checked = value => { const result=validateRecipeInput(value); assert.equal(result.error,undefined); return result.data; };

test('serving factors are explicit estimates and never classify ingredients by name',()=>{
  for(const factor of [3,2.5,1.25,1.5,2.4,2.3]) assert.equal(checked(input({cookingFactors:{main:1,starch:factor}})).cookingFactors.starch,factor);
  assert.equal(validateRecipeInput(input({cookingFactors:{main:1,starch:0}})).error,'invalid-cooking-factor');
  assert.equal(validateRecipeInput(input({recipeType:'dessert'})).error,'invalid-serving-parts');
  assert.equal(validateRecipeInput(input({lines:[null]})).error,'invalid-food-id');
  const lasagna=checked(input({lines:input().lines.map(line=>({...line,servingPart:'main'}))}));
  assert.deepEqual(Object.keys(lasagna.cookingFactors),['main']);
});

test('gram preparations preserve nutrition, shopping, stock and complete meal duplication',async t=>{
  const db=new PGlite();
  try {
    const dir=new URL('../db/migrations/',import.meta.url);
    for(const file of (await readdir(dir)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,dir),'utf8'));
    const pool={async query(sql,args=[]){const r=await db.query(sql,args);return {...r,rowCount:r.rows.length||r.affectedRows||0};},async connect(){return {...this,release(){}};}};
    await pool.query('INSERT INTO households(id,name) VALUES($1,$2)',[h,'Synthetic']);
    await pool.query('INSERT INTO people(id,household_id,display_name) VALUES($1,$2,$3)',[person,h,'Synthetic person']);
    for(const [id,name,energy,protein] of [[beef,'Bœuf',150,20],[rice,'Riz cru',350,7.4],[veg,'Légumes',30,2]]) {
      await pool.query("INSERT INTO foods(id,canonical_name,source) VALUES($1,$2,'manual')",[id,name]);
      for(const [nutrient,value] of [['energy_kcal',energy],['protein_g',protein],['carbohydrate_g',10],['fat_g',2],['fibre_g',1]])await pool.query('INSERT INTO food_nutrients(food_id,nutrient_id,value_per_100g) VALUES($1,$2,$3)',[id,nutrient,value]);
    }
    let recipe=await createRecipe(pool,checked(input()));
    const main=recipe.servingParts.find(p=>p.servingPart==='main'),starch=recipe.servingParts.find(p=>p.servingPart==='starch');
    await t.test('750 g estimated rice comes from 250 g raw ×3; nutrition uses raw ingredients',()=>{
      assert.equal(starch.yield.amount,750); assert.equal(main.yield.amount,1550);
      assert.equal(starch.nutrition.batch.energyKcal,875);
      assert.equal(starch.nutrition.perYieldUnit.proteinG,18.5/750);
      assert.equal(starch.nutrition.batch.energyKcal+main.nutrition.batch.energyKcal,recipe.nutrition.batch.energyKcal);
    });
    let meal;
    await t.test('independent 300 g main and 120 g rice persist and duplicate unchanged',async()=>{
      meal=await savePlannedMeal(pool,null,{householdId:h,mealDate:date,slot:'lunch',notes:'Test',attendeeIds:[person],items:[{recipeId:main.id,role:'main',amounts:[{personId:person,quantity:300}]},{recipeId:starch.id,role:'accompaniment',amounts:[{personId:person,quantity:120}]}]});
      assert.deepEqual(meal.items.map(i=>i.amounts[0].quantity),[300,120]);
      assert.ok(meal.items.every(i=>i.recipe.yield.unitId==='g'));
      const copied=await duplicatePlannedMeal(pool,meal.id,{householdId:h,requestId:'66666666-6666-4666-8666-666666666666',slot:'lunch',dates:['2026-10-20']});
      assert.equal(copied.mealIds.length,1);
      const meals=await listPlannedMeals(pool,h,date);assert.deepEqual(meals[1].items.map(i=>i.amounts[0].quantity),[300,120]);
    });
    await t.test('shopping converts only the rice served into its raw requirement',async()=>{
      const list=await rawShoppingRequirements(pool,h,date,date);
      assert.equal(list.find(r=>r.foodId===rice).quantity,40);
      assert.ok(Math.abs(list.find(r=>r.foodId===beef).quantity-750*300/1550)<1e-4);
    });
    await saveIngredientStock(pool,{householdId:h,foodId:rice,quantityG:1000,minimumG:0,targetG:1000,leadDays:0,version:0});
    let lot;
    await t.test('one batch adds both gram stocks and deducts the raw rice exactly once',async()=>{
      lot=await addStockLot(pool,{householdId:h,recipeId:recipe.id,producedOn:date,quantity:4,storage:'freezer',note:'Test',requestId:'77777777-7777-4777-8777-777777777777'});
      assert.equal(lot.error,undefined);
      const stocks=await listStock(pool,h);assert.equal(stocks.length,2);
      assert.equal(stocks.find(s=>s.recipeId===main.id).producedQuantity,1550);
      assert.equal(stocks.find(s=>s.recipeId===starch.id).producedQuantity,750);
      assert.equal((await listIngredientStock(pool,h))[0].quantityG,750);
      assert.deepEqual(await rawShoppingRequirements(pool,h,date,date),[]);
      assert.equal((await addStockLot(pool,{householdId:h,recipeId:recipe.id,producedOn:date,quantity:4,storage:'freezer',note:'Test',requestId:'77777777-7777-4777-8777-777777777777'})).replayed,true);
      assert.equal((await listIngredientStock(pool,h))[0].quantityG,750);
    });
    await t.test('cancelling either component cancels the batch and restores ingredients once',async()=>{
      const stocks=await listStock(pool,h);await cancelStockLot(pool,h,stocks[0].lots[0].id);
      assert.equal((await listIngredientStock(pool,h))[0].quantityG,1000);
      await cancelStockLot(pool,h,lot.id);assert.equal((await listIngredientStock(pool,h))[0].quantityG,1000);
      assert.equal((await listStock(pool,h)).every(s=>s.producedQuantity===0),true);
    });
    await t.test('editing factors keeps calendar grams and component identities',async()=>{
      recipe=await updateRecipe(pool,recipe.id,checked(input({cookingFactors:{main:1,starch:2.5}})));
      assert.equal(recipe.servingParts.find(p=>p.servingPart==='starch').id,starch.id);
      assert.equal(recipe.servingParts.find(p=>p.servingPart==='starch').yield.amount,625);
      assert.deepEqual((await listPlannedMeals(pool,h,date))[0].items.map(i=>i.amounts[0].quantity),[300,120]);
      assert.equal((await listRecipes(pool,h)).length,1);
    });
    await t.test('lasagna stays one preparation in grams and existing portions convert proportionally',async()=>{
      const legacy=await createRecipe(pool,checked(input({name:'Lasagnes',separateStarch:false})));
      const oldMeal=await savePlannedMeal(pool,null,{householdId:h,mealDate:'2026-10-21',slot:'dinner',notes:'',attendeeIds:[person],items:[{recipeId:legacy.id,role:'main',amounts:[{personId:person,quantity:1}]}]});
      await addStockLot(pool,{householdId:h,recipeId:legacy.id,producedOn:date,quantity:4,storage:'fridge',note:'',requestId:null});
      const converted=await updateRecipe(pool,legacy.id,checked(input({name:'Lasagnes',lines:input().lines.map(line=>({...line,servingPart:'main',cookingFactor:line.foodId===rice?2.5:null}))})));
      assert.equal(converted.servingParts.length,1);assert.equal(converted.servingParts[0].yield.amount,2175);
      const updated=(await listPlannedMeals(pool,h,date)).find(m=>m.id===oldMeal.id);
      assert.equal(updated.items.length,1);assert.equal(updated.items[0].amounts[0].quantity,543.75);assert.equal(updated.items[0].recipe.yield.unitId,'g');
      assert.equal((await listStock(pool,h)).find(s=>s.recipeId===converted.servingParts[0].id).producedQuantity,2175);
      assert.deepEqual(await rawShoppingRequirements(pool,h,'2026-10-21','2026-10-21'),[]);
    });
    await t.test('invalid conversion rolls back the parent and derived preparations',async()=>{
      const count=(await pool.query('SELECT count(*) FROM recipes')).rows[0].count;
      const bad=await createRecipe(pool,checked(input({lines:[{foodId:beef,quantity:5,unitId:'ml',servingPart:'main'}]})));
      assert.equal(bad.error,'serving-weight-conversion-required');
      assert.equal((await pool.query('SELECT count(*) FROM recipes')).rows[0].count,count);
    });
  }finally{await db.close();}
});
