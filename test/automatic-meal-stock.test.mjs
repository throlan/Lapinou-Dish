import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {mealStockReadiness,settleHouseholdMealStock,stockLocalDate,startMealStockClock} from '../src/server/meal-stock-readiness.mjs';
import {availableRecipeStock} from '../src/server/recipe-ingredients.mjs';
import {addStockLot,cancelStockLot,listPreparationsToMake,listStock,validateProductionInput} from '../src/server/household-planning.mjs';
import {savePlannedMeal,listPlannedMeals,deletePlannedMeal,duplicatePlannedMeal} from '../src/server/planning.mjs';
import {setMealPrepared} from '../src/server/meal-preparation.mjs';
import {countPreparationStock} from '../src/server/preparation-stock.mjs';
import {countProductInventory,listIngredientStock} from '../src/server/ingredient-stock.mjs';
import {createRecipe,updateRecipe,validateRecipeInput} from '../src/server/recipes.mjs';
import {previewDailyRebalance} from '../src/server/daily-rebalance.mjs';

async function fixture(t){
 const db=new PGlite();t.after(()=>db.close());
 const dir=new URL('../db/migrations/',import.meta.url);
 for(const file of (await readdir(dir)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,dir),'utf8'));
 const pool={async query(sql,args=[]){const r=await db.query(sql,args);return {...r,rowCount:r.rows.length||r.affectedRows||0};},async connect(){return {...this,release(){}};}};
 const h=randomUUID(),other=randomUUID(),person=randomUUID(),food=randomUUID();
 await pool.query("INSERT INTO households(id,name) VALUES($1,'Synthetic'),($2,'Other')",[h,other]);
 await pool.query("INSERT INTO people(id,household_id,display_name) VALUES($1,$2,'Synthetic')",[person,h]);
 await pool.query("INSERT INTO foods(id,canonical_name,source) VALUES($1,'Synthetic flour','manual')",[food]);
 await countProductInventory(pool,{householdId:h,foodId:food,quantity:10000,unitId:'g',version:0});
 const recipe=async(type='batch_cooking')=>{const id=randomUUID();await pool.query("INSERT INTO recipes(id,household_id,name,yield_amount,yield_unit_id,production_type) VALUES($1,$2,'Synthetic recipe',1,'portion',$3)",[id,h,type]);await pool.query("INSERT INTO recipe_lines(id,recipe_id,food_id,quantity,unit_id) VALUES(gen_random_uuid(),$1,$2,10,'g')",[id,food]);return id;};
 const meal=async(date,items,slot='lunch')=>{const data={householdId:h,mealDate:date,slot,notes:'Keep exact quantities',attendeeIds:[person],items:items.map(([recipeId,quantity])=>({recipeId,role:'main',amounts:[{personId:person,quantity}]}))};const result=await savePlannedMeal(pool,null,data);assert.ok(result.id,JSON.stringify(result));return {...result,input:data};};
 const lot=async(id,quantity,period={})=>{const result=await addStockLot(pool,{householdId:h,recipeId:id,producedOn:'2026-11-01',quantity,storage:'freezer',note:'Synthetic',...period});assert.ok(result.id,JSON.stringify(result));return result;};
 const physical=async id=>(await availableRecipeStock(pool,h)).get(id)??0;
 return {pool,h,other,person,food,recipe,meal,lot,physical};
}
const now=date=>new Date(date);

test('Paris day boundary uses winter and summer offsets',()=>{
 assert.equal(stockLocalDate(now('2026-11-02T22:59:59Z')),'2026-11-02');
 assert.equal(stockLocalDate(now('2026-11-02T23:00:00Z')),'2026-11-03');
 assert.equal(stockLocalDate(now('2026-06-01T21:59:59Z')),'2026-06-01');
 assert.equal(stockLocalDate(now('2026-06-01T22:00:00Z')),'2026-06-02');
});

