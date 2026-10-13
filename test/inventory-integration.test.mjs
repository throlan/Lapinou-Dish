import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { saveIngredientStock, listIngredientStock } from '../src/server/ingredient-stock.mjs';
import { addStockLot, cancelStockLot, listShoppingRequirements, listStock } from '../src/server/household-planning.mjs';
import { duplicatePlannedMeal, savePlannedMeal, validateMealDuplication, validatePlannedMeal } from '../src/server/planning.mjs';

const householdId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const whey='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const flour='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const recipeId='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const person='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const meal='ffffffff-ffff-4fff-8fff-ffffffffffff';
const item='11111111-1111-4111-8111-111111111111';

test('ingredient inventory and shopping run against PostgreSQL, with atomic production deductions', async t => {
  const db=new PGlite();
  t.after(()=>db.close());
  const pool={
    async query(sql,params=[]) {const result=await db.query(sql,params);return {...result,rowCount:result.rows.length || result.affectedRows || 0};},
    async connect(){return {...this,release(){}};},
  };
  const migrations=new URL('../db/migrations/',import.meta.url);
  for(const file of (await readdir(migrations)).filter(file=>file.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,migrations),'utf8'));
  // New migration can safely be repeated without changing existing stock.
  const today=(await pool.query('SELECT CURRENT_DATE::text AS today')).rows[0].today;
  await db.exec(`
    INSERT INTO households(id,name) VALUES ('${householdId}','Synthetic household');
    INSERT INTO people(id,household_id,display_name) VALUES ('${person}','${householdId}','Synthetic person');
    INSERT INTO foods(id,canonical_name,source) VALUES ('${whey}','Test whey','manual'),('${flour}','Test flour','manual');
    INSERT INTO recipes(id,household_id,name,yield_amount,yield_unit_id,production_type)
      VALUES ('${recipeId}','${householdId}','Test muffins',12,'piece','pastry');
    INSERT INTO recipe_lines(id,recipe_id,food_id,quantity,unit_id) VALUES
      ('22222222-2222-4222-8222-222222222222','${recipeId}','${whey}',0.12,'kg'),
      ('33333333-3333-4333-8333-333333333333','${recipeId}','${flour}',300,'g');
  `);
  const stockInput=(foodId,quantityG,minimumG,targetG,version=0)=>({householdId,foodId,quantityG,minimumG,targetG,leadDays:7,version});
  assert.deepEqual(await saveIngredientStock(pool,stockInput(whey,500,100,1000)),{saved:true});
  assert.deepEqual(await saveIngredientStock(pool,stockInput(flour,2000,500,3000)),{saved:true});
  await db.exec(await readFile(new URL('20261013_ingredient_stock.sql',migrations),'utf8'));
  const production={householdId,recipeId,producedOn:today,quantity:24,storage:'freezer',note:'',requestId:'44444444-4444-4444-8444-444444444444'};

  await t.test('24 muffins deduct 240 g whey and 600 g flour, and add 24 finished pieces',async()=>{
    const lot=await addStockLot(pool,production);
    assert.equal(lot.quantity,24);
    assert.equal(lot.deductions.find(row=>row.foodId===whey).usedG,240);
    assert.equal(lot.deductions.find(row=>row.foodId===flour).usedG,600);
    const stocks=await listIngredientStock(pool,householdId);
    assert.equal(stocks.find(row=>row.foodId===whey).quantityG,260);
    assert.equal(stocks.find(row=>row.foodId===flour).quantityG,1400);
    assert.equal((await listStock(pool,householdId))[0].producedQuantity,24);
  });
  await t.test('retrying the same request does not add a second lot or deduct twice',async()=>{
    const lot=await addStockLot(pool,production);assert.equal(lot.replayed,true);
    assert.equal((await listStock(pool,householdId))[0].producedQuantity,24);
    assert.equal((await listIngredientStock(pool,householdId)).find(row=>row.foodId===whey).quantityG,260);
    assert.equal((await addStockLot(pool,{...production,quantity:25})).error,'production-request-conflict');
  });
  await t.test('insufficient inventory rolls back both ingredients and finished lot',async()=>{
    const result=await addStockLot(pool,{...production,quantity:120,requestId:null});
    assert.equal(result.error,'ingredient-stock-insufficient');
    assert.equal((await listStock(pool,householdId))[0].producedQuantity,24);
    assert.equal((await listIngredientStock(pool,householdId)).find(row=>row.foodId===flour).quantityG,1400);
  });
  await t.test('stale stock counts cannot overwrite deductions made by production',async()=>{
    assert.equal((await saveIngredientStock(pool,stockInput(whey,500,100,1000,1))).error,'ingredient-stock-changed');
    assert.equal((await listIngredientStock(pool,householdId)).find(row=>row.foodId===whey).quantityG,260);
  });
  await db.exec(`
    INSERT INTO planned_meals(id,household_id,meal_date,slot) VALUES ('${meal}','${householdId}','${today}','breakfast');
    INSERT INTO planned_meal_items(id,meal_id,recipe_id) VALUES ('${item}','${meal}','${recipeId}');
    INSERT INTO planned_amounts(planned_item_id,person_id,quantity) VALUES ('${item}','${person}',24);
  `);
  await t.test('finished muffins cover planned meals without buying their ingredients again',async()=>{
    assert.deepEqual(await listShoppingRequirements(pool,householdId,today,today),[]);
  });
  await pool.query('UPDATE planned_amounts SET quantity=48 WHERE planned_item_id=$1',[item]);
  await t.test('copying complete meals preserves people, roles, quantities and notes on several dates',async()=>{
    // Include a personal beverage and an accompaniment in the stored meal.
    await pool.query('INSERT INTO planned_meal_attendees(meal_id,person_id) VALUES($1,$2)',[meal,person]);
    await pool.query("UPDATE planned_meals SET notes='Synthetic batch note' WHERE id=$1",[meal]);
    await pool.query("INSERT INTO planned_meal_items(id,meal_id,recipe_id,role,sort_order) VALUES ('99999999-9999-4999-8999-999999999999',$1,$2,'beverage',1),('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',$1,$2,'accompaniment',2)",[meal,recipeId]);
    await pool.query("INSERT INTO planned_amounts(planned_item_id,person_id,quantity) VALUES ('99999999-9999-4999-8999-999999999999',$1,3),('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',$1,150)",[person]);
    const input={householdId,requestId:'aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa',dates:['2027-01-04','2027-01-11'],slot:'breakfast'};
    assert.ok(validateMealDuplication(input).data);
    assert.equal(validateMealDuplication({...input,dates:['2027-02-30']}).error,'invalid-meal-duplication');
    assert.equal(validateMealDuplication({...input,dates:['2027-01-04','2027-01-04']}).error,'invalid-meal-duplication');
    const result=await duplicatePlannedMeal(pool,meal,input);assert.equal(result.mealIds.length,2);
    for(const id of result.mealIds){
      const copied=await pool.query('SELECT notes,slot FROM planned_meals WHERE id=$1',[id]);assert.equal(copied.rows[0].notes,'Synthetic batch note');
      assert.equal((await pool.query('SELECT person_id FROM planned_meal_attendees WHERE meal_id=$1',[id])).rows[0].person_id,person);
      const amounts=await pool.query('SELECT i.role,a.quantity FROM planned_meal_items i JOIN planned_amounts a ON a.planned_item_id=i.id WHERE i.meal_id=$1 ORDER BY i.sort_order',[id]);
      assert.deepEqual(amounts.rows.map(row=>[row.role,Number(row.quantity)]),[['main',48],['beverage',3],['accompaniment',150]]);
    }
    assert.equal((await duplicatePlannedMeal(pool,meal,input)).replayed,true);
    assert.equal((await duplicatePlannedMeal(pool,meal,{...input,slot:'lunch'})).error,'duplication-request-conflict');
    assert.equal((await duplicatePlannedMeal(pool,meal,{...input,requestId:'aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa',dates:[today]})).error,'source-date-selected');
    assert.equal((await duplicatePlannedMeal(pool,meal,{...input,householdId:'aaaaaaaa-4444-4444-8444-aaaaaaaaaaaa'})).error,'source-meal-not-found');
    await pool.query('DELETE FROM planned_meals WHERE id=ANY($1::uuid[])',[result.mealIds]);
    await pool.query("DELETE FROM planned_meal_items WHERE meal_id=$1 AND role<>'main'",[meal]);
  });
  await t.test('planned shortage anticipates ordering within the delivery lead time',async()=>{
    const stocks=await listIngredientStock(pool,householdId);
    const wheyStock=stocks.find(row=>row.foodId===whey);
    assert.equal(wheyStock.neededG,240);assert.equal(wheyStock.projectedG,20);
    assert.equal(wheyStock.alert,true);assert.equal(wheyStock.orderG,740);
    const shopping=await listShoppingRequirements(pool,householdId,today,today);
    assert.equal(shopping.length,1);assert.equal(shopping[0].foodId,whey);
    assert.equal(shopping[0].quantity,740);assert.equal(shopping[0].unitId,'g');
    assert.deepEqual(shopping[0].recipes,[{id:recipeId,name:'Test muffins',quantity:0.24,unitId:'kg'}]);
  });
  await t.test('finished batches reserved for earlier meals cannot cover later meals a second time',async()=>{
    await db.exec(`
      INSERT INTO planned_meals(id,household_id,meal_date,slot) VALUES ('55555555-5555-4555-8555-555555555555','${householdId}',CURRENT_DATE-1,'breakfast');
      INSERT INTO planned_meal_items(id,meal_id,recipe_id) VALUES ('66666666-6666-4666-8666-666666666666','55555555-5555-4555-8555-555555555555','${recipeId}');
      INSERT INTO planned_amounts(planned_item_id,person_id,quantity) VALUES ('66666666-6666-4666-8666-666666666666','${person}',12);
    `);
    assert.equal((await listIngredientStock(pool,householdId)).find(row=>row.foodId===whey).neededG,360);
    await pool.query("DELETE FROM planned_meals WHERE id='55555555-5555-4555-8555-555555555555'");
  });
  await t.test('optional personal desserts persist separately and survive complete meal duplication',async()=>{
    const teenA='aaaa1111-1111-4111-8111-aaaaaaaaaaaa',teenB='bbbb1111-1111-4111-8111-bbbbbbbbbbbb';
    const dessertA='cccc1111-1111-4111-8111-cccccccccccc',dessertB='dddd1111-1111-4111-8111-dddddddddddd';
    await db.exec(`
      INSERT INTO people(id,household_id,display_name) VALUES ('${teenA}','${householdId}','Synthetic teen A'),('${teenB}','${householdId}','Synthetic teen B');
      INSERT INTO recipes(id,household_id,name,yield_amount,yield_unit_id,recipe_type) VALUES ('${dessertA}','${householdId}','Synthetic compote',1,'portion','dessert'),('${dessertB}','${householdId}','Synthetic yogurt',1,'portion','dessert');
      INSERT INTO recipe_lines(id,recipe_id,food_id,quantity,unit_id) VALUES ('eeee1111-1111-4111-8111-eeeeeeeeeeee','${dessertA}','${flour}',100,'g'),('ffff1111-1111-4111-8111-ffffffffffff','${dessertB}','${whey}',125,'g');
    `);
    const payload={householdId,mealDate:'2027-03-01',slot:'lunch',attendeeIds:[person,teenA,teenB],items:[
      {recipeId,role:'main',amounts:[person,teenA,teenB].map(personId=>({personId,quantity:1}))},
      {recipeId:dessertA,role:'dessert',amounts:[{personId:teenA,quantity:1}]},
      {recipeId:dessertB,role:'dessert',amounts:[{personId:teenB,quantity:2}]},
    ]};
    const validated=validatePlannedMeal(payload);assert.ok(validated.data);
    assert.equal(validatePlannedMeal({...payload,items:[{...payload.items[1],amounts:[{personId:'11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa',quantity:1}]}]}).error,'invalid-planned-amount-person');
    const saved=await savePlannedMeal(pool,null,validated.data);
    assert.deepEqual(saved.items.filter(item=>item.role==='dessert').map(item=>item.amounts),[[{personId:teenA,quantity:1}],[{personId:teenB,quantity:2}]]);
    const copy=await duplicatePlannedMeal(pool,saved.id,{householdId,requestId:'11111111-bbbb-4bbb-8bbb-bbbbbbbbbbbb',dates:['2027-03-02'],slot:'lunch'});
    const copied=await pool.query("SELECT i.recipe_id,a.person_id,a.quantity FROM planned_meal_items i JOIN planned_amounts a ON a.planned_item_id=i.id WHERE i.meal_id=$1 AND i.role='dessert' ORDER BY i.sort_order",[copy.mealIds[0]]);
    assert.deepEqual(copied.rows.map(row=>[row.recipe_id,row.person_id,Number(row.quantity)]),[[dessertA,teenA,1],[dessertB,teenB,2]]);
    await pool.query('DELETE FROM planned_meals WHERE id=ANY($1::uuid[])',[[saved.id,...copy.mealIds]]);
  });
  await t.test('unknown piece conversions reject production without silently deducting grams',async()=>{
    await pool.query("UPDATE recipe_lines SET unit_id='piece' WHERE food_id=$1",[whey]);
    const result=await addStockLot(pool,{...production,quantity:1,requestId:null});
    assert.equal(result.error,'ingredient-conversion-missing');
    assert.equal((await listStock(pool,householdId))[0].producedQuantity,24);
    const stocks=await listIngredientStock(pool,householdId);
    assert.equal(stocks.find(row=>row.foodId===whey).complete,false);
    const shopping=await listShoppingRequirements(pool,householdId,today,today);
    assert.equal(shopping[0].unitId,'piece');assert.match(shopping[0].warning,/Conversion/);
    assert.equal(shopping[0].quantity,1,'fractional recipe needs must be rounded up to a purchasable whole piece');
    assert.equal(shopping[0].quantityRounded,true);
  });
  await t.test('cancelling a lot restores recorded deductions even after editing its recipe',async()=>{
    const stock=(await listStock(pool,householdId))[0];
    assert.equal(stock.lots.length,1);
    const lotId=stock.lots[0].id;
    assert.equal((await cancelStockLot(pool,'99999999-9999-4999-8999-999999999999',lotId)).error,'production-lot-not-found');
    await pool.query("UPDATE recipe_lines SET quantity=999,unit_id='g' WHERE recipe_id=$1",[recipeId]);
    const result=await cancelStockLot(pool,householdId,lotId);
    assert.equal(result.cancelled,true);
    assert.equal(result.restored.find(row=>row.foodId===whey).quantityG,240);
    assert.equal((await listIngredientStock(pool,householdId)).find(row=>row.foodId===whey).quantityG,500);
    assert.equal((await listIngredientStock(pool,householdId)).find(row=>row.foodId===flour).quantityG,2000);
    const remaining=(await listStock(pool,householdId))[0];
    assert.equal(remaining.producedQuantity,0);assert.deepEqual(remaining.lots,[]);
    assert.equal((await cancelStockLot(pool,householdId,lotId)).replayed,true);
    assert.equal((await listIngredientStock(pool,householdId)).find(row=>row.foodId===whey).quantityG,500);
    assert.equal((await addStockLot(pool,production)).error,'production-request-cancelled');
  });
  await t.test('legacy test lots can be removed without inventing ingredient credits',async()=>{
    const legacy='77777777-7777-4777-8777-777777777777';
    await pool.query('INSERT INTO stock_lots(id,household_id,recipe_id,produced_on,quantity,storage) VALUES ($1,$2,$3,$4,8,\'freezer\')',[legacy,householdId,recipeId,today]);
    const result=await cancelStockLot(pool,householdId,legacy);
    assert.deepEqual(result.restored,[]);
    assert.equal((await listIngredientStock(pool,householdId)).find(row=>row.foodId===whey).quantityG,500);
    await pool.query('DELETE FROM planned_meals WHERE id=$1',[meal]);
    assert.deepEqual(await listStock(pool,householdId),[]);
    assert.equal((await cancelStockLot(pool,householdId,'88888888-8888-4888-8888-888888888888')).error,'production-lot-not-found');
  });
});
