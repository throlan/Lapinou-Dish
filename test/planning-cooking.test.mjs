import {Readable} from 'node:stream';
import {accountGateway} from '../src/server/accounts.mjs';
import {handleRequest} from '../src/server/app.mjs';
import {communityRoutes} from '../src/server/community.mjs';
import test from 'node:test';
import {setMealPrepared} from '../src/server/meal-preparation.mjs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {cookingPeriod,freePlanningSlots,validPlanningDate} from '../web/planning-periods.js';
import {createRecipe,updateRecipe,validateRecipeInput} from '../src/server/recipes.mjs';
import {savePlannedMeal,validatePlannedMeal,listPlannedMeals} from '../src/server/planning.mjs';
import {addStockLot,listPreparationsToMake,listShoppingRequirements,listStock,validateProductionInput} from '../src/server/household-planning.mjs';
import {cookingForMeal} from '../src/server/planning-cooking.mjs';
import {mealStockReadiness} from '../src/server/meal-stock-readiness.mjs';

async function fixture(t){
 const db=new PGlite();t.after(()=>db.close());for(const file of (await readdir(new URL('../db/migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL('../db/migrations/'+file,import.meta.url),'utf8'));
 const pool={async query(sql,args=[]){const r=await db.query(sql,args);return {...r,rowCount:r.rows.length||r.affectedRows||0};},async connect(){return {...this,release(){}};}};
 const h=randomUUID(),person=randomUUID(),food=randomUUID();await pool.query("INSERT INTO households(id,name) VALUES($1,'Foyer fictif')",[h]);await pool.query("INSERT INTO people(id,household_id,display_name) VALUES($1,$2,'Personne fictive')",[person,h]);await pool.query("INSERT INTO foods(id,canonical_name,source) VALUES($1,'Aliment fictif','manual')",[food]);
 const input={householdId:h,name:'Recette fictive',productionType:'batch_cooking',yield:{amount:4,unitId:'portion'},lines:[{foodId:food,quantity:100,unitId:'g'}]};
 const recipe=await createRecipe(pool,validateRecipeInput(input).data);
 async function meal(date,slot,quantity,extra={}){const data={householdId:h,mealDate:date,slot,notes:'',attendeeIds:[person],items:[{recipeId:recipe.id,role:'main',amounts:[{personId:person,quantity}]}],...extra};return {data,result:await savePlannedMeal(pool,null,data)};}
 const produce=data=>addStockLot(pool,{householdId:h,recipeId:recipe.id,quantity:4,producedOn:'2026-11-15',storage:'freezer',note:'',requestId:randomUUID(),...data});
 return {pool,h,person,recipe,input,meal,produce};
}

test('calendar periods cross month/year and DST boundaries; availability omits occupied and unsuitable slots',()=>{
 assert.deepEqual(cookingPeriod('2026-11-30','week'),{start:'2026-11-30',end:'2026-12-06'});
 assert.deepEqual(cookingPeriod('2026-12-31','fortnight'),{start:'2026-12-28',end:'2027-01-10'});
 assert.deepEqual(cookingPeriod('2028-02-20','month'),{start:'2028-02-01',end:'2028-02-29'});
 assert.deepEqual(cookingPeriod('2026-03-29','week'),{start:'2026-03-23',end:'2026-03-29'});
 assert.equal(validPlanningDate('2026-02-30'),false);
 const slots=freePlanningSlots('2026-11-16','2026-11-17',[{date:'2026-11-16',slot:'lunch'}],['lunch','dinner']);assert.equal(slots.length,3);assert.ok(!slots.some(s=>s.date==='2026-11-16'&&s.slot==='lunch'));
 assert.throws(()=>freePlanningSlots('2026-01-01','2026-12-31',[]),/invalid-planning-period/);
});

test('catalogue planning refuses a slot that became occupied, preserves it, and keeps historical multi-meal behaviour',async t=>{
 const f=await fixture(t),first=await f.meal('2026-11-16','lunch',2,{requireEmptySlot:true});assert.ok(first.result.id);
 const checked=validatePlannedMeal(first.data);assert.equal(checked.data.requireEmptySlot,true);
 assert.equal((await savePlannedMeal(f.pool,null,checked.data)).error,'planning-slot-unavailable');
 const saved=await listPlannedMeals(f.pool,f.h,'2026-11-16');assert.equal(saved.length,1);assert.equal(saved[0].items[0].amounts[0].quantity,2);
 assert.ok((await f.meal('2026-11-16','lunch',1)).result.id,'the older explicit add-another-meal workflow is preserved');
});

test('one meal/week/two weeks/month recalculate one chronological stock projection and apply the recipe lot minimum',async t=>{
 const f=await fixture(t),a=await f.meal('2026-11-16','lunch',3),b=await f.meal('2026-11-16','dinner',5);await f.meal('2026-11-23','lunch',7);await f.meal('2026-11-30','lunch',2);assert.equal((await f.produce({quantity:4})).error,undefined);
 const scope=type=>cookingForMeal(f.pool,f.h,b.result.id,f.recipe.id,type);
 const one=await scope('meal');assert.equal(one.mealCount,1);assert.equal(one.preparations[0].plannedQuantity,5);assert.equal(one.preparations[0].coveredQuantity,1);assert.equal(one.preparations[0].toMakeQuantity,4);
 assert.equal((await scope('week')).preparations[0].toMakeQuantity,4);
 assert.equal((await scope('fortnight')).preparations[0].toMakeQuantity,11);
 assert.equal((await scope('month')).preparations[0].toMakeQuantity,13);
 await updateRecipe(f.pool,f.recipe.id,validateRecipeInput({...f.input,minimumProductionAmount:12,minimumProductionUnitId:'portion'}).data);
 assert.equal((await scope('meal')).preparations[0].toMakeQuantity,12);
 assert.equal((await scope('fortnight')).preparations[0].toMakeQuantity,12,'minimum surplus is reused within the same range');
 await assert.rejects(cookingForMeal(f.pool,randomUUID(),a.result.id,f.recipe.id,'week'),/planned-meal-not-found/);
 await assert.rejects(cookingForMeal(f.pool,f.h,a.result.id,randomUUID(),'week'),/recipe-not-in-meal/);
});

test('a lot made for dinner cannot be reserved by lunch the same day; replay and moving the meal remain safe',async t=>{
 const f=await fixture(t),lunch=await f.meal('2026-11-16','lunch',3),dinner=await f.meal('2026-11-16','dinner',5),later=await f.meal('2026-11-17','lunch',3);
 const data={quantity:8,plannedStart:'2026-11-16',plannedEnd:'2026-11-16',plannedMealId:dinner.result.id,requestId:randomUUID()};assert.equal(validateProductionInput({householdId:f.h,recipeId:f.recipe.id,producedOn:'2026-11-15',storage:'freezer',...data}).error,undefined);
 assert.equal((await f.produce(data)).error,undefined);const ready=await mealStockReadiness(f.pool,f.h);
 assert.equal(ready.meals.get(lunch.result.id).stockReady,false);assert.equal(ready.meals.get(dinner.result.id).stockReady,true);assert.equal(ready.meals.get(later.result.id).stockReady,true,'surplus is released after the targeted day');
 assert.equal((await f.produce(data)).replayed,true);assert.equal((await f.produce({...data,plannedMealId:lunch.result.id})).error,'production-request-conflict');
 assert.equal((await f.produce({...data,requestId:randomUUID(),plannedMealId:randomUUID()})).error,'invalid-production-period');
 await savePlannedMeal(f.pool,dinner.result.id,{...dinner.data,mealDate:'2026-11-18'});const moved=await mealStockReadiness(f.pool,f.h);assert.equal(moved.meals.get(later.result.id).stockReady,false);assert.equal(moved.meals.get(dinner.result.id).stockReady,true);
});



test('calendar cooking scales untracked recipes for display without changing their stock-tracking mode',async t=>{
 const f=await fixture(t);
 await updateRecipe(f.pool,f.recipe.id,validateRecipeInput({...f.input,productionType:'none'}).data);
 const meal=await f.meal('2026-11-16','lunch',3);
 const range=['2026-11-16','2026-11-16'];
 const expectedItems={includeMenuRecipes:true};
 assert.deepEqual(await listPreparationsToMake(f.pool,f.h,...range),[]);
 const [overview]=await listPreparationsToMake(f.pool,f.h,...range,expectedItems);
 assert.equal(overview.recipeId,f.recipe.id);
 assert.deepEqual(overview.mealIds,[meal.result.id]);
 assert.equal(overview.toMakeQuantity,3);
 assert.deepEqual(await listStock(f.pool,f.h),[]);
 const result=await cookingForMeal(f.pool,f.h,meal.result.id,f.recipe.id,'meal');
 assert.equal(result.recipe.productionType,'none');
 assert.equal(result.preparations[0].toMakeQuantity,3);
 assert.equal(result.plannedMealId,meal.result.id);
 const prepared=await setMealPrepared(f.pool,f.h,result.plannedMealId,true);
 assert.equal(prepared.prepared,true);
 assert.deepEqual((await cookingForMeal(f.pool,f.h,meal.result.id,f.recipe.id,'meal')).preparations,[]);
 assert.equal((await f.pool.query('SELECT id FROM stock_lots')).rows.length,0);
 assert.equal((await setMealPrepared(f.pool,f.h,result.plannedMealId,true)).replayed,true);
 assert.deepEqual(await listPreparationsToMake(f.pool,f.h,...range,expectedItems),[]);
 assert.deepEqual(await listShoppingRequirements(f.pool,f.h,...range),[]);
});

test('a compatible recipe revision uses existing finished stock after changing the production category',async t=>{
 const f=await fixture(t);
 const lot=await f.produce({quantity:4});
 const revised=await updateRecipe(f.pool,f.recipe.id,validateRecipeInput({...f.input,productionType:'pastry'}).data);
 assert.equal(revised.replacesRecipeId,f.recipe.id);
 const {result}=await f.meal('2026-11-23','lunch',3,{items:[{recipeId:revised.id,role:'main',amounts:[{personId:f.person,quantity:3}]}]});
 assert.equal((await listPlannedMeals(f.pool,f.h,'2026-11-23')).find(meal=>meal.id===result.id).stockReady,true);
 const [stock]=await listStock(f.pool,f.h);
 assert.equal(stock.recipeId,revised.id);
 assert.equal(stock.lots[0].id,lot.id);
 assert.equal(stock.availableQuantity,1);
 assert.deepEqual(await listShoppingRequirements(f.pool,f.h,'2026-11-23','2026-11-23'),[]);
});

test('a targeted split bundle reserves all its parts for the selected meal and retains independent quantities',async t=>{
 const f=await fixture(t);const input={...f.input,name:'Plat séparé fictif',separateStarch:true,servingMode:'three',cookingFactors:{main:1,starch:1,vegetables:1},lines:[{foodId:f.input.lines[0].foodId,quantity:100,unitId:'g',servingPart:'main'},{foodId:f.input.lines[0].foodId,quantity:100,unitId:'g',servingPart:'starch',cookingFactor:2},{foodId:f.input.lines[0].foodId,quantity:200,unitId:'g',servingPart:'vegetables'}]};
 await updateRecipe(f.pool,f.recipe.id,validateRecipeInput(input).data);const lunch=await f.meal('2026-11-16','lunch',2),dinner=await f.meal('2026-11-16','dinner',2);const scope=await cookingForMeal(f.pool,f.h,dinner.result.id,f.recipe.id,'meal');assert.equal(scope.preparations.length,3);
 const servingQuantities=scope.preparations.map(p=>({recipeId:p.recipeId,quantity:p.toMakeQuantity}));assert.equal((await f.produce({servingQuantities,plannedStart:'2026-11-16',plannedEnd:'2026-11-16',plannedMealId:dinner.result.id})).error,undefined);
 const ready=await mealStockReadiness(f.pool,f.h);assert.equal(ready.meals.get(lunch.result.id).stockReady,false);assert.equal(ready.meals.get(dinner.result.id).stockReady,true);
 assert.ok((await cookingForMeal(f.pool,f.h,dinner.result.id,f.recipe.id,'meal')).preparations.every(p=>p.toMakeQuantity===0));
});


test('scoped cooking and free slots keep household boundaries and do not grant stock writes to members',async t=>{
 const f=await fixture(t),planned=await f.meal('2026-11-16','lunch',2);
 async function request(method,url,body,cookie){const req=Readable.from(body?[JSON.stringify(body)]:[]);Object.assign(req,{method,url,headers:{host:'localhost',cookie},socket:{remoteAddress:randomUUID()}});const headers={},res={setHeader(k,v){headers[k]=v;},writeHead(status){this.status=status;},end(value){this.body=JSON.parse(String(value));}};await accountGateway(req,res,f.pool,'setup-password',(q,r,p)=>handleRequest(q,r,p,'setup-password'),communityRoutes);return {status:res.status,body:res.body,cookie:headers['Set-Cookie']?.split(';')[0]};}
 const owner=await request('POST','/api/accounts/bootstrap',{applicationPassword:'setup-password',login:'owner',displayName:'Owner',password:'owner-personal-password',householdId:f.h,personId:f.person});assert.equal(owner.status,201);
 await request('POST','/api/accounts/members',{login:'reader',displayName:'Reader',password:'reader-personal-password',role:'member'},owner.cookie);const reader=await request('POST','/api/login',{login:'reader',password:'reader-personal-password'});
 const path='/api/planning/meals/'+planned.result.id+'/cooking?householdId='+f.h+'&recipeId='+f.recipe.id+'&scope=meal';assert.equal((await request('GET',path,null,reader.cookie)).status,200);
 const slots=await request('GET','/api/planning/available-slots?householdId='+f.h+'&startDate=2026-11-16&endDate=2026-11-16',null,reader.cookie);assert.equal(slots.status,200);assert.ok(!slots.body.slots.some(s=>s.slot==='lunch'));assert.equal(slots.body.slots.length,3);
 assert.equal((await request('GET',path,null)).status,401);assert.equal((await request('POST','/api/household-planning/production',{householdId:f.h},reader.cookie)).status,403);
 assert.equal((await request('POST','/api/planning/meals',{...planned.data,requireEmptySlot:true},owner.cookie)).status,409);
 const other=randomUUID(),otherMeal=randomUUID();await f.pool.query("INSERT INTO households(id,name) VALUES($1,'Other private house')",[other]);await f.pool.query("INSERT INTO planned_meals(id,household_id,meal_date,slot,notes) VALUES($1,$2,'2026-11-17','dinner','Private')",[otherMeal,other]);
 assert.equal((await request('GET','/api/planning/available-slots?householdId='+other+'&startDate=2026-11-16&endDate=2026-11-17',null,owner.cookie)).status,403);
 assert.equal((await request('GET',path.replace(planned.result.id,otherMeal),null,owner.cookie)).status,404);
 assert.equal((await request('POST','/api/household-planning/production',{householdId:f.h,recipeId:f.recipe.id,quantity:2,producedOn:'2026-11-15',storage:'freezer',plannedStart:'2026-11-17',plannedEnd:'2026-11-17',plannedMealId:otherMeal},owner.cookie)).body.error,'invalid-production-period');
});


test('the exact meal reservation takes priority over a weekly lot so the other meal keeps its share',async t=>{
 const f=await fixture(t),lunch=await f.meal('2026-11-16','lunch',2),dinner=await f.meal('2026-11-16','dinner',2);
 assert.equal((await f.produce({quantity:2,plannedStart:'2026-11-16',plannedEnd:'2026-11-22'})).error,undefined);
 assert.equal((await f.produce({quantity:2,plannedStart:'2026-11-16',plannedEnd:'2026-11-16',plannedMealId:lunch.result.id})).error,undefined);
 const ready=await mealStockReadiness(f.pool,f.h);assert.equal(ready.meals.get(lunch.result.id).stockReady,true);assert.equal(ready.meals.get(dinner.result.id).stockReady,true);
});
