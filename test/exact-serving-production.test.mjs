import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createRecipe,updateRecipe,validateRecipeInput} from '../src/server/recipes.mjs';
import {savePlannedMeal} from '../src/server/planning.mjs';
import {setMealPrepared} from '../src/server/meal-preparation.mjs';
import {addStockLot,cancelStockLot,listStock,listPreparationsToMake,validateProductionInput} from '../src/server/household-planning.mjs';
import {saveIngredientStock,listIngredientStock} from '../src/server/ingredient-stock.mjs';
import {groupPreparations,suggestedServingQuantities,suggestedProductionQuantity,scaledIngredients} from '../web/cooking-sheet.js';

async function fixture(mode,sharedFood=false){
  const db=new PGlite();
  try{
    const dir=new URL('../db/migrations/',import.meta.url);
    for(const file of (await readdir(dir)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,dir),'utf8'));
    const pool={async query(sql,args=[]){const r=await db.query(sql,args);return {...r,rowCount:r.rows.length||r.affectedRows||0};},async connect(){return {...this,release(){}};}};
    const h=randomUUID(),person=randomUUID(),meat=randomUUID(),veg=randomUUID(),starch=sharedFood?meat:randomUUID();
    await pool.query("INSERT INTO households(id,name) VALUES($1,'Synthetic exact batch')",[h]);
    await pool.query("INSERT INTO people(id,household_id,display_name) VALUES($1,$2,'Synthetic person')",[person,h]);
    for(const id of new Set([meat,veg,starch]))await pool.query("INSERT INTO foods(id,canonical_name,source) VALUES($1,'Synthetic ingredient','manual')",[id]);
    const lines=[{foodId:meat,quantity:400,unitId:'g',servingPart:'main'},
      {foodId:veg,quantity:800,unitId:'g',servingPart:mode==='three'?'vegetables':'main'},
      {foodId:starch,quantity:100,unitId:'g',servingPart:'starch',cookingFactor:4}];
    const checked=validateRecipeInput({householdId:h,name:'Synthetic split dish',recipeType:'dish',productionType:'batch_cooking',mealMoments:['lunch'],yield:{amount:4,unitId:'portion'},separateStarch:true,servingMode:mode,cookingFactors:{main:1,starch:4,vegetables:1},lines});
    assert.equal(checked.error,undefined);
    const recipe=await createRecipe(pool,checked.data);
    const input={householdId:h,recipeId:recipe.id,producedOn:'2026-10-19',storage:'freezer',note:'',requestId:randomUUID()};
    return {db,pool,h,person,meat,veg,starch,recipe,input};
  }catch(error){await db.close();throw error;}
}

