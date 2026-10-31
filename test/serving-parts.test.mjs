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
  assert.equal(validateRecipeInput(input({servingMode:'separate',lines:input().lines.map(line=>({...line,servingPart:'main'}))})).error,'starch-ingredients-required');
  assert.equal(validateRecipeInput(input({servingMode:'separate',separateStarch:false})).error,'invalid-serving-parts');
  assert.equal(validateRecipeInput(input({servingMode:'three'})).error,'vegetable-ingredients-required');
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
    await t.test('switching a saved whole preparation to separate starch converts its existing gram meals and lots once',async()=>{
      const wholeLines=input().lines.map(line=>({...line,servingPart:'main',cookingFactor:line.foodId===rice?3:null}));
      const whole=await createRecipe(pool,checked(input({name:'Plat déjà enregistré',servingMode:'whole',lines:wholeLines})));
      const wholeMain=whole.servingParts[0];assert.equal(wholeMain.yield.amount,2300);
      const before=await savePlannedMeal(pool,null,{householdId:h,mealDate:'2026-10-22',slot:'lunch',notes:'Conserver',attendeeIds:[person],items:[{recipeId:wholeMain.id,role:'main',amounts:[{personId:person,quantity:575}]}]});
      const caloriesBefore=before.items[0].amounts[0].quantity*before.items[0].recipe.nutrition.perYieldUnit.energyKcal;
      const production=await addStockLot(pool,{householdId:h,recipeId:whole.id,producedOn:date,quantity:4,storage:'freezer',note:'',requestId:null});
      const ingredientBefore=(await listIngredientStock(pool,h))[0].quantityG;
      const splitInput=checked(input({name:'Plat déjà enregistré',servingMode:'separate'}));
      const split=await updateRecipe(pool,whole.id,splitInput);
      assert.equal(split.error,undefined);assert.equal(split.servingParts.length,2);
      const splitMain=split.servingParts.find(p=>p.servingPart==='main'),splitStarch=split.servingParts.find(p=>p.servingPart==='starch');
      assert.equal(splitMain.id,wholeMain.id);
      const mealAfter=(await listPlannedMeals(pool,h,date)).find(m=>m.id===before.id);
      assert.deepEqual(mealAfter.items.map(i=>i.amounts[0].quantity),[387.5,187.5]);
      const caloriesAfter=mealAfter.items.reduce((sum,i)=>sum+i.amounts[0].quantity*i.recipe.nutrition.perYieldUnit.energyKcal,0);
      assert.ok(Math.abs(caloriesBefore-caloriesAfter)<1e-8);
      const stocks=await listStock(pool,h);
      assert.equal(stocks.find(s=>s.recipeId===splitMain.id).producedQuantity,1550);
      assert.equal(stocks.find(s=>s.recipeId===splitStarch.id).producedQuantity,750);
      assert.equal((await listIngredientStock(pool,h))[0].quantityG,ingredientBefore);
      assert.deepEqual(await rawShoppingRequirements(pool,h,'2026-10-22','2026-10-22'),[]);
      await updateRecipe(pool,whole.id,checked(input({name:'Plat déjà enregistré',servingMode:'separate'})));
      assert.equal((await listPlannedMeals(pool,h,date)).find(m=>m.id===before.id).items.length,2);
      assert.equal((await listStock(pool,h)).find(s=>s.recipeId===splitStarch.id).producedQuantity,750);
      assert.equal((await listIngredientStock(pool,h))[0].quantityG,ingredientBefore);
      await cancelStockLot(pool,h,production.id);
      assert.equal((await listIngredientStock(pool,h))[0].quantityG,ingredientBefore+250);
    });
    await t.test('a whole gram preparation can return to recipe pieces with its meals and stock preserved',async()=>{
      const originalYield={amount:24,unitId:'piece'};
      const wholeLines=input().lines.map(line=>({...line,servingPart:'main',cookingFactor:line.foodId===rice?3:null}));
      const whole=await createRecipe(pool,checked(input({name:'Muffins',yield:originalYield,servingMode:'whole',lines:wholeLines})));
      const part=whole.servingParts[0];
      const meal=await savePlannedMeal(pool,null,{householdId:h,mealDate:'2026-10-23',slot:'breakfast',notes:'',attendeeIds:[person],items:[{recipeId:part.id,role:'main',amounts:[{personId:person,quantity:part.yield.amount/4}]}]});
      await addStockLot(pool,{householdId:h,recipeId:whole.id,producedOn:date,quantity:24,storage:'freezer',note:'Muffins',requestId:null});
      assert.equal((await listStock(pool,h)).some(stock=>stock.recipeId===part.id),true);
      const restored=await updateRecipe(pool,whole.id,checked(input({name:'Muffins',yield:originalYield,separateStarch:false,servingMode:'original',lines:wholeLines})));
      assert.equal(restored.error,undefined);
      assert.equal(restored.separateStarch,false);
      assert.equal(restored.servingParts.length,0);
      const saved=(await listPlannedMeals(pool,h,'2026-10-23')).find(entry=>entry.id===meal.id);
      assert.equal(saved.items.length,1);
      assert.equal(saved.items[0].recipe.id,whole.id);
      assert.equal(saved.items[0].recipe.yield.unitId,'piece');
      assert.equal(saved.items[0].amounts[0].quantity,6);
      const stock=(await listStock(pool,h)).find(entry=>entry.recipeId===whole.id);
      assert.equal(stock.producedQuantity,24);
      assert.equal(stock.plannedQuantity,6);
      assert.equal(Number((await pool.query('SELECT count(*) FROM recipes WHERE parent_recipe_id=$1',[whole.id])).rows[0].count),0);
    });
    await t.test('two components become three without changing the existing starch, repeating deductions or losing reservations',async()=>{
      const two=await createRecipe(pool,checked(input({name:'Deux puis trois',servingMode:'separate'})));
      const oldMain=two.servingParts.find(p=>p.servingPart==='main'),ricePart=two.servingParts.find(p=>p.servingPart==='starch');
      const before=await savePlannedMeal(pool,null,{householdId:h,mealDate:'2026-10-23',slot:'lunch',notes:'',attendeeIds:[person],items:[{recipeId:oldMain.id,role:'main',amounts:[{personId:person,quantity:387.5}]},{recipeId:ricePart.id,role:'accompaniment',amounts:[{personId:person,quantity:120}]}]});
      const production=await addStockLot(pool,{householdId:h,recipeId:two.id,producedOn:date,quantity:4,storage:'freezer',note:'',requestId:null});
      const stockBefore=(await listIngredientStock(pool,h))[0].quantityG;
      const threeInput=()=>checked(input({name:'Deux puis trois',servingMode:'three',lines:input().lines.map(line=>({...line,servingPart:line.foodId===veg?'vegetables':line.servingPart}))}));
      const three=await updateRecipe(pool,two.id,threeInput());
      assert.equal(three.error,undefined);assert.equal(three.servingParts.length,3);
      assert.deepEqual(Object.fromEntries(three.servingParts.map(p=>[p.servingPart,p.yield.amount])),{main:750,starch:750,vegetables:800});
      const after=(await listPlannedMeals(pool,h,date)).find(m=>m.id===before.id);
      assert.deepEqual(Object.fromEntries(after.items.map(i=>[i.recipe.servingPart,i.amounts[0].quantity])),{main:187.5,starch:120,vegetables:200});
      const total=meal=>meal.items.reduce((sum,i)=>sum+i.amounts[0].quantity*i.recipe.nutrition.perYieldUnit.energyKcal,0);
      assert.ok(Math.abs(total(before)-total(after))<1e-8);
      assert.equal((await listIngredientStock(pool,h))[0].quantityG,stockBefore);
      const stock=await listStock(pool,h);
      for(const part of three.servingParts) assert.equal(stock.find(s=>s.recipeId===part.id).producedQuantity,part.yield.amount);
      await updateRecipe(pool,two.id,threeInput());
      assert.equal((await listPlannedMeals(pool,h,date)).find(m=>m.id===before.id).items.length,3);
      const copies=await duplicatePlannedMeal(pool,before.id,{householdId:h,requestId:'99999999-9999-4999-8999-999999999999',slot:'lunch',dates:['2026-10-24']});
      assert.equal(copies.mealIds.length,1);
      assert.equal((await listPlannedMeals(pool,h,date)).find(m=>m.id===copies.mealIds[0]).items.length,3);
      const v=three.servingParts.find(p=>p.servingPart==='vegetables');
      await cancelStockLot(pool,h,stock.find(s=>s.recipeId===v.id).lots[0].id);
      assert.equal((await listIngredientStock(pool,h))[0].quantityG,stockBefore+250);
      assert.equal((await cancelStockLot(pool,h,production.id)).replayed,true);
    });
    await t.test('new three-part recipes expand whole-recipe portions into three independent gram items',async()=>{
      const three=await createRecipe(pool,checked(input({servingMode:'three',lines:input().lines.map(line=>({...line,servingPart:line.foodId===veg?'vegetables':line.servingPart}))})));
      const meal=await savePlannedMeal(pool,null,{householdId:h,mealDate:'2026-10-25',slot:'lunch',notes:'',attendeeIds:[person],items:[{recipeId:three.id,role:'main',amounts:[{personId:person,quantity:1}]}]});
      assert.equal(meal.items.length,3);
      assert.deepEqual(Object.fromEntries(meal.items.map(i=>[i.recipe.servingPart,i.amounts[0].quantity])),{main:187.5,starch:187.5,vegetables:200});
      assert.ok(meal.items.filter(i=>i.recipe.servingPart!=='main').every(i=>i.role==='accompaniment'));
    });
    await t.test('three serving parts can become two while old menus keep their retired part',async()=>{
      const three=await createRecipe(pool,checked(input({name:'Poulet et légumes avec riz',servingMode:'three',lines:input().lines.map(line=>({...line,servingPart:line.foodId===veg?'vegetables':line.servingPart}))})));
      const oldVegetables=three.servingParts.find(part=>part.servingPart==='vegetables');
      const oldMeal=await savePlannedMeal(pool,null,{householdId:h,mealDate:'2026-10-26',slot:'dinner',notes:'Historique',attendeeIds:[person],items:[{recipeId:three.id,role:'main',amounts:[{personId:person,quantity:1}]}]});
      const two=await updateRecipe(pool,three.id,checked(input({name:'Poulet et légumes avec riz',servingMode:'separate',lines:input().lines.map(line=>({...line,servingPart:line.foodId===rice?'starch':'main'}))})));
      assert.equal(two.error,undefined);
      assert.deepEqual(two.servingParts.map(part=>part.servingPart).sort(),['main','starch']);
      assert.equal(two.archivedServingParts.length,1);
      assert.equal(two.archivedServingParts[0].id,oldVegetables.id);
      const savedOld=(await listPlannedMeals(pool,h,'2026-10-26')).find(meal=>meal.id===oldMeal.id);
      assert.ok(savedOld.items.some(item=>item.recipe.id===oldVegetables.id));
      const newMeal=await savePlannedMeal(pool,null,{householdId:h,mealDate:'2026-10-27',slot:'dinner',notes:'Nouvelle composition',attendeeIds:[person],items:[{recipeId:three.id,role:'main',amounts:[{personId:person,quantity:1}]}]});
      assert.equal(newMeal.items.length,2);
      assert.ok(newMeal.items.every(item=>item.recipe.id!==oldVegetables.id));
      const threeAgain=await updateRecipe(pool,three.id,checked(input({name:'Poulet et légumes avec riz',servingMode:'three',lines:input().lines.map(line=>({...line,servingPart:line.foodId===veg?'vegetables':line.servingPart}))})));
      assert.equal(threeAgain.servingParts.length,3);
      assert.equal(threeAgain.archivedServingParts[0].id,oldVegetables.id);
      assert.notEqual(threeAgain.servingParts.find(part=>part.servingPart==='vegetables').id,oldVegetables.id);
    });
  }finally{await db.close();}
});
