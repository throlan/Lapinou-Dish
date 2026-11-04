import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createRecipe,validateRecipeInput} from '../src/server/recipes.mjs';
import {savePlannedMeal} from '../src/server/planning.mjs';
import {addStockLot,cancelStockLot,listPreparationsToMake,listShoppingRequirements} from '../src/server/household-planning.mjs';
import {listExtraProductions,saveExtraProduction,validateExtraProduction} from '../src/server/extra-productions.mjs';
import {readFoodShoppingSettings,saveFoodShoppingSettings,validateFoodShoppingSettings} from '../src/server/food-shopping-settings.mjs';
import {handleRequest} from '../src/server/app.mjs';

test('new planning and product settings routes require a session and validate input',async()=>{
  const householdId=randomUUID(),foodId=randomUUID();
  const request=async(method,url,body,password)=>{
    const response={setHeader(){},writeHead(status){this.status=status;},end(value){this.body=JSON.parse(value);}};
    await handleRequest({method,url,headers:{},async *[Symbol.asyncIterator](){if(body!==undefined)yield Buffer.from(JSON.stringify(body));}},response,{query(){throw new Error('Unexpected database access');}},password);
    return response;
  };
  const url=`/api/household-planning/extra-productions?householdId=${householdId}&startDate=2026-11-01&endDate=2026-11-30`;
  assert.equal((await request('GET',url,undefined,'password')).status,401);
  assert.equal((await request('GET','/api/household-planning/extra-productions?householdId=wrong&startDate=2026-11-01&endDate=2026-11-30')).status,400);
  assert.equal((await request('GET',`/api/food-shopping-settings?householdId=${householdId}&foodId=${foodId}`,undefined,'password')).status,401);
  assert.equal((await request('PUT','/api/food-shopping-settings',{})).status,400);
  assert.equal(validateExtraProduction({householdId,recipeId:randomUUID(),plannedOn:'2026-02-30',quantity:24,storage:'freezer'}).error,'invalid-extra-production');
});

test('a planned extra batch enters shopping, covers later menus, and reaches stock only after confirmation',async()=>{
  const db=new PGlite();
  try{
    const dir=new URL('../db/migrations/',import.meta.url);
    for(const file of (await readdir(dir)).filter(name=>name.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,dir),'utf8'));
    const pool={async query(sql,args=[]){const result=await db.query(sql,args);return {...result,rowCount:result.rows.length||result.affectedRows||0};},async connect(){return {...this,release(){}};}};
    const householdId=randomUUID(),personId=randomUUID(),foodId=randomUUID();
    await pool.query("INSERT INTO households(id,name) VALUES($1,'Synthetic extra production')",[householdId]);
    await pool.query("INSERT INTO people(id,household_id,display_name) VALUES($1,$2,'Synthetic')",[personId,householdId]);
    await pool.query("INSERT INTO foods(id,canonical_name,source) VALUES($1,'Synthetic flour','manual')",[foodId]);
    const checked=validateRecipeInput({householdId,name:'Synthetic bagels',recipeType:'dish',productionType:'bread',yield:{amount:24,unitId:'piece'},minimumProductionAmount:24,minimumProductionUnitId:'piece',lines:[{foodId,quantity:1200,unitId:'g'}]});
    assert.equal(checked.error,undefined);
    const recipe=await createRecipe(pool,checked.data);
    const plan=validateExtraProduction({householdId,recipeId:recipe.id,plannedOn:'2026-11-05',quantity:4,storage:'freezer'});
    assert.equal(plan.error,undefined);
    assert.equal(validateExtraProduction({...plan.data,quantity:0}).error,'invalid-extra-production');
    const saved=await saveExtraProduction(pool,plan.data);
    assert.equal(saved.quantity,24);
    await savePlannedMeal(pool,null,{householdId,mealDate:'2026-11-07',slot:'lunch',notes:'Synthetic',attendeeIds:[personId],items:[{recipeId:recipe.id,role:'main',amounts:[{personId,quantity:4}]}]});
    const shopping=await listShoppingRequirements(pool,householdId,'2026-11-05','2026-11-07');
    assert.equal(shopping.find(item=>item.foodId===foodId).neededQuantity,1200);
    assert.equal((await listPreparationsToMake(pool,householdId,'2026-11-05','2026-11-07')).find(item=>item.recipeId===recipe.id)?.toMakeQuantity,0);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM stock_lots')).rows[0].n,0);
    const lot=await addStockLot(pool,{householdId,recipeId:recipe.id,extraProductionId:saved.id,quantity:24,producedOn:'2026-11-05',storage:'freezer',note:'',requestId:randomUUID()});
    assert.ok(lot.id);
    assert.equal((await listExtraProductions(pool,householdId,'2026-11-01','2026-11-30'))[0].completed,true);
    assert.deepEqual(await listShoppingRequirements(pool,householdId,'2026-11-05','2026-11-07'),[]);
    const cancelled=await cancelStockLot(pool,householdId,lot.id);
    assert.equal(cancelled.cancelled,true);
    assert.equal((await listExtraProductions(pool,householdId,'2026-11-01','2026-11-30'))[0].completed,false);
    assert.equal((await listShoppingRequirements(pool,householdId,'2026-11-05','2026-11-07'))[0].neededQuantity,1200);
    const settings={householdId,foodId,unitId:'g',groupId:'fresh',packageQuantity:500,orderLinkId:null};
    assert.equal(validateFoodShoppingSettings(settings).error,undefined);
    assert.equal((await saveFoodShoppingSettings(pool,settings)).saved,true);
    const loaded=await readFoodShoppingSettings(pool,householdId,foodId);
    assert.equal(loaded.groups[0].groupId,'fresh');assert.equal(loaded.packs[0].packageQuantity,500);
  }finally{await db.close();}
});