test('readiness reserves without debit, then uses once after the meal day, catches up on restart and preserves menus',async t=>{
 const f=await fixture(t),r=await f.recipe();
 const a=await f.meal('2026-11-02',[[r,2]]),b=await f.meal('2026-11-03',[[r,2]]);
 await f.lot(r,4);
 await (startMealStockClock(f.pool,{clock:()=>now('2026-11-02T22:59:59Z'),onError:e=>assert.fail(e)}))();
 let meals=await listPlannedMeals(f.pool,f.h,'2026-11-02');
 assert.ok(meals.every(m=>m.stockReady&&!m.preparedAt&&!m.stockUsedAt));assert.equal(await f.physical(r),4);
 const rawBefore=(await listIngredientStock(f.pool,f.h))[0].quantityG;
 assert.equal((await settleHouseholdMealStock(f.pool,f.h,{now:now('2026-11-02T23:00:00Z')})).used,1);
 assert.equal(await f.physical(r),2);
 assert.equal((await settleHouseholdMealStock(f.pool,f.h,{now:now('2026-11-02T23:00:01Z')})).used,0);
 meals=await listPlannedMeals(f.pool,f.h,'2026-11-02');
 assert.ok(meals.find(m=>m.id===a.id).stockUsedAt);assert.equal(meals.find(m=>m.id===b.id).stockReady,true);
 await (startMealStockClock(f.pool,{clock:()=>now('2026-11-06T12:00:00Z'),onError:e=>assert.fail(e)}))();
 assert.equal(await f.physical(r),0);assert.equal((await listIngredientStock(f.pool,f.h))[0].quantityG,rawBefore);
 const persisted=await f.pool.query('SELECT quantity FROM planned_amounts ORDER BY quantity');assert.deepEqual(persisted.rows.map(x=>Number(x.quantity)),[2,2]);
 const stock=(await listStock(f.pool,f.h)).find(x=>x.recipeId===r);assert.equal(stock.physicalQuantity,0);assert.equal(stock.plannedQuantity,0);
 assert.deepEqual(await listPreparationsToMake(f.pool,f.h,'2026-11-02','2026-11-08'),[]);
});

test('limited stock covers the earliest slot, not insertion order, and a count correction removes readiness',async t=>{
 const f=await fixture(t),r=await f.recipe();const late=await f.meal('2026-11-02',[[r,2]],'dinner'),early=await f.meal('2026-11-02',[[r,2]],'breakfast');
 const lot=await f.lot(r,2);let result=await mealStockReadiness(f.pool,f.h);
 assert.equal(result.meals.get(early.id).stockReady,true);assert.equal(result.meals.get(late.id).stockReady,false);
 await countPreparationStock(f.pool,{householdId:f.h,recipeId:r,quantity:1,expectedQuantity:2});
 result=await mealStockReadiness(f.pool,f.h);assert.ok([...result.meals.values()].every(m=>!m.stockReady));assert.equal(result.ready.length,0);
 await countPreparationStock(f.pool,{householdId:f.h,recipeId:r,quantity:2,expectedQuantity:1});
 assert.equal((await cancelStockLot(f.pool,f.h,lot.id)).cancelled,true);
 assert.equal((await mealStockReadiness(f.pool,f.h)).ready.length,0);
});

test('a targeted batch protects its dates, agrees with preparation requirements and releases surplus only later',async t=>{
 const f=await fixture(t),r=await f.recipe();const early=await f.meal('2026-11-02',[[r,2]]),target=await f.meal('2026-11-09',[[r,2]]),later=await f.meal('2026-11-16',[[r,2]]);
 const scoped=await f.lot(r,4,{plannedStart:'2026-11-09',plannedEnd:'2026-11-15',requestId:randomUUID()});
 let result=await mealStockReadiness(f.pool,f.h);
 assert.equal(result.meals.get(early.id).stockReady,false);assert.equal(result.meals.get(target.id).stockReady,true);assert.equal(result.meals.get(later.id).stockReady,true);
 const needs=await listPreparationsToMake(f.pool,f.h,'2026-11-02','2026-11-15');assert.equal(needs[0].toMakeQuantity,2);assert.equal(needs[0].coveredQuantity,2);
 const general=await f.lot(r,2);
 await settleHouseholdMealStock(f.pool,f.h,{now:now('2026-11-02T12:00:00Z')});
 await settleHouseholdMealStock(f.pool,f.h,{now:now('2026-11-03T12:00:00Z')});
 const used=(await f.pool.query('SELECT source_allocations FROM recipe_stock_uses WHERE automatic')).rows[0];assert.equal(used.source_allocations[0].lotId,general.id);
 result=await mealStockReadiness(f.pool,f.h);assert.equal(result.ready.find(x=>x.meal_id===target.id).allocations[0].lotId,scoped.id);assert.equal(await f.physical(r),4);
 const inventory=(await listStock(f.pool,f.h)).find(x=>x.recipeId===r);assert.equal(inventory.lots.find(l=>l.id===scoped.id).plannedStart,'2026-11-09');
 assert.equal((await mealStockReadiness(f.pool,f.other)).meals.size,0);
});

