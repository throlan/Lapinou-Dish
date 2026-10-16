import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile,readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { applyPackageUnits,applyPurchaseUnits,deletePurchaseUnit,listPurchaseUnits,savePurchaseUnit,validatePurchaseUnit } from '../src/server/purchase-units.mjs';
import { purchaseDescription } from '../src/server/shopping-presentation.mjs';
import { listShoppingRequirements,saveShoppingLineState } from '../src/server/household-planning.mjs';
import { createRecipe,validateRecipeInput } from '../src/server/recipes.mjs';
import { savePlannedMeal } from '../src/server/planning.mjs';

const householdId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const foodId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const rule={householdId,foodId,singularLabel:'tête d’ail',pluralLabel:'têtes d’ail',coveredQuantity:9,coveredUnitId:'piece',estimateNote:'Environ 9 gousses'};

test('purchase unit configuration validates labels, equivalence and allowed source units',()=>{
  assert.deepEqual(validatePurchaseUnit(rule).data,rule);
  for(const change of [{foodId:'wrong'},{singularLabel:' '},{pluralLabel:''},{coveredQuantity:0},{coveredQuantity:Infinity},{coveredUnitId:'portion'},{estimateNote:'x'.repeat(161)}])
    assert.equal(validatePurchaseUnit({...rule,...change}).error,'invalid-purchase-unit');
});

test('documented conversions combine a food into one purchase line; unknown conversions stay visible',()=>{
  const base={foodId,name:'Ail, cru',gramsPerUnit:{piece:3},gramsPerMillilitre:null,recipes:[]};
  const rows=[{...base,unitId:'piece',quantity:3},{...base,unitId:'g',quantity:6}];
  const combined=applyPurchaseUnits(rows,[rule]);
  assert.equal(combined.length,1);assert.equal(combined[0].quantity,5);
  assert.deepEqual(combined[0].sourceNeeds,[{quantity:3,unitId:'piece'},{quantity:6,unitId:'g'}]);
  assert.equal(purchaseDescription({...combined[0],neededQuantity:5}).text,'1 tête d’ail');
  const unresolved=applyPurchaseUnits(rows.map(row=>({...row,gramsPerUnit:{}})),[rule]);
  assert.equal(unresolved.length,2);
  assert.match(unresolved[1].warning,/conversion g → piece inconnue/);
  assert.equal(unresolved[1].purchaseRuleApplied,false);
});

test('a teaspoon weight converts recipe spoons and combines them for package shopping',()=>{
  const cocoaRule={...rule,singularLabel:'paquet',pluralLabel:'paquets',coveredQuantity:250,coveredUnitId:'g',estimateNote:''};
  const base={foodId,name:'Cacao',gramsPerUnit:{tsp:6},gramsPerMillilitre:null,recipes:[]};
  const combined=applyPurchaseUnits([
    {...base,unitId:'tsp',quantity:1},
    {...base,unitId:'tbsp',quantity:8},
  ],[cocoaRule]);
  assert.equal(combined.length,1);
  assert.equal(combined[0].quantity,150);
  assert.equal(purchaseDescription({...combined[0],neededQuantity:150}).text,'1 paquet');
});

test('a configured pinch remains a shopping need and converts to grams for buying',()=>{
  const spiceRule={...rule,singularLabel:'pot',pluralLabel:'pots',coveredQuantity:100,coveredUnitId:'g',estimateNote:''};
  const spice={foodId,name:'Paprika',gramsPerUnit:{pinch:0.3},gramsPerMillilitre:null,recipes:[]};
  const [item]=applyPurchaseUnits([{...spice,unitId:'pinch',quantity:4}],[spiceRule]);
  assert.equal(item.quantity,1.2);
  assert.equal(item.unitId,'g');
  assert.equal(purchaseDescription({...item,neededQuantity:1.2}).text,'1 pot');
});

