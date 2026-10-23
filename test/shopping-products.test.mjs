import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {validateShoppingPreference,saveShoppingPreference,listShoppingPreferences,purchaseProductRequirements} from '../src/server/shopping-products.mjs';
import {createRecipe,readRecipe,validateRecipeInput} from '../src/server/recipes.mjs';
import {savePlannedMeal} from '../src/server/planning.mjs';
import {listShoppingRequirements,addStockLot,cancelStockLot} from '../src/server/household-planning.mjs';
import {countProductInventory,recordPurchaseReceipt,listIngredientStock} from '../src/server/ingredient-stock.mjs';
import {setMealPrepared} from '../src/server/meal-preparation.mjs';
import {savePurchaseUnit} from '../src/server/purchase-units.mjs';
import {shoppingExportLine} from '../src/server/shopping-presentation.mjs';
import {handleRequest} from '../src/server/app.mjs';

const start='2026-10-19',end='2026-10-25';
test('shopping preferences reject invalid identities, self aliases, units, ratios and exclusion periods',()=>{
  const base={householdId:randomUUID(),foodId:randomUUID(),kind:'product',purchaseFoodId:randomUUID(),sourceUnitId:'piece',targetUnitId:'piece',factor:1};
  assert.ok(validateShoppingPreference(base).data);
  for(const change of [{householdId:'bad'},{purchaseFoodId:base.foodId},{factor:0},{factor:Infinity},{targetUnitId:'unknown'}])assert.ok(validateShoppingPreference({...base,...change}).error);
  for(const change of [{scope:'unknown'},{startDate:'2026-02-30'},{endDate:'2026-01-01'},{excluded:'yes'}])
    assert.ok(validateShoppingPreference({...base,kind:'exclusion',scope:'period',startDate:start,endDate:end,excluded:true,...change}).error);
  assert.ok(validateShoppingPreference({...base,kind:'exclusion',scope:'always',excluded:true}).data);
});