test('partial meals are not ready; manual preparation after partial automatic use and undo never double-debit',async t=>{
 const f=await fixture(t),a=await f.recipe(),b=await f.recipe(),meal=await f.meal('2026-11-02',[[a,2],[b,2]]);
 await f.lot(a,2);let result=await mealStockReadiness(f.pool,f.h);assert.equal(result.meals.get(meal.id).stockReady,false);assert.equal(result.meals.get(meal.id).readyItemIds.length,1);
 await settleHouseholdMealStock(f.pool,f.h,{now:now('2026-11-02T12:00:00Z')});
 assert.equal((await settleHouseholdMealStock(f.pool,f.h,{now:now('2026-11-03T12:00:00Z')})).used,1);
 assert.equal(await f.physical(a),0);
 assert.equal((await savePlannedMeal(f.pool,meal.id,meal.input)).error,'prepared-meal-locked');assert.equal((await deletePlannedMeal(f.pool,meal.id,f.h)).error,'prepared-meal-locked');
 assert.equal((await previewDailyRebalance(f.pool,f.h,'2026-11-02')).changes.length,0);
 await f.lot(b,2);const rawBefore=(await listIngredientStock(f.pool,f.h))[0].quantityG;
 assert.equal((await setMealPrepared(f.pool,f.h,meal.id,true)).prepared,true);assert.equal(await f.physical(a),0);assert.equal(await f.physical(b),0);
 assert.equal((await listIngredientStock(f.pool,f.h))[0].quantityG,rawBefore);
 const spare=await f.lot(a,2);assert.equal((await cancelStockLot(f.pool,f.h,spare.id)).cancelled,true);
 assert.equal((await setMealPrepared(f.pool,f.h,meal.id,false)).prepared,false);assert.equal(await f.physical(a),2);assert.equal(await f.physical(b),2);
 assert.equal((await settleHouseholdMealStock(f.pool,f.h,{now:now('2026-11-04T12:00:00Z')})).used,0);
 assert.equal((await mealStockReadiness(f.pool,f.h)).meals.get(meal.id).autoStockDisabled,true);
 assert.equal(await deletePlannedMeal(f.pool,meal.id,f.h),true);
});

test('activation preserves historical meals and copied meals do not inherit usage',async t=>{
 const f=await fixture(t),r=await f.recipe(),old=await f.meal('2026-11-01',[[r,2]]),current=await f.meal('2026-11-02',[[r,2]]);await f.lot(r,6);
 await settleHouseholdMealStock(f.pool,f.h,{now:now('2026-11-02T12:00:00Z')});
 assert.equal((await settleHouseholdMealStock(f.pool,f.h,{now:now('2026-11-03T12:00:00Z')})).used,1);
 const meals=await listPlannedMeals(f.pool,f.h,'2026-11-01');assert.equal(meals.find(m=>m.id===old.id).stockUsedAt,null);assert.ok(meals.find(m=>m.id===current.id).stockUsedAt);
 const copy=await duplicatePlannedMeal(f.pool,current.id,{householdId:f.h,dates:['2026-11-04'],slot:'lunch',requestId:randomUUID()});
 assert.ok(copy.mealIds?.length,JSON.stringify(copy));const copied=(await listPlannedMeals(f.pool,f.h,'2026-11-02')).find(m=>m.id===copy.mealIds[0]);assert.equal(copied.stockUsedAt,null);assert.equal(copied.preparedAt,null);assert.equal(copied.stockReady,true);
});

