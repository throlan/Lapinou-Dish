import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createRecipe, validateRecipeInput } from '../src/server/recipes.mjs';
import { savePlannedMeal, listPlannedMeals } from '../src/server/planning.mjs';
import { setMealPrepared } from '../src/server/meal-preparation.mjs';
import { addStockLot, cancelStockLot, listPreparationsToMake, listStock } from '../src/server/household-planning.mjs';
import { saveIngredientStock, listIngredientStock } from '../src/server/ingredient-stock.mjs';
import { groupPreparations, suggestedProductionQuantity, scaledIngredients, scaledSourceIngredients, productionRecipe } from '../web/cooking-sheet.js';

test('two unequal family meals determine cooking grams, ingredients and stock without surplus or repeated deductions',async()=>{
  const db=new PGlite();
  try{
    const dir=new URL('../db/migrations/',import.meta.url);
    for(const file of (await readdir(dir)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,dir),'utf8'));
    const pool={async query(sql,args=[]){const r=await db.query(sql,args);return {...r,rowCount:r.rows.length||r.affectedRows||0};},async connect(){return {...this,release(){}};}};
    const householdId=randomUUID(),foodId=randomUUID(),people=Array.from({length:4},()=>randomUUID());
    await pool.query("INSERT INTO households(id,name) VALUES($1,'Synthetic cooking')",[householdId]);
    await pool.query("INSERT INTO foods(id,canonical_name,source) VALUES($1,'Synthetic ingredient','manual')",[foodId]);
    for(const [i,id] of people.entries())await pool.query('INSERT INTO people(id,household_id,display_name) VALUES($1,$2,$3)',[id,householdId,`Person ${i}`]);
    const checked=validateRecipeInput({householdId,name:'Synthetic bowl',recipeType:'dish',productionType:'batch_cooking',mealMoments:['lunch'],yield:{amount:4,unitId:'portion'},separateStarch:true,servingMode:'whole',cookingFactors:{main:1},lines:[{foodId,quantity:2760,unitId:'g',servingPart:'main'}]});
    assert.equal(checked.error,undefined);
    const recipe=await createRecipe(pool,checked.data),target=productionRecipe(recipe);
    assert.equal(target.yield.amount,2760);
    const meals=[];
    for(const [mealDate,amounts] of [['2026-10-20',[600,690,690,690]],['2026-10-23',[600,690,690,690]]]){
      meals.push(await savePlannedMeal(pool,null,{householdId,mealDate,slot:'lunch',notes:'',attendeeIds:people,
        items:[{recipeId:target.id,role:'main',amounts:people.map((personId,i)=>({personId,quantity:amounts[i]}))}]}));
    }
    const readGroup=async()=>groupPreparations(await listPreparationsToMake(pool,householdId,'2026-10-19','2026-10-25'))[0];
    let group=await readGroup();
    assert.equal(group.parts[0].mealCount,2);
    assert.equal(group.parts[0].plannedQuantity,5340);
    assert.equal(suggestedProductionQuantity(group,recipe),5340);
    // A prior lot reduces the cooking need instead of being counted twice.
    await addStockLot(pool,{householdId,recipeId:target.id,producedOn:'2026-10-19',quantity:440,storage:'freezer',note:''});
    await saveIngredientStock(pool,{householdId,foodId,quantityG:10000,minimumG:0,targetG:0,leadDays:0,version:0});
    group=await readGroup();
    assert.equal(suggestedProductionQuantity(group,recipe),4900);
    assert.equal(scaledIngredients(recipe,4900)[0].scaledQuantity,4900);
    // The same gram quantity shown in the cooking sheet is posted to production.
    const request={householdId,recipeId:target.id,producedOn:'2026-10-19',quantity:4900,storage:'freezer',note:'',requestId:randomUUID()};
    const lot=await addStockLot(pool,request);
    assert.equal(lot.error,undefined);
    assert.equal(lot.deductions[0].usedG,4900);
    assert.equal((await addStockLot(pool,request)).replayed,true);
    assert.equal((await listIngredientStock(pool,householdId))[0].quantityG,5100);
    assert.equal((await listStock(pool,householdId)).find(s=>s.recipeId===target.id).producedQuantity,5340);
    assert.equal(suggestedProductionQuantity(await readGroup(),recipe),0);
    // An explicit manual quantity remains possible and cancellation restores stock.
    await cancelStockLot(pool,householdId,lot.id);
    const manual=await addStockLot(pool,{...request,quantity:5000,requestId:randomUUID()});
    assert.equal(manual.deductions[0].usedG,5000);
    await cancelStockLot(pool,householdId,manual.id);
    assert.equal((await listIngredientStock(pool,householdId))[0].quantityG,10000);
    await addStockLot(pool,{...request,requestId:randomUUID()});
    for(const meal of meals)assert.equal((await setMealPrepared(pool,householdId,meal.id,true)).error,undefined);
    assert.equal((await listIngredientStock(pool,householdId))[0].quantityG,5100);
    assert.equal((await listStock(pool,householdId)).find(s=>s.recipeId===target.id).availableQuantity,0);
  }finally{await db.close();}
});