test('explicit purchase products aggregate before rounding, share stock and leave recipe nutrition distinct',async t=>{
  const db=new PGlite();t.after(()=>db.close());const dir=new URL('../db/migrations/',import.meta.url);
  for(const file of (await readdir(dir)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,dir),'utf8'));
  const pool={async query(sql,args=[]){const r=await db.query(sql,args);return {...r,rowCount:r.rows.length||r.affectedRows||0};},async connect(){return {...this,release(){}};}};
  const householdId=randomUUID(),other=randomUUID(),personId=randomUUID();
  await pool.query("INSERT INTO households(id,name) VALUES($1,'Synthetic'),($2,'Other')",[householdId,other]);
  await pool.query("INSERT INTO people(id,household_id,display_name) VALUES($1,$2,'Synthetic')",[personId,householdId]);
  async function food(name,kcal,mass){const id=randomUUID();await pool.query("INSERT INTO foods(id,canonical_name,source,grams_per_millilitre) VALUES($1,$2,'manual',1)",[id,name]);
    for(const [nutrient,value] of Object.entries({energy_kcal:kcal,protein_g:10,carbohydrate_g:1,fat_g:1,fibre_g:0}))await pool.query('INSERT INTO food_nutrients(food_id,nutrient_id,value_per_100g) VALUES($1,$2,$3)',[id,nutrient,value]);
    if(mass)await pool.query("INSERT INTO food_unit_conversions(food_id,unit_id,grams_per_unit,source_note) VALUES($1,'piece',$2,'Synthetic')",[id,mass]);return id;}
  const raw=await food('Synthetic raw eggs',140,50),hard=await food('Synthetic hard eggs',155,50),white=await food('Synthetic white',50,30),water=await food('Synthetic water',0),salt=await food('Synthetic salt',0);
  const recipe=async(foodId,quantity,unitId,productionType='none')=>{const input=validateRecipeInput({householdId,name:'Synthetic '+foodId,yield:{amount:1,unitId:'portion'},productionType,lines:[{foodId,quantity,unitId}]});assert.equal(input.error,undefined);return createRecipe(pool,input.data);};
  const dishes=[await recipe(raw,606.67,'g'),await recipe(hard,12,'piece'),await recipe(white,1.23,'piece'),await recipe(water,1200,'ml'),await recipe(salt,2.47,'g')];
  const meals=[];for(const r of dishes)meals.push(await savePlannedMeal(pool,null,{householdId,mealDate:start,slot:'lunch',notes:'',attendeeIds:[personId],items:[{recipeId:r.id,role:'main',amounts:[{personId,quantity:1}]}]}));
  const list=()=>listShoppingRequirements(pool,householdId,start,end);
  const pref=async data=>{const checked=validateShoppingPreference({householdId,...data});assert.equal(checked.error,undefined);return saveShoppingPreference(pool,checked.data);};
  const cookedChickpeas=await food('Synthetic cooked drained chickpeas',140),dryChickpeas=await food('Synthetic dry chickpeas',360);
  const chickpeaRecipe=await recipe(cookedChickpeas,250,'g');
  await savePlannedMeal(pool,null,{householdId,mealDate:start,slot:'breakfast',notes:'',attendeeIds:[personId],items:[{recipeId:chickpeaRecipe.id,role:'main',amounts:[{personId,quantity:1}]}]});
  await pref({kind:'product',foodId:cookedChickpeas,purchaseFoodId:dryChickpeas,sourceUnitId:'g',targetUnitId:'g',factor:0.8});
  await t.test('cooked chickpeas are listed as dry chickpeas with the configured ratio while recipe quantities stay intact',async()=>{
    const items=await list();assert.equal(items.some(row=>row.foodId===cookedChickpeas),false);
    const dry=items.find(row=>row.foodId===dryChickpeas);assert.equal(dry.neededQuantity,200);
    const original=await readRecipe(pool,chickpeaRecipe.id);assert.equal(original.lines[0].foodId,cookedChickpeas);assert.equal(original.lines[0].quantity,250);
    await pref({kind:'product',foodId:cookedChickpeas,purchaseFoodId:null});
  });
  const garlicPowder=await food('Synthetic garlic powder',300);
  await pool.query("INSERT INTO food_unit_conversions(food_id,unit_id,grams_per_unit,source_note) VALUES($1,'tsp',2,'Synthetic')",[garlicPowder]);
  const garlicRecipe=await recipe(garlicPowder,3,'tsp');
  await savePlannedMeal(pool,null,{householdId,mealDate:start,slot:'dinner',notes:'',attendeeIds:[personId],items:[{recipeId:garlicRecipe.id,role:'main',amounts:[{personId,quantity:1}]}]});
  await savePurchaseUnit(pool,{householdId,foodId:garlicPowder,singularLabel:'sachet de 500 g',pluralLabel:'sachets de 500 g',coveredQuantity:500,coveredUnitId:'g',estimateNote:''});
  await t.test('recipe teaspoons become grams then default purchase sachets',async()=>{
    const garlic=(await list()).find(row=>row.foodId===garlicPowder);assert.equal(garlic.neededQuantity,6);assert.equal(garlic.purchase.text,'1 sachet de 500 g');
  });
  const mapping={kind:'product',foodId:hard,purchaseFoodId:raw,sourceUnitId:'piece',targetUnitId:'piece',factor:1};
  await t.test('merge documented grams and pieces, subtract target stock once, round only the combined purchase',async()=>{
    assert.equal((await countProductInventory(pool,{householdId,foodId:raw,quantity:400,unitId:'g',version:0})).saved,true);
    assert.equal((await pref(mapping)).saved,true);
    await savePurchaseUnit(pool,{householdId,foodId:raw,singularLabel:'œuf',pluralLabel:'œufs',coveredQuantity:50,coveredUnitId:'g',estimateNote:''});
    const items=await list(),egg=items.find(r=>r.foodId===raw);
    assert.equal(items.some(r=>r.foodId===hard),false);assert.ok(Math.abs(egg.neededQuantity-806.67)<1e-8);assert.equal(egg.purchase.text,'17 œufs');assert.equal(egg.entry.quantity,17);assert.equal(egg.entry.multiplier,50);assert.equal(egg.entry.label,'œufs');assert.equal(egg.entry.gramsPerEntry,50);
    assert.equal(egg.recipes.length,2);assert.equal(items.find(r=>r.foodId===white).quantity,2,'whites are not implicitly mapped');
    assert.equal((await readRecipe(pool,dishes[1].id)).nutrition.batch.energyKcal,930);
    assert.equal((await readRecipe(pool,dishes[1].id)).lines[0].foodId,hard);
    assert.deepEqual((await listShoppingPreferences(pool,other)).mappings,[]);
    const source=await purchaseProductRequirements(pool,householdId,[{foodId:hard,name:'Hard',unitId:'piece',quantity:1.1,gramsPerUnit:{piece:50}}]);
    assert.equal(source[0].quantity,1.1,'fractional needs stay fractional before final purchase rounding');
  });
  await t.test('purchase, consume the common stock, and undo using recorded deductions',async()=>{
    const result=await recordPurchaseReceipt(pool,{householdId,foodId:raw,quantity:18,unitId:'piece',requestId:randomUUID()});assert.equal(result.quantityG,900);
    assert.equal((await list()).some(r=>r.foodId===raw),false);
    assert.equal((await setMealPrepared(pool,householdId,meals[1].id,true)).prepared,true);
    const quantity=async()=>Number((await pool.query('SELECT quantity_g FROM household_ingredient_stock WHERE household_id=$1 AND food_id=$2',[householdId,raw])).rows[0].quantity_g);
    assert.equal(await quantity(),700);assert.equal((await setMealPrepared(pool,householdId,meals[1].id,true)).prepared,true);assert.equal(await quantity(),700);
    await setMealPrepared(pool,householdId,meals[1].id,false);assert.equal(await quantity(),1300);
    assert.equal((await countProductInventory(pool,{householdId,foodId:hard,quantity:1,unitId:'piece',version:0})).error,'use-purchase-product-stock');
    const batch=await recipe(hard,2,'piece','batch_cooking');
    const lot=await addStockLot(pool,{householdId,recipeId:batch.id,quantity:1,producedOn:start,storage:'fridge',note:''});assert.equal(lot.error,undefined);assert.equal(await quantity(),1200);
    await cancelStockLot(pool,householdId,lot.id);assert.equal(await quantity(),1300);
    const datedPool={query:(sql,args)=>sql==='SELECT CURRENT_DATE::text AS today'?Promise.resolve({rows:[{today:start}]}):pool.query(sql,args)};
    const stocks=await listIngredientStock(datedPool,householdId);assert.ok(stocks.find(r=>r.foodId===raw).neededG>=1206.67);
  });
  await t.test('permanent and exact-period exclusions stay reversible and affect the list/export, not recipes',async()=>{
    assert.equal((await pref({kind:'exclusion',foodId:water,scope:'always',excluded:true})).saved,true);
    await pref({kind:'exclusion',foodId:salt,scope:'period',startDate:start,endDate:end,excluded:true});
    const items=await list();assert.equal(items.some(r=>[water,salt].includes(r.foodId)),false);
    assert.equal(items.map(shoppingExportLine).join('\n').includes('Synthetic water'),false);
    assert.equal((await readRecipe(pool,dishes[3].id)).lines[0].quantity,1200);
    assert.equal((await listShoppingRequirements(pool,householdId,start,'2026-10-26')).some(r=>r.foodId===salt),true);
    await pref({kind:'exclusion',foodId:water,scope:'always',excluded:false});assert.ok((await list()).some(r=>r.foodId===water));
    assert.equal((await listShoppingPreferences(pool,other)).exclusions.length,0);
  });
  await t.test('chains, cycles, inconsistent target units and source inventories are rejected atomically',async()=>{
    assert.equal((await pref({...mapping,foodId:raw,purchaseFoodId:white})).error,'purchase-product-chain');
    assert.equal((await pref({...mapping,foodId:white,purchaseFoodId:hard})).error,'purchase-product-chain');
    assert.equal((await pref({...mapping,foodId:white,targetUnitId:'g'})).error,'purchase-product-unit-conflict');
    await countProductInventory(pool,{householdId,foodId:white,quantity:30,unitId:'g',version:0});
    assert.equal((await pref({...mapping,foodId:white})).error,'purchase-source-stock-present');
    assert.equal((await listShoppingPreferences(pool,householdId)).mappings.length,1);
    await pref({kind:'product',foodId:hard,purchaseFoodId:null});assert.ok((await list()).some(r=>r.foodId===hard));
    assert.equal((await listShoppingPreferences(pool,householdId)).mappings.length,0);
    assert.equal((await pref({...mapping,foodId:salt})).error,'ingredient-conversion-missing');
    const unresolved=await purchaseProductRequirements(pool,householdId,[{foodId:hard,name:'Hard',quantity:1,unitId:'pinch'}],{mappings:[mapping]});
    assert.equal(unresolved[0].foodId,hard);assert.equal(unresolved[0].quantity,1);assert.equal(unresolved[0].mappingError,true);
  });
  await t.test('an empty source inventory with reversible old deductions cannot be hidden behind a new alias',async()=>{
    await countProductInventory(pool,{householdId,foodId:hard,quantity:1,unitId:'piece',version:0});
    const r=await recipe(hard,1,'piece','batch_cooking');
    const lot=await addStockLot(pool,{householdId,recipeId:r.id,quantity:1,producedOn:start,storage:'fridge',note:''});assert.equal(lot.error,undefined);
    assert.equal((await pref(mapping)).error,'purchase-source-history-present');
    await cancelStockLot(pool,householdId,lot.id);
    assert.equal(Number((await pool.query('SELECT quantity_g FROM household_ingredient_stock WHERE household_id=$1 AND food_id=$2',[householdId,hard])).rows[0].quantity_g),50);
  });
});

test('the shopping settings browser module is served as JavaScript',async()=>{
  const res={headers:{},setHeader(k,v){this.headers[k]=v;},writeHead(code){this.code=code;},end(body){this.body=String(body);}};
  await handleRequest({method:'GET',url:'/shopping-preferences.js',headers:{}},res,{});
  assert.match(res.headers['Content-Type'],/^text\/javascript/);assert.match(res.body,/export function shoppingPreferencesPanel/);
});
