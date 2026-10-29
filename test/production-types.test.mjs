import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile,readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { validateProductionTypes,readProductionTypes,saveProductionTypes } from '../src/server/production-types.mjs';
import { createRecipe,validateRecipeInput } from '../src/server/recipes.mjs';
import { savePlannedMeal } from '../src/server/planning.mjs';
import { addStockLot,listPreparationsToMake,listShoppingRequirements,listStock } from '../src/server/household-planning.mjs';
import { productionMinimumInYield } from '../src/server/production-types.mjs';

function poolFor(db){return {async query(sql,args=[]){const result=await db.query(sql,args);return {...result,rowCount:result.rows.length||result.affectedRows||0};},async connect(){return {...this,release(){}};}};}

test('production type settings validate batch minima and protect types used by recipes',async()=>{
  const db=new PGlite();
  try{
    const migrations=new URL('../db/migrations/',import.meta.url);
    for(const file of (await readdir(migrations)).filter(name=>name.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,migrations),'utf8'));
    const pool=poolFor(db),householdId=randomUUID(),foodId=randomUUID();
    await pool.query("INSERT INTO households(id,name) VALUES($1,'Production test')",[householdId]);
    const defaults=(await readProductionTypes(pool,householdId)).productionTypes;
    const bagels=[...defaults,{id:'custom-bagels',label:'Bagels',minimumAmount:24,minimumUnitId:'piece'}];
    assert.equal(validateProductionTypes(bagels).error,undefined);
    await saveProductionTypes(pool,householdId,bagels);
    await pool.query("INSERT INTO foods(id,canonical_name,source) VALUES($1,'Farine fictive','manual')",[foodId]);
    const checked=validateRecipeInput({householdId,name:'Bagels fictifs',recipeType:'accompaniment',productionType:'custom-bagels',yield:{amount:24,unitId:'piece'},outputUnits:{piece:24},lines:[{foodId,quantity:480,unitId:'g'}]});
    assert.equal(checked.error,undefined);
    await createRecipe(pool,checked.data);
    const incompatible=validateRecipeInput({householdId,name:'Autre bagel fictif',recipeType:'accompaniment',productionType:'custom-bagels',yield:{amount:4,unitId:'portion'},lines:[{foodId,quantity:480,unitId:'g'}]});
    await createRecipe(pool,incompatible.data);
    const invalidUnit=await saveProductionTypes(pool,householdId,bagels);
    assert.equal(invalidUnit.error,'production-minimum-unit-missing');
    const removal=await saveProductionTypes(pool,householdId,defaults);
    assert.equal(removal.error,'production-type-in-use');
    assert.equal(removal.recipeCount,2);
    assert.equal((await readProductionTypes(pool,householdId)).productionTypes.some(item=>item.id==='custom-bagels'),true);
  }finally{await db.close();}
});

test('minimum production makes a full bagel batch for shopping and stock covers later menus',async()=>{
  const db=new PGlite();
  try{
    const migrations=new URL('../db/migrations/',import.meta.url);
    for(const file of (await readdir(migrations)).filter(name=>name.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,migrations),'utf8'));
    const pool=poolFor(db),householdId=randomUUID(),personId=randomUUID(),foodId=randomUUID();
    await pool.query("INSERT INTO households(id,name,production_types) VALUES($1,'Bagel batch','[{\"id\":\"custom-bagels\",\"label\":\"Bagels\",\"minimumAmount\":24,\"minimumUnitId\":\"piece\"}]')",[householdId]);
    await pool.query("INSERT INTO people(id,household_id,display_name) VALUES($1,$2,'Test')",[personId,householdId]);
    await pool.query("INSERT INTO foods(id,canonical_name,source) VALUES($1,'Farine fictive','manual')",[foodId]);
    const bagel=await createRecipe(pool,validateRecipeInput({householdId,name:'Bagels maison',recipeType:'accompaniment',productionType:'custom-bagels',yield:{amount:24,unitId:'piece'},outputUnits:{piece:24},lines:[{foodId,quantity:480,unitId:'g'}]}).data);
    const burger=await createRecipe(pool,validateRecipeInput({householdId,name:'Burger fictif',recipeType:'dish',yield:{amount:1,unitId:'portion'},lines:[{recipeId:bagel.id,quantity:1,unitId:'piece'}]}).data);
    const meal=async date=>savePlannedMeal(pool,null,{householdId,mealDate:date,slot:'dinner',notes:'',attendeeIds:[personId],items:[{recipeId:burger.id,role:'main',amounts:[{personId,quantity:4}]}]});
    await meal('2026-10-30');
    let preparations=await listPreparationsToMake(pool,householdId,'2026-10-30','2026-11-01');
    assert.equal(preparations.find(item=>item.recipeId===bagel.id).plannedQuantity,4);
    assert.equal(preparations.find(item=>item.recipeId===bagel.id).toMakeQuantity,24);
    let shopping=await listShoppingRequirements(pool,householdId,'2026-10-30','2026-11-01');
    assert.equal(shopping.find(item=>item.foodId===foodId).neededQuantity,480);
    await addStockLot(pool,{householdId,recipeId:bagel.id,producedOn:'2026-10-29',quantity:24,storage:'freezer',note:''});
    assert.equal((await listStock(pool,householdId)).find(item=>item.recipeId===bagel.id).availableQuantity,20);
    preparations=await listPreparationsToMake(pool,householdId,'2026-10-30','2026-11-01');
    assert.equal(preparations.find(item=>item.recipeId===bagel.id).toMakeQuantity,0);
    shopping=await listShoppingRequirements(pool,householdId,'2026-10-30','2026-11-01');
    assert.equal(shopping.some(item=>item.foodId===foodId),false);
    await meal('2026-10-31');
    preparations=await listPreparationsToMake(pool,householdId,'2026-10-30','2026-11-01');
    assert.equal(preparations.find(item=>item.recipeId===bagel.id).plannedQuantity,8);
    assert.equal(preparations.find(item=>item.recipeId===bagel.id).coveredQuantity,8);
    assert.equal(preparations.find(item=>item.recipeId===bagel.id).toMakeQuantity,0);
  }finally{await db.close();}
});

test('minimum quantities convert through a recipe’s explicit output unit',()=>{
  assert.equal(productionMinimumInYield({yield:{amount:4,unitId:'portion'},outputUnits:{piece:24}},{minimumAmount:24,minimumUnitId:'piece'}),4);
  assert.equal(productionMinimumInYield({yield:{amount:4,unitId:'portion'},outputUnits:{}},{minimumAmount:24,minimumUnitId:'piece'}),0);
});