test('free source portions produce the matching gram stock without modifying menu amounts',async()=>{
  const db=new PGlite();
  try{
    const dir=new URL('../db/migrations/',import.meta.url);
    for(const file of (await readdir(dir)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,dir),'utf8'));
    const pool={async query(sql,args=[]){const r=await db.query(sql,args);return {...r,rowCount:r.rows.length||r.affectedRows||0};},async connect(){return {...this,release(){}};}};
    const householdId=randomUUID(),personId=randomUUID(),foodId=randomUUID();
    await pool.query("INSERT INTO households(id,name) VALUES($1,'Synthetic guests')",[householdId]);
    await pool.query("INSERT INTO people(id,household_id,display_name) VALUES($1,$2,'Synthetic person')",[personId,householdId]);
    await pool.query("INSERT INTO foods(id,canonical_name,source) VALUES($1,'Synthetic ingredient','manual')",[foodId]);
    const checked=validateRecipeInput({householdId,name:'Synthetic stew',recipeType:'dish',productionType:'batch_cooking',mealMoments:['lunch'],yield:{amount:4,unitId:'portion'},separateStarch:true,servingMode:'whole',cookingFactors:{main:1},lines:[{foodId,quantity:3327,unitId:'g',servingPart:'main'}]});
    const recipe=await createRecipe(pool,checked.data),target=productionRecipe(recipe);
    await savePlannedMeal(pool,null,{householdId,mealDate:'2026-10-20',slot:'lunch',notes:'Unchanged',attendeeIds:[personId],items:[{recipeId:target.id,role:'main',amounts:[{personId,quantity:2270}]}]});
    const before=await listPlannedMeals(pool,householdId,'2026-10-19');
    await saveIngredientStock(pool,{householdId,foodId,quantityG:20000,minimumG:0,targetG:0,leadDays:0,version:0});
    assert.equal(scaledSourceIngredients(recipe,6)[0].scaledQuantity,4990.5);
    const lot=await addStockLot(pool,{householdId,recipeId:recipe.id,quantity:6,producedOn:'2026-10-19',storage:'fridge',note:'Guests',requestId:randomUUID()});
    assert.equal(lot.error,undefined);assert.equal(lot.deductions[0].usedG,4990.5);
    assert.equal((await listStock(pool,householdId)).find(s=>s.recipeId===target.id).producedQuantity,4990.5);
    assert.deepEqual(await listPlannedMeals(pool,householdId,'2026-10-19'),before);
    await cancelStockLot(pool,householdId,lot.id);
    assert.equal((await listIngredientStock(pool,householdId))[0].quantityG,20000);
    assert.deepEqual(await listPlannedMeals(pool,householdId,'2026-10-19'),before);
  }finally{await db.close();}
});
