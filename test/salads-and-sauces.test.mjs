import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile,readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createRecipe,validateRecipeInput } from '../src/server/recipes.mjs';
import { savePlannedMeal,validatePlannedMeal,duplicatePlannedMeal,listPlannedMeals } from '../src/server/planning.mjs';
import { addStockLot,listStock } from '../src/server/household-planning.mjs';
import { saveIngredientStock } from '../src/server/ingredient-stock.mjs';
import { rawShoppingRequirements } from '../src/server/shopping-requirements.mjs';
import { calculatePersonEnergy } from '../web/portion-planner.js';
import { recipeTypeLabel,filterRecipeDirectory } from '../web/recipe-directory.js';

const id=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const h=id(1),a=id(2),b=id(3),protein=id(4),veg=id(5),rice=id(6),skyr=id(7);
function input(type,mode='original') {
  const split=mode!=='original';
  return {householdId:h,name:`${type}-${mode}`,recipeType:type,productionType:'batch_cooking',mealMoments:['lunch','dinner'],
    yield:{amount:4,unitId:'portion'},separateStarch:split,servingMode:mode,cookingFactors:{main:1,starch:3,vegetables:1},
    lines:[{foodId:protein,quantity:200,unitId:'g',servingPart:'main'},
      {foodId:veg,quantity:400,unitId:'g',servingPart:mode==='three'?'vegetables':'main'},
      {foodId:rice,quantity:100,unitId:'g',servingPart:['separate','three'].includes(mode)?'starch':'main',cookingFactor:3}]};
}
const checked=value=>{const result=validateRecipeInput(value);assert.equal(result.error,undefined);return result.data;};

test('salads retain dish serving validation and sauce labels filter independently',()=>{
  for(const mode of ['original','whole','separate','three'])assert.equal(checked(input('salad',mode)).recipeType,'salad');
  assert.equal(validateRecipeInput({...input('salad','three'),lines:input('salad').lines}).error,'starch-ingredients-required');
  assert.equal(validateRecipeInput(input('sauce','three')).error,'invalid-serving-parts');
  assert.equal(recipeTypeLabel('salad'),'Salade');assert.equal(recipeTypeLabel('sauce'),'Sauce');
  const recipes=[{id:'salad',name:'Salade',recipeType:'salad'},{id:'sauce',name:'Sauce',recipeType:'sauce'}];
  assert.deepEqual(filterRecipeDirectory(recipes,{type:'salad'}).map(r=>r.id),['salad']);
  assert.deepEqual(filterRecipeDirectory(recipes,{type:'sauce'}).map(r=>r.id),['sauce']);
});

