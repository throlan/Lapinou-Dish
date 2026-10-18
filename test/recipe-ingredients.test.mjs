import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createRecipe,updateRecipe,readRecipe,deleteRecipe,validateRecipeInput} from '../src/server/recipes.mjs';
import {addStockLot,cancelStockLot,listPreparationsToMake,listStock} from '../src/server/household-planning.mjs';
import {rawShoppingRequirements} from '../src/server/shopping-requirements.mjs';
import {savePlannedMeal,deletePlannedMeal,listPlannedRecipeIds} from '../src/server/planning.mjs';
import {setMealPrepared} from '../src/server/meal-preparation.mjs';

async function fixture(){
  const db=new PGlite();
  const dir=new URL('../db/migrations/',import.meta.url);
  for(const file of (await readdir(dir)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,dir),'utf8'));
  const pool={async query(sql,args=[]){const r=await db.query(sql,args);return {...r,rowCount:r.rows.length||r.affectedRows||0};},async connect(){return {...this,release(){}};}};
  const householdId=randomUUID(),personId=randomUUID(),other=randomUUID();
  await pool.query("INSERT INTO households(id,name) VALUES($1,'Synthetic'),($2,'Other synthetic')",[householdId,other]);
  await pool.query("INSERT INTO people(id,household_id,display_name) VALUES($1,$2,'Test')",[personId,householdId]);
  const food=async(name,kcal=300,protein=10)=>{
    const id=randomUUID();await pool.query("INSERT INTO foods(id,canonical_name,source) VALUES($1,$2,'manual')",[id,name]);
    for(const [key,value] of Object.entries({energy_kcal:kcal,protein_g:protein,carbohydrate_g:20,fat_g:1,fibre_g:1}))if(value!=null)await pool.query('INSERT INTO food_nutrients(food_id,nutrient_id,value_per_100g) VALUES($1,$2,$3)',[id,key,value]);
    return id;
  };
  const data=input=>{const checked=validateRecipeInput({householdId,name:'Synthetic recipe',yield:{amount:1,unitId:'portion'},...input});assert.equal(checked.error,undefined);return checked.data;};
  const create=async input=>{const r=await createRecipe(pool,data(input));assert.equal(r?.error,undefined);return r;};
  const meal=async(recipeId,quantity,date='2026-10-20')=>savePlannedMeal(pool,null,{householdId,mealDate:date,slot:'lunch',notes:'',attendeeIds:[personId],items:[{recipeId,role:'main',amounts:[{personId,quantity}]}]});
  const lot=async(recipeId,quantity,extra={})=>addStockLot(pool,{householdId,recipeId,quantity,producedOn:'2026-10-19',storage:'freezer',note:'',...extra});
  const tracked=async(foodId,quantity)=>pool.query('INSERT INTO household_ingredient_stock(household_id,food_id,quantity_g,minimum_g,target_g,lead_days) VALUES($1,$2,$3,0,0,0)',[householdId,foodId,quantity]);
  const stockG=async id=>Number((await pool.query('SELECT quantity_g FROM household_ingredient_stock WHERE household_id=$1 AND food_id=$2',[householdId,id])).rows[0].quantity_g);
  const shopping=()=>rawShoppingRequirements(pool,householdId,'2026-10-19','2026-10-25');
  const preparations=()=>listPreparationsToMake(pool,householdId,'2026-10-19','2026-10-25');
  return {db,pool,householdId,personId,other,food,data,create,meal,lot,tracked,stockG,shopping,preparations};
}