test('purchase settings persist per household and can be removed without touching other households',async()=>{
  const db=new PGlite();
  try{
    const dir=new URL('../db/migrations/',import.meta.url);
    for(const file of (await readdir(dir)).filter(file=>file.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,dir),'utf8'));
    const pool={async query(sql,args=[]){const result=await db.query(sql,args);return {...result,rowCount:result.rows.length||result.affectedRows||0};},async connect(){return {...this,release(){}};}};
    await pool.query("INSERT INTO households(id,name) VALUES($1,'A'),($2,'B')",[householdId,other]);
    await pool.query("INSERT INTO foods(id,canonical_name,source) VALUES($1,'Ail, cru','manual')",[foodId]);
    await pool.query("INSERT INTO food_unit_conversions(food_id,unit_id,grams_per_unit,source_note) VALUES($1,'piece',3,'Test: gousse moyenne')",[foodId]);
    assert.deepEqual(await savePurchaseUnit(pool,rule),{foodId});
    assert.deepEqual(await listPurchaseUnits(pool,householdId),[{foodId,singularLabel:rule.singularLabel,pluralLabel:rule.pluralLabel,coveredQuantity:9,coveredUnitId:'piece',estimateNote:rule.estimateNote}]);
    assert.deepEqual(await listPurchaseUnits(pool,other),[]);
    const personId='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    await pool.query("INSERT INTO people(id,household_id,display_name) VALUES($1,$2,'Test')",[personId,householdId]);
    const recipe=await createRecipe(pool,validateRecipeInput({householdId,name:'Ail test',yield:{amount:1,unitId:'portion'},
      lines:[{foodId,quantity:3,unitId:'piece'},{foodId,quantity:6,unitId:'g'}]}).data);
    await savePlannedMeal(pool,null,{householdId,mealDate:'2026-10-19',slot:'lunch',notes:'',attendeeIds:[personId],
      items:[{recipeId:recipe.id,role:'main',amounts:[{personId,quantity:1}]}]});
    const shopping=await listShoppingRequirements(pool,householdId,'2026-10-19','2026-10-25');
    assert.equal(shopping.length,1);assert.equal(shopping[0].neededQuantity,5);
    assert.equal(shopping[0].purchase.text,'1 tête d’ail');
    await savePurchaseUnit(pool,{...rule,coveredQuantity:8});
    assert.equal((await listPurchaseUnits(pool,householdId))[0].coveredQuantity,8);
    assert.equal(await deletePurchaseUnit(pool,other,foodId),false);
    assert.equal(await deletePurchaseUnit(pool,householdId,foodId),true);
    assert.deepEqual(await listPurchaseUnits(pool,householdId),[]);

    const butterId='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    await pool.query("INSERT INTO foods(id,canonical_name,source) VALUES($1,'Beurre de cacahuète','manual')",[butterId]);
    await pool.query("INSERT INTO food_unit_conversions(food_id,unit_id,grams_per_unit,source_note) VALUES($1,'tbsp',24,'Test')",[butterId]);
    const butterRecipe=await createRecipe(pool,validateRecipeInput({householdId,name:'Beurre test',yield:{amount:1,unitId:'portion'},
      lines:[{foodId:butterId,quantity:500,unitId:'g'},{foodId:butterId,quantity:8,unitId:'tbsp'}]}).data);
    await savePlannedMeal(pool,null,{householdId,mealDate:'2026-10-20',slot:'dinner',notes:'',attendeeIds:[personId],
      items:[{recipeId:butterRecipe.id,role:'main',amounts:[{personId,quantity:1}]}]});
    await saveShoppingLineState(pool,{householdId,foodId:butterId,unitId:'g',startDate:'2026-10-19',endDate:'2026-10-25',groupId:'bulk',checked:false,packageQuantity:500});
    const butterShopping=(await listShoppingRequirements(pool,householdId,'2026-10-19','2026-10-25')).filter(item=>item.foodId===butterId);
    assert.equal(butterShopping.length,1);
    assert.equal(butterShopping[0].neededQuantity,692);
    assert.equal(butterShopping[0].quantity,1000);
    assert.equal(butterShopping[0].purchase.text,'2 × 500 g');
  }finally{await db.close();}
});