test('salads and optional sauces persist, duplicate, feed shopping and production stock in PostgreSQL',async t=>{
  const db=new PGlite();t.after(()=>db.close());
  const dir=new URL('../db/migrations/',import.meta.url);
  for(const file of (await readdir(dir)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,dir),'utf8'));
  const pool={async query(sql,args=[]){const r=await db.query(sql,args);return {...r,rowCount:r.rows.length||r.affectedRows||0};},async connect(){return {...this,release(){}};}};
  await pool.query("INSERT INTO households(id,name) VALUES($1,'Synthetic')",[h]);
  for(const person of [a,b])await pool.query("INSERT INTO people(id,household_id,display_name) VALUES($1,$2,$3)",[person,h,person]);
  for(const [food,name,energy,proteins] of [[protein,'Protein',200,20],[veg,'Lettuce',25,1.5],[rice,'Rice',350,7],[skyr,'Skyr',60,10]]){
    await pool.query("INSERT INTO foods(id,canonical_name,source) VALUES($1,$2,'manual')",[food,name]);
    for(const [nutrient,value] of [['energy_kcal',energy],['protein_g',proteins],['carbohydrate_g',5],['fat_g',1],['fibre_g',1]]){
      await pool.query('INSERT INTO food_nutrients(food_id,nutrient_id,value_per_100g) VALUES($1,$2,$3)',[food,nutrient,value]);
    }
    await saveIngredientStock(pool,{householdId:h,foodId:food,quantityG:10000,minimumG:0,targetG:0,leadDays:0,version:0});
  }
  const salads=[];
  for(const [mode,count] of [['original',0],['whole',1],['separate',2],['three',3]]){
    const salad=await createRecipe(pool,checked(input('salad',mode)));
    assert.equal(salad.recipeType,'salad');assert.equal(salad.servingParts.length,count);
    if(count)assert.equal(salad.servingParts.reduce((sum,p)=>sum+p.nutrition.batch.energyKcal,0),salad.nutrition.batch.energyKcal);
    salads.push(salad);
  }
  const salad=salads.at(-1);
  const sauce=await createRecipe(pool,checked({...input('sauce'),name:'Sauce skyr',yield:{amount:200,unitId:'g'},lines:[{foodId:skyr,quantity:200,unitId:'g'}]}));
  const greens=await createRecipe(pool,checked({...input('salad'),name:'Salade verte',productionType:'none',yield:{amount:400,unitId:'g'},lines:[{foodId:veg,quantity:400,unitId:'g'}]}));
  const payload={householdId:h,mealDate:'2026-10-19',slot:'lunch',notes:'',attendeeIds:[a,b],items:[
    {recipeId:salad.id,role:'main',amounts:[{personId:a,quantity:1},{personId:b,quantity:1}]},
    {recipeId:greens.id,role:'accompaniment',amounts:[{personId:a,quantity:40},{personId:b,quantity:40}]},
    {recipeId:sauce.id,role:'sauce',amounts:[{personId:a,quantity:30}]},
  ]};
  const valid=validatePlannedMeal(payload);assert.equal(valid.error,undefined);
  assert.equal(validatePlannedMeal({...payload,items:[{...payload.items[2],amounts:[]}]}).error,'invalid-sauce-amounts');
  assert.equal(validatePlannedMeal({...payload,items:[{...payload.items[2],amounts:[{personId:a,quantity:0}]}]}).error,'invalid-planned-quantity');
  const meal=await savePlannedMeal(pool,null,valid.data);
  assert.equal(meal.items.length,5);
  assert.deepEqual(meal.items.find(i=>i.role==='sauce').amounts,[{personId:a,quantity:30}]);
  assert.deepEqual(calculatePersonEnergy(meal,a),{kcal:240.5,known:true});
  assert.deepEqual(calculatePersonEnergy(meal,b),{kcal:222.5,known:true});
  const needs=await rawShoppingRequirements(pool,h,'2026-10-19','2026-10-19');
  const quantities=Object.fromEntries(needs.map(row=>[row.foodId,Number(row.quantity)]));
  assert.deepEqual(quantities,{[protein]:100,[veg]:280,[rice]:50,[skyr]:30});
  const copy=await duplicatePlannedMeal(pool,meal.id,{householdId:h,requestId:id(20),slot:'lunch',dates:['2026-10-20']});
  const saved=(await listPlannedMeals(pool,h,'2026-10-19')).find(m=>m.id===copy.mealIds[0]);
  assert.deepEqual(saved.items.map(i=>({role:i.role,recipeId:i.recipeId,amounts:i.amounts})),meal.items.map(i=>({role:i.role,recipeId:i.recipeId,amounts:i.amounts})));
  await addStockLot(pool,{householdId:h,recipeId:salad.id,producedOn:'2026-10-19',quantity:4,storage:'fridge',note:'',requestId:id(21)});
  await addStockLot(pool,{householdId:h,recipeId:sauce.id,producedOn:'2026-10-19',quantity:200,storage:'fridge',note:'',requestId:id(22)});
  const stock=await listStock(pool,h);
  assert.equal(stock.find(s=>s.recipeId===sauce.id).producedQuantity,200);
  assert.equal(stock.find(s=>s.recipeId===sauce.id).plannedQuantity,60);
  for(const part of salad.servingParts)assert.equal(stock.find(s=>s.recipeId===part.id).producedQuantity,part.yield.amount);
  const after=await rawShoppingRequirements(pool,h,'2026-10-19','2026-10-20');
  assert.deepEqual(after.map(row=>[row.foodId,Number(row.quantity)]),[[veg,160]]);
  // Reapplying the new constraints must not reclassify existing dishes or sauces.
  await db.exec(await readFile(new URL('20261016_salads_and_sauces.sql',dir),'utf8'));
  assert.equal((await pool.query('SELECT recipe_type FROM recipes WHERE id=$1',[sauce.id])).rows[0].recipe_type,'sauce');
});