test('bagels by piece feed gram menus, shopping, bread production and assembly without deducting flour twice',async t=>{
  const f=await fixture();t.after(()=>f.db.close());
  const flour=await f.food('Synthetic flour'),beef=await f.food('Synthetic meat',100,20);
  await f.tracked(flour,5000);await f.tracked(beef,5000);
  const bagels=await f.create({name:'Synthetic bagels',productionType:'bread',yield:{amount:6,unitId:'piece'},lines:[{foodId:flour,quantity:600,unitId:'g'}]});
  const burgers=await f.create({name:'Synthetic burgers',productionType:'batch_cooking',yield:{amount:2,unitId:'portion'},separateStarch:true,servingMode:'whole',lines:[{recipeId:bagels.id,quantity:2,unitId:'piece'},{foodId:beef,quantity:200,unitId:'g'}]});
  assert.equal(burgers.servingParts[0].yield.amount,400);
  assert.equal(burgers.nutrition.perYieldUnit.energyKcal,400);assert.equal(burgers.nutrition.perYieldUnit.proteinG,30);
  const part=burgers.servingParts[0].id;
  await f.meal(part,400);await f.meal(part,400,'2026-10-22');
  const earlier=await f.lot(bagels.id,2);assert.equal(earlier.error,undefined);
  const shopping=await f.shopping();assert.equal(shopping.find(l=>l.foodId===flour).quantity,200);assert.equal(shopping.find(l=>l.foodId===beef).quantity,400);
  const prep=(await f.preparations()).find(p=>p.recipeId===bagels.id);assert.equal(prep.plannedQuantity,4);assert.equal(prep.coveredQuantity,2);assert.equal(prep.toMakeQuantity,2);
  const failed=await f.lot(part,800);assert.equal(failed.error,'prepared-component-insufficient');assert.equal(await f.stockG(beef),5000);
  const bread=await f.lot(bagels.id,2);assert.equal(await f.stockG(flour),4600);
  await f.pool.query('UPDATE household_ingredient_stock SET quantity_g=1 WHERE food_id=$1',[beef]);
  assert.equal((await f.lot(part,800)).error,'ingredient-stock-insufficient');
  assert.equal((await f.pool.query('SELECT count(*) FROM recipe_stock_uses')).rows[0].count,0);
  await f.pool.query('UPDATE household_ingredient_stock SET quantity_g=5000 WHERE food_id=$1',[beef]);
  const requestId=randomUUID(),production=await f.lot(part,800,{requestId});assert.equal(production.error,undefined);
  assert.equal((await f.lot(part,800,{requestId})).replayed,true);
  assert.equal((await updateRecipe(f.pool,bagels.id,f.data({...bagels,yield:{amount:6,unitId:'portion'},outputUnits:{piece:6}}))).error,'recipe-output-in-use');
  assert.equal(await f.stockG(flour),4600);assert.equal(await f.stockG(beef),4600);
  assert.deepEqual(await f.shopping(),[]);
  assert.equal((await listStock(f.pool,f.householdId)).find(r=>r.recipeId===bagels.id).availableQuantity,0);
  assert.equal((await cancelStockLot(f.pool,f.householdId,bread.id)).error,'production-already-used');
  assert.equal((await cancelStockLot(f.pool,f.householdId,production.id)).cancelled,true);
  assert.equal(await f.stockG(beef),5000);assert.equal(await f.stockG(flour),4600);
  assert.equal((await cancelStockLot(f.pool,f.householdId,bread.id)).cancelled,true);assert.equal(await f.stockG(flour),4800);
});

test('bread slices use a declared equivalence, direct and nested menus share stock, and cancelling a meal restores bread',async t=>{
  const f=await fixture();t.after(()=>f.db.close());
  const flour=await f.food('Synthetic flour');await f.tracked(flour,5000);
  const bread=await f.create({name:'Synthetic loaf',productionType:'bread',yield:{amount:1,unitId:'piece'},outputUnits:{slice:20},lines:[{foodId:flour,quantity:1000,unitId:'g'}]});
  const toast=await f.create({name:'Synthetic toast meal',lines:[{recipeId:bread.id,quantity:2,unitId:'slice'}]});
  assert.equal(toast.nutrition.perYieldUnit.energyKcal,300);
  await f.lot(bread.id,1);
  await f.meal(bread.id,0.5,'2026-10-19');const meal=await f.meal(toast.id,2);
  const prep=(await f.preparations()).find(r=>r.recipeId===bread.id);assert.equal(prep.plannedQuantity,0.7);assert.equal(prep.coveredQuantity,0.7);assert.deepEqual(await f.shopping(),[]);
  const prepared=await setMealPrepared(f.pool,f.householdId,meal.id,true);assert.equal(prepared.error,undefined);assert.equal(await f.stockG(flour),4000);
  const stock=(await listStock(f.pool,f.householdId)).find(r=>r.recipeId===bread.id);assert.ok(Math.abs(stock.availableQuantity-0.3)<1e-8);
  assert.equal((await setMealPrepared(f.pool,f.householdId,meal.id,true)).replayed,true);
  assert.equal((await updateRecipe(f.pool,bread.id,f.data({...bread,lines:bread.lines}))).error,'recipe-used-in-prepared-meal');
  await setMealPrepared(f.pool,f.householdId,meal.id,false);
  assert.equal(await deletePlannedMeal(f.pool,meal.id,f.householdId),true);
  const remaining=(await listStock(f.pool,f.householdId)).find(r=>r.recipeId===bread.id);assert.equal(remaining.availableQuantity,0.5);
});