test('three-part cooking follows menu grams independently, reserves all of them and leaves no surplus',async()=>{
  const f=await fixture('three');const {db,pool,h,person,recipe,input}=f;
  try{
    const totals={main:600,vegetables:800,starch:300},meals=[];
    for(const mealDate of ['2026-10-20','2026-10-23'])meals.push(await savePlannedMeal(pool,null,{householdId:h,mealDate,slot:'lunch',notes:'',attendeeIds:[person],
      items:recipe.servingParts.map(part=>({recipeId:part.id,role:part.servingPart==='main'?'main':'accompaniment',amounts:[{personId:person,quantity:totals[part.servingPart]/2}]}))}));
    const readGroup=async()=>groupPreparations(await listPreparationsToMake(pool,h,'2026-10-19','2026-10-25'))[0];
    const group=await readGroup(),servingQuantities=suggestedServingQuantities(group,recipe);
    assert.equal(suggestedProductionQuantity(group,recipe),1700);
    for(const target of servingQuantities)assert.equal(target.quantity,totals[target.servingPart]);
    const ingredients=scaledIngredients(recipe,1700,servingQuantities);
    assert.deepEqual(ingredients.map(line=>line.scaledQuantity),[600,800,75]);
    for(const foodId of [f.meat,f.veg,f.starch])await saveIngredientStock(pool,{householdId:h,foodId,quantityG:10000,minimumG:0,targetG:0,leadDays:0,version:0});
    const request={...input,servingQuantities};
    const checked=validateProductionInput(request);assert.equal(checked.error,undefined);
    const lot=await addStockLot(pool,checked.data);assert.equal(lot.error,undefined);
    const stocks=await listStock(pool,h);
    for(const part of recipe.servingParts){const stock=stocks.find(s=>s.recipeId===part.id);assert.equal(stock.producedQuantity,totals[part.servingPart]);assert.equal(stock.availableQuantity,0);}
    assert.equal((await addStockLot(pool,{...request,servingQuantities:[...servingQuantities].reverse()})).replayed,true);
    const changed=servingQuantities.map(part=>({...part,quantity:part.quantity+(part.servingPart==='main'?50:part.servingPart==='starch'?-50:0)}));
    assert.equal((await addStockLot(pool,{...request,servingQuantities:changed})).error,'production-request-conflict');
    assert.equal((await addStockLot(pool,{...input,quantity:4.25})).error,'production-request-conflict');
    assert.equal(suggestedProductionQuantity(await readGroup(),recipe),0);
    await cancelStockLot(pool,h,lot.id);
    assert.ok((await listIngredientStock(pool,h)).every(s=>s.quantityG===10000));
    assert.equal((await addStockLot(pool,request)).error,'production-request-cancelled');
    const final=await addStockLot(pool,{...request,requestId:randomUUID()});
    const before=(await listIngredientStock(pool,h)).map(s=>s.quantityG);
    for(const meal of meals)assert.equal((await setMealPrepared(pool,h,meal.id,true)).error,undefined);
    assert.deepEqual((await listIngredientStock(pool,h)).map(s=>s.quantityG),before);
    assert.equal((await cancelStockLot(pool,h,final.id)).error,'production-already-used');
  }finally{await db.close();}
});

test('two-part production is atomic, sums shared ingredients and accepts a zero service without producing it',async()=>{
  const f=await fixture('separate',true);const {db,pool,h,recipe,input}=f;
  try{
    const main=recipe.servingParts.find(p=>p.servingPart==='main'),starch=recipe.servingParts.find(p=>p.servingPart==='starch');
    await saveIngredientStock(pool,{householdId:h,foodId:f.meat,quantityG:450,minimumG:0,targetG:0,leadDays:0,version:0});
    await saveIngredientStock(pool,{householdId:h,foodId:f.veg,quantityG:10000,minimumG:0,targetG:0,leadDays:0,version:0});
    // 1,200 g of the meat/vegetable service needs 400 g of the shared food;
    // 300 g of cooked starch needs another 75 g. Each fits separately, not together.
    const request={...input,servingQuantities:[{recipeId:main.id,quantity:1200},{recipeId:starch.id,quantity:300}]};
    const insufficient=await addStockLot(pool,request);
    assert.equal(insufficient.error,undefined);assert.equal(insufficient.stockWarnings[0].quantity,-25);
    assert.equal((await listIngredientStock(pool,h)).find(s=>s.foodId===f.meat).quantityG,-25);
    assert.equal((await cancelStockLot(pool,h,insufficient.id)).cancelled,true);
    assert.equal((await listIngredientStock(pool,h)).find(s=>s.foodId===f.meat).quantityG,450);
    const zero={...request,requestId:randomUUID(),servingQuantities:[{recipeId:main.id,quantity:1200},{recipeId:starch.id,quantity:0}]};
    const lot=await addStockLot(pool,zero);assert.equal(lot.error,undefined);
    assert.equal((await listStock(pool,h)).find(s=>s.recipeId===main.id).producedQuantity,1200);
    assert.equal((await listStock(pool,h)).some(s=>s.recipeId===starch.id),false);
    assert.equal((await listIngredientStock(pool,h)).find(s=>s.foodId===f.meat).quantityG,50);
    const child=(await pool.query('SELECT id FROM stock_lots WHERE parent_lot_id=$1',[lot.id])).rows[0];
    await cancelStockLot(pool,h,child.id);
    assert.equal((await listIngredientStock(pool,h)).find(s=>s.foodId===f.meat).quantityG,450);
    assert.equal((await cancelStockLot(pool,h,child.id)).replayed,true);
    const foreign=randomUUID();
    assert.equal((await addStockLot(pool,{...request,requestId:randomUUID(),servingQuantities:[{recipeId:main.id,quantity:1200},{recipeId:foreign,quantity:10}]})).error,'invalid-production-parts');
  }finally{await db.close();}
});

