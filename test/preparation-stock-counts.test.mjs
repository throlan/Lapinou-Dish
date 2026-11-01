import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createRecipe,validateRecipeInput} from '../src/server/recipes.mjs';
import {savePlannedMeal} from '../src/server/planning.mjs';
import {addStockLot,cancelStockLot,listStock,listPreparationsToMake} from '../src/server/household-planning.mjs';
import {validatePreparationCount,countPreparationStock} from '../src/server/preparation-stock.mjs';
import {listIngredientStock,saveIngredientStock} from '../src/server/ingredient-stock.mjs';
import {availableRecipeStock,recipeRequirements} from '../src/server/recipe-ingredients.mjs';
import {setMealPrepared} from '../src/server/meal-preparation.mjs';
import {Readable} from 'node:stream';
import {handleRequest} from '../src/server/app.mjs';

async function fixture(){
 const db=new PGlite();const dir=new URL('../db/migrations/',import.meta.url);
 for(const file of (await readdir(dir)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,dir),'utf8'));
 const pool={async query(sql,args=[]){const r=await db.query(sql,args);return {...r,rowCount:r.rows.length||r.affectedRows||0};},async connect(){return {...this,release(){}};}};
 const householdId=randomUUID(),personId=randomUUID(),foodId=randomUUID();
 await pool.query("INSERT INTO households(id,name) VALUES($1,'Synthetic count')",[householdId]);
 await pool.query("INSERT INTO people(id,household_id,display_name) VALUES($1,$2,'Test')",[personId,householdId]);
 await pool.query("INSERT INTO foods(id,canonical_name,source) VALUES($1,'Synthetic flour','manual')",[foodId]);
 return {db,pool,householdId,personId,foodId};
}
test('preparation counts validate identity, finite nonnegative physical stock, and expected snapshots',()=>{
 const input={householdId:randomUUID(),recipeId:randomUUID(),quantity:10,expectedQuantity:20};
 assert.ok(validatePreparationCount(input).data);assert.ok(validatePreparationCount({...input,quantity:0}).data);
 for(const change of [{householdId:'bad'},{recipeId:'bad'},{quantity:-1},{quantity:Infinity},{quantity:1e9},{quantity:'10'},{expectedQuantity:undefined}])assert.ok(validatePreparationCount({...input,...change}).error);
});
test('counting banana bread preserves production and raw deductions, reserves menus separately, and protects cancellations',async()=>{
 const f=await fixture();const {db,pool,householdId,personId,foodId}=f;
 try{
 const recipe=await createRecipe(pool,validateRecipeInput({householdId,name:'Banana bread fictif',productionType:'pastry',yield:{amount:20,unitId:'piece'},lines:[{foodId,quantity:1000,unitId:'g'}]}).data);
 assert.equal((await saveIngredientStock(pool,{householdId,foodId,quantityG:2000,minimumG:0,targetG:0,leadDays:0,version:0})).saved,true);
 const lot=await addStockLot(pool,{householdId,recipeId:recipe.id,quantity:20,producedOn:'2026-11-01',storage:'freezer',note:''});
 const meals=[];for(const date of ['2026-11-02','2026-11-09'])meals.push(await savePlannedMeal(pool,null,{householdId,mealDate:date,slot:'breakfast',notes:'Preserve',attendeeIds:[personId],items:[{recipeId:recipe.id,role:'main',amounts:[{personId,quantity:8}]}]}));
 const rawBefore=await listIngredientStock(pool,householdId);
 const input={householdId,recipeId:recipe.id,quantity:10,expectedQuantity:20};
 assert.equal((await countPreparationStock(pool,input)).physicalQuantity,10);
 const stock=(await listStock(pool,householdId))[0];
 assert.equal(stock.producedQuantity,20);assert.equal(stock.physicalQuantity,10);assert.equal(stock.plannedQuantity,16);assert.equal(stock.availableQuantity,-6);assert.equal(stock.lots[0].quantity,20);
 assert.equal((await listPreparationsToMake(pool,householdId,'2026-11-01','2026-11-15'))[0].toMakeQuantity,6);
 assert.equal((await recipeRequirements(pool,householdId,'2026-11-01','2026-11-15')).foods[0].quantity,300);
 assert.deepEqual(await listIngredientStock(pool,householdId),rawBefore);
 assert.equal((await countPreparationStock(pool,input)).unchanged,true);
 assert.equal((await countPreparationStock(pool,{...input,quantity:9})).error,'preparation-stock-changed');
 assert.equal((await pool.query('SELECT count(*) FROM preparation_stock_counts')).rows[0].count,1);
 const other=randomUUID();await pool.query("INSERT INTO households(id,name) VALUES($1,'Other')",[other]);
 assert.equal((await countPreparationStock(pool,{...input,householdId:other})).error,'preparation-stock-not-found');
 assert.equal((await cancelStockLot(pool,householdId,lot.id)).error,'production-already-used');
 assert.equal((await setMealPrepared(pool,householdId,meals[0].id,true)).prepared,true);
 let row=(await listStock(pool,householdId))[0];assert.equal(row.physicalQuantity,2);assert.equal(row.plannedQuantity,8);assert.equal(row.availableQuantity,-6);
 assert.equal((await setMealPrepared(pool,householdId,meals[1].id,true)).error,'prepared-batch-insufficient');
 assert.equal((await countPreparationStock(pool,{...input,quantity:0,expectedQuantity:2})).physicalQuantity,0);
 assert.equal((await setMealPrepared(pool,householdId,meals[0].id,false)).prepared,false);
 assert.equal((await availableRecipeStock(pool,householdId)).get(recipe.id),8);
 // A corrected overcount can itself be corrected; no second raw deduction.
 assert.equal((await countPreparationStock(pool,{...input,quantity:20,expectedQuantity:8})).physicalQuantity,20);
 assert.deepEqual(await listIngredientStock(pool,householdId),rawBefore);
 assert.equal((await cancelStockLot(pool,householdId,lot.id)).cancelled,true);
 assert.equal((await listIngredientStock(pool,householdId))[0].quantityG,2000);
 assert.equal((await availableRecipeStock(pool,householdId)).get(recipe.id),0);
 }finally{await db.close();}
});
test('counting one split service leaves the other services and raw stock untouched, and is exposed over HTTP',async()=>{
 const f=await fixture();const {db,pool,householdId,foodId}=f;
 try{
 const recipe=await createRecipe(pool,validateRecipeInput({householdId,name:'Split synthetic',productionType:'batch_cooking',yield:{amount:4,unitId:'portion'},separateStarch:true,servingMode:'three',cookingFactors:{main:1,vegetables:1,starch:1},lines:['main','vegetables','starch'].map(servingPart=>({foodId,quantity:400,unitId:'g',servingPart,cookingFactor:1}))}).data);
 const lot=await addStockLot(pool,{householdId,recipeId:recipe.id,quantity:4,producedOn:'2026-11-01',storage:'freezer',note:''});
 const main=recipe.servingParts.find(p=>p.servingPart==='main'),veg=recipe.servingParts.find(p=>p.servingPart==='vegetables');
 const request=Readable.from([JSON.stringify({householdId,recipeId:main.id,quantity:123.5,expectedQuantity:400})]);request.method='PUT';request.url='/api/household-planning/stock/count';request.headers={};
 const response={headers:{},setHeader(k,v){this.headers[k]=v;},writeHead(status){this.status=status;},end(body){this.body=JSON.parse(body);}};
 await handleRequest(request,response,pool);
 assert.equal(response.status,200);assert.equal(response.body.physicalQuantity,123.5);
 const stocks=await availableRecipeStock(pool,householdId);assert.equal(stocks.get(veg.id),400);assert.equal(stocks.get(main.id),123.5);
 assert.equal((await cancelStockLot(pool,householdId,lot.id)).error,'production-already-used');
 assert.equal((await listStock(pool,householdId)).find(row=>row.recipeId===main.id).physicalQuantity,123.5);
 }finally{await db.close();}
});