test('untracked nested sauces expand recursively, nutrition stays live, cycles and cross-household references roll back',async t=>{
  const f=await fixture();t.after(()=>f.db.close());
  const food=await f.food('Synthetic tomato',50,2);await f.tracked(food,5000);
  const sauce=await f.create({name:'Synthetic sauce',yield:{amount:500,unitId:'g'},lines:[{foodId:food,quantity:500,unitId:'g'}]});
  const topping=await f.create({name:'Synthetic topping',yield:{amount:2,unitId:'portion'},lines:[{recipeId:sauce.id,quantity:200,unitId:'g'}]});
  const dish=await f.create({name:'Synthetic dish',yield:{amount:4,unitId:'portion'},lines:[{recipeId:topping.id,quantity:2,unitId:'portion'}]});
  const meal=await f.meal(dish.id,4);assert.equal((await f.shopping())[0].quantity,200);
  assert.deepEqual(new Set(await listPlannedRecipeIds(f.pool,f.householdId,'2026-10-01')),new Set([dish.id,topping.id,sauce.id]));
  assert.equal((await setMealPrepared(f.pool,f.householdId,meal.id,true)).prepared,true);assert.equal(await f.stockG(food),4800);
  await setMealPrepared(f.pool,f.householdId,meal.id,false);assert.equal(await f.stockG(food),5000);
  const before=(await readRecipe(f.pool,dish.id)).version;
  await f.pool.query("UPDATE food_nutrients SET value_per_100g=100 WHERE food_id=$1 AND nutrient_id='energy_kcal'",[food]);
  assert.equal((await readRecipe(f.pool,dish.id)).nutrition.perYieldUnit.energyKcal,50);
  assert.equal((await updateRecipe(f.pool,sauce.id,f.data({...sauce,lines:[{recipeId:dish.id,quantity:1,unitId:'portion'}]}))).error,'recipe-ingredient-cycle');
  assert.equal((await readRecipe(f.pool,dish.id)).version,before);
  assert.equal((await updateRecipe(f.pool,sauce.id,f.data({...sauce,lines:[{recipeId:sauce.id,quantity:1,unitId:'g'}]}))).error,'recipe-ingredient-cycle');
  const other=await createRecipe(f.pool,f.data({householdId:f.other,name:'Other household recipe',lines:[{foodId:food,quantity:10,unitId:'g'}]}));
  const invalid=await createRecipe(f.pool,f.data({lines:[{recipeId:other.id,quantity:1,unitId:'portion'}]}));assert.equal(invalid.error,'recipe-ingredient-not-found');
  const deletion=await deleteRecipe(f.pool,sauce.id,{householdId:f.householdId,version:sauce.version});assert.equal(deletion.error,'recipe-in-use');assert.ok(deletion.recipes.some(r=>r.id===topping.id));
});