test('production part input rejects missing services, duplicate ids, invalid amounts and all-zero batches',()=>{
  const input={householdId:randomUUID(),recipeId:randomUUID(),producedOn:'2026-10-19',servingQuantities:[{recipeId:randomUUID(),quantity:600},{recipeId:randomUUID(),quantity:300}]};
  assert.equal(validateProductionInput(input).error,undefined);
  for(const servingQuantities of [[],null,[input.servingQuantities[0]],Array(2).fill(input.servingQuantities[0]),
    input.servingQuantities.map(p=>({...p,quantity:0})),input.servingQuantities.map(p=>({...p,quantity:-1})),
    input.servingQuantities.map(p=>({...p,quantity:NaN})),input.servingQuantities.map(p=>({...p,quantity:100001})),
    input.servingQuantities.map(p=>({...p,quantity:1.2345}))])assert.ok(validateProductionInput({...input,servingQuantities}).error);
});

test('retired recipe parts do not block current production or create phantom lots',async()=>{
 const f=await fixture('three');const {db,pool,h,recipe,input}=f;
 try{
 const oldVegetables=recipe.servingParts.find(p=>p.servingPart==='vegetables');
 const checked=validateRecipeInput({householdId:h,name:recipe.name,recipeType:'dish',productionType:'batch_cooking',yield:recipe.yield,separateStarch:true,servingMode:'separate',cookingFactors:{main:1,starch:4},lines:recipe.lines.map(line=>({...line,servingPart:line.servingPart==='vegetables'?'main':line.servingPart}))});
 assert.equal(checked.error,undefined);const two=await updateRecipe(pool,recipe.id,checked.data);
 assert.equal(two.error,undefined);assert.equal(two.servingParts.length,2);
 assert.equal((await pool.query('SELECT id FROM recipes WHERE parent_recipe_id=$1',[recipe.id])).rows.length,3);
 const servingQuantities=two.servingParts.map(part=>({recipeId:part.id,quantity:part.yield.amount}));
 const first=await addStockLot(pool,{...input,servingQuantities});assert.equal(first.error,undefined);
 const children=(await pool.query('SELECT recipe_id FROM stock_lots WHERE parent_lot_id=$1',[first.id])).rows;
 assert.equal(children.length,2);assert.ok(children.every(child=>child.recipe_id!==oldVegetables.id));
 assert.equal((await addStockLot(pool,{...input,servingQuantities})).replayed,true);
 assert.equal((await pool.query('SELECT count(*) FROM stock_lots WHERE parent_lot_id=$1',[first.id])).rows[0].count,2);
 const stale=await addStockLot(pool,{...input,requestId:randomUUID(),servingQuantities:[...servingQuantities,{recipeId:oldVegetables.id,quantity:10}]});
 assert.equal(stale.error,'invalid-production-parts');
 await cancelStockLot(pool,h,first.id);
 const free=await addStockLot(pool,{...input,requestId:randomUUID(),quantity:4});assert.equal(free.error,undefined);
 assert.equal((await pool.query('SELECT count(*) FROM stock_lots WHERE parent_lot_id=$1',[free.id])).rows[0].count,2);
 }finally{await db.close();}
});