test('stock of an ingredient reserves chronologically without falsely declaring the whole untracked dish ready',async t=>{
 const f=await fixture(t),bread=await f.recipe(),dish=await f.recipe('none');
 await f.pool.query("INSERT INTO recipe_lines(id,recipe_id,ingredient_recipe_id,quantity,unit_id) VALUES(gen_random_uuid(),$1,$2,1,'portion')",[dish,bread]);
 const first=await f.meal('2026-11-02',[[dish,2]]),second=await f.meal('2026-11-03',[[bread,2]]);await f.lot(bread,2);
 const result=await mealStockReadiness(f.pool,f.h);assert.equal(result.meals.get(first.id).stockReady,false);assert.equal(result.meals.get(second.id).stockReady,false);assert.equal(result.ready.length,0);
});

test('production date scope is validated and cannot be changed by an idempotent replay',async t=>{
 const f=await fixture(t),r=await f.recipe(),base={householdId:f.h,recipeId:r,producedOn:'2026-11-01',quantity:2,storage:'freezer',requestId:randomUUID(),plannedStart:'2026-11-09',plannedEnd:'2026-11-15'};
 assert.equal(validateProductionInput({...base,plannedEnd:null}).error,'invalid-production-period');
 assert.equal(validateProductionInput({...base,plannedEnd:'2026-11-08'}).error,'invalid-production-period');
 assert.equal(validateProductionInput({...base,plannedEnd:'2027-03-08'}).error,'invalid-production-period');
 const lot=await addStockLot(f.pool,base);assert.ok(lot.id);assert.equal((await addStockLot(f.pool,base)).replayed,true);
 assert.equal((await addStockLot(f.pool,{...base,plannedEnd:'2026-11-16'})).error,'production-request-conflict');
});


test('all active parts must be produced; child lots inherit the targeted period and retain exact gram amounts',async t=>{
 const f=await fixture(t);
 const data={householdId:f.h,name:'Synthetic separated dish',recipeType:'dish',productionType:'batch_cooking',yield:{amount:1,unitId:'portion'},separateStarch:true,servingMode:'three',cookingFactors:{main:1,vegetables:1,starch:2},lines:[{foodId:f.food,quantity:100,unitId:'g',servingPart:'main',cookingFactor:1},{foodId:f.food,quantity:200,unitId:'g',servingPart:'vegetables',cookingFactor:1},{foodId:f.food,quantity:50,unitId:'g',servingPart:'starch',cookingFactor:2}]};
 const recipe=await createRecipe(f.pool,validateRecipeInput(data).data);
 const early=await f.meal('2026-11-02',[[recipe.id,1]]),target=await f.meal('2026-11-09',[[recipe.id,1]]);
 await f.lot(recipe.id,1,{plannedStart:'2026-11-09',plannedEnd:'2026-11-15'});
 const readiness=await mealStockReadiness(f.pool,f.h);assert.equal(readiness.meals.get(early.id).stockReady,false);assert.equal(readiness.meals.get(target.id).stockReady,true);assert.equal(readiness.meals.get(target.id).readyItemIds.length,3);
 assert.ok((await listStock(f.pool,f.h)).filter(x=>recipe.servingParts.some(p=>p.id===x.recipeId)).every(x=>x.lots[0].plannedStart==='2026-11-09'));
 await settleHouseholdMealStock(f.pool,f.h,{now:now('2026-11-09T12:00:00Z')});
 assert.equal((await settleHouseholdMealStock(f.pool,f.h,{now:now('2026-11-10T12:00:00Z')})).used,3);
 for(const part of recipe.servingParts)assert.equal(await f.physical(part.id),0);
 const quantities=(await f.pool.query('SELECT a.quantity FROM planned_amounts a JOIN planned_meal_items i ON i.id=a.planned_item_id WHERE i.meal_id=$1 ORDER BY a.quantity',[target.id])).rows.map(x=>Number(x.quantity));assert.deepEqual(quantities,[100,100,200]);
 assert.equal((await updateRecipe(f.pool,recipe.id,validateRecipeInput({...data,yield:{amount:2,unitId:'portion'}}).data)).error,'recipe-used-in-prepared-meal');
});