test('independent meat/vegetable/starch quantities scale recipe components independently and invalidate parents on edit',async t=>{
  const f=await fixture();t.after(()=>f.db.close());
  const food=await f.food('Synthetic ingredient');
  const bread=await f.create({name:'Synthetic bread',productionType:'bread',yield:{amount:10,unitId:'slice'},lines:[{foodId:food,quantity:1000,unitId:'g'}]});
  const dish=await f.create({name:'Synthetic split dish',productionType:'batch_cooking',yield:{amount:4,unitId:'portion'},separateStarch:true,servingMode:'three',cookingFactors:{main:1,vegetables:1,starch:3},
    lines:[{foodId:food,quantity:200,unitId:'g',servingPart:'main'},{foodId:food,quantity:300,unitId:'g',servingPart:'vegetables'},{recipeId:bread.id,quantity:4,unitId:'slice',servingPart:'starch'}]});
  assert.equal(dish.servingWeights.starch,400,'already cooked bread is never multiplied by the starch cooking factor');
  const main=dish.servingParts.find(p=>p.servingPart==='main'),veg=dish.servingParts.find(p=>p.servingPart==='vegetables'),starch=dish.servingParts.find(p=>p.servingPart==='starch');
  await f.meal(main.id,100);await f.meal(veg.id,600);await f.meal(starch.id,300);
  assert.equal((await f.preparations()).find(p=>p.recipeId===bread.id).toMakeQuantity,3);
  await f.lot(bread.id,3);
  const input={servingQuantities:[{recipeId:main.id,quantity:100},{recipeId:veg.id,quantity:600},{recipeId:starch.id,quantity:300}]};
  const lot=await f.lot(dish.id,undefined,input);assert.equal(lot.error,undefined);assert.deepEqual(await f.shopping(),[]);
  assert.equal((await listStock(f.pool,f.householdId)).find(r=>r.recipeId===bread.id).availableQuantity,0);
  await cancelStockLot(f.pool,f.householdId,lot.id);
  const updated=await updateRecipe(f.pool,bread.id,f.data({...bread,lines:[{foodId:food,quantity:2000,unitId:'g'}]}));assert.equal(updated.error,undefined);
  const refreshed=await readRecipe(f.pool,dish.id);assert.equal(refreshed.servingWeights.starch,800);assert.ok(refreshed.version>dish.version);
  assert.equal(refreshed.servingParts.find(p=>p.servingPart==='starch').id,starch.id);
});

test('ambiguous slice conversions are refused, missing nutrients stay incomplete, and slice yields are native',async t=>{
  const f=await fixture();t.after(()=>f.db.close());
  const food=await f.food('Synthetic incomplete ingredient',null,10);
  const bread=await f.create({yield:{amount:1,unitId:'piece'},lines:[{foodId:food,quantity:100,unitId:'g'}]});
  const invalid=await createRecipe(f.pool,f.data({lines:[{recipeId:bread.id,quantity:2,unitId:'slice'}]}));assert.equal(invalid.error,'recipe-ingredient-unit-missing');
  await updateRecipe(f.pool,bread.id,f.data({...bread,outputUnits:{slice:10}}));
  const toast=await f.create({lines:[{recipeId:bread.id,quantity:2,unitId:'slice'}]});assert.equal(toast.nutrition.complete,false);assert.equal(toast.nutrition.perYieldUnit.energyKcal,null);
  assert.equal(validateRecipeInput({householdId:f.householdId,name:'Invalid',yield:{amount:1,unitId:'piece'},outputUnits:{slice:0},lines:bread.lines}).error,'invalid-output-units');
  assert.equal(validateRecipeInput({householdId:f.householdId,name:'Invalid',yield:{amount:1,unitId:'piece'},lines:[{foodId:food,recipeId:bread.id,quantity:1,unitId:'piece'}]}).error,'invalid-food-id');
});

test('bread with a gram serving stock is still used by slices and shared with earlier direct menus',async t=>{
  const f=await fixture();t.after(()=>f.db.close());
  const food=await f.food('Synthetic flour');await f.tracked(food,5000);
  const bread=await f.create({name:'Synthetic gram bread',productionType:'bread',yield:{amount:1,unitId:'piece'},outputUnits:{slice:20},
    separateStarch:true,servingMode:'whole',lines:[{foodId:food,quantity:1000,unitId:'g'}]});
  const toast=await f.create({lines:[{recipeId:bread.id,quantity:2,unitId:'slice'}]});
  const lot=await f.lot(bread.id,1);assert.equal(lot.error,undefined);
  await f.meal(bread.servingParts[0].id,900,'2026-10-19');const meal=await f.meal(toast.id,2);
  const prep=(await f.preparations()).find(r=>r.recipeId===bread.servingParts[0].id);
  assert.equal(prep.plannedQuantity,1100);assert.equal(prep.coveredQuantity,1000);assert.equal(prep.toMakeQuantity,100);
  assert.equal((await f.shopping()).find(r=>r.foodId===food).quantity,100);
  await f.lot(bread.id,0.1);
  assert.equal((await setMealPrepared(f.pool,f.householdId,meal.id,true)).prepared,true);assert.equal(await f.stockG(food),3900);
  assert.equal((await cancelStockLot(f.pool,f.householdId,lot.id)).error,'production-already-used');
  await setMealPrepared(f.pool,f.householdId,meal.id,false);
  assert.equal((await listStock(f.pool,f.householdId)).find(r=>r.recipeId===bread.servingParts[0].id).availableQuantity,0);
});
