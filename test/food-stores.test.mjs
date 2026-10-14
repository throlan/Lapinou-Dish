import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile,readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { validateFoodStores,listFoodStores } from '../src/server/food-stores.mjs';
import { saveOrderLink,deleteOrderLink,listShoppingRequirements,saveShoppingLineState } from '../src/server/household-planning.mjs';
import { createRecipe,validateRecipeInput } from '../src/server/recipes.mjs';
import { savePlannedMeal } from '../src/server/planning.mjs';
import { handleRequest } from '../src/server/app.mjs';

const h='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const foods=['cccccccc-cccc-4ccc-8ccc-cccccccccccc','dddddddd-dddd-4ddd-8ddd-dddddddddddd','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'];
const store='11111111-1111-4111-8111-111111111111',second='22222222-2222-4222-8222-222222222222',foreign='33333333-3333-4333-8333-333333333333';
const absent='99999999-9999-4999-8999-999999999999',person='44444444-4444-4444-8444-444444444444';
test('food-store selection validates IDs, null removal, limits and deduplication',()=>{
  const input={householdId:h,foodIds:[foods[0]],orderLinkId:store};
  assert.ok(validateFoodStores(input).data);
  assert.equal(validateFoodStores({...input,orderLinkId:null}).data.orderLinkId,null);
  assert.deepEqual(validateFoodStores({...input,foodIds:[foods[0],foods[0].toUpperCase()]}).data.foodIds,[foods[0]]);
  for(const change of [{householdId:null},{foodIds:[]},{foodIds:[null]},{foodIds:[foods[0],"x'); DROP TABLE foods;--"]},{foodIds:Array(201).fill(foods[0])},{orderLinkId:undefined},{orderLinkId:''}])assert.equal(validateFoodStores({...input,...change}).error,'invalid-food-stores');
});
async function request(pool,method,body,password,url='/api/household-food-stores?householdId='+h) {
  const response={setHeader(){},writeHead(status){this.status=status;},end(body){this.body=JSON.parse(body);}};
  await handleRequest({method,url,headers:{},async *[Symbol.asyncIterator](){if(body!==undefined)yield Buffer.from(JSON.stringify(body));}},response,pool,password);
  return response;
}
test('food-store API requires authentication and rejects malformed inputs before database access',async()=>{
  const pool={query(){throw new Error('database must not be reached');}};
  for(const method of ['GET','PUT'])assert.equal((await request(pool,method,{householdId:h,foodIds:foods,orderLinkId:store},'password')).status,401);
  assert.equal((await request(pool,'PUT',{})).status,400);
  assert.equal((await request(pool,'GET',undefined,undefined,'/api/household-food-stores?householdId=invalid')).status,400);
});
test('household shops and shopping preferences survive bulk assignment, reassignment and removal in PostgreSQL',async t=>{
  const db=new PGlite();
  try {
    const dir=new URL('../db/migrations/',import.meta.url),files=(await readdir(dir)).filter(file=>file.endsWith('.sql')).sort();
    for(const file of files)if(file!=='20261014_food_stores.sql')await db.exec(await readFile(new URL(file,dir),'utf8'));
    const pool={async query(sql,args=[]){const result=await db.query(sql,args);return {...result,rowCount:result.rows.length||result.affectedRows||0};},async connect(){return {...this,release(){}};}};
    await pool.query("INSERT INTO households(id,name) VALUES($1,'A'),($2,'B')",[h,other]);
    for(const [i,name] of ['Whey test','Farine test','Lait test'].entries())await pool.query("INSERT INTO foods(id,canonical_name,source) VALUES($1,$2,'manual')",[foods[i],name]);
    for(const [id,householdId,label] of [[store,h,'Nutripure'],[second,h,'Greenwhiz'],[foreign,other,'Autre foyer']])await saveOrderLink(pool,{id,householdId,label,url:'https://shop.example/'+id});
    // Simulate existing installs: shopping settings and links predate the new migration.
    const preference={householdId:h,foodId:foods[0],unitId:'g',startDate:'2026-10-19',endDate:'2026-10-25',groupId:'fresh',checked:true,packageQuantity:500};
    await saveShoppingLineState(pool,preference);
    await db.exec(await readFile(new URL('20261014_food_stores.sql',dir),'utf8'));
    await pool.query("INSERT INTO people(id,household_id,display_name) VALUES($1,$2,'Test')",[person,h]);
    const recipe=await createRecipe(pool,validateRecipeInput({householdId:h,name:'Batch test',yield:{amount:1,unitId:'portion'},lines:foods.map((foodId,i)=>({foodId,quantity:[600,800,200][i],unitId:i===2?'ml':'g'}))}).data);
    await savePlannedMeal(pool,null,{householdId:h,mealDate:'2026-10-19',slot:'lunch',notes:'',attendeeIds:[person],items:[{recipeId:recipe.id,role:'main',amounts:[{personId:person,quantity:1}]}]});
    const getList=()=>listShoppingRequirements(pool,h,'2026-10-19','2026-10-25');
    const assign=(foodIds,orderLinkId,householdId=h)=>request(pool,'PUT',{householdId,foodIds,orderLinkId});
    await t.test('bulk selection persists, is idempotent and applies across all dates and units',async()=>{
      assert.equal((await assign(foods.slice(0,2),store)).status,200);
      assert.equal((await assign(foods.slice(0,2),store)).status,200);
      assert.equal((await listFoodStores(pool,h)).length,2);
      assert.equal((await request(pool,'GET')).body.assignments[0].orderLinkId,store);
      assert.equal((await listFoodStores(pool,other)).length,0);
      const items=await getList(),whey=items.find(item=>item.foodId===foods[0]);
      assert.equal(whey.quantity,1000);assert.equal(whey.neededQuantity,600);assert.equal(whey.packageCount,2);assert.equal(whey.checked,true);
      assert.equal(whey.groupId,'whey_flour');assert.equal(whey.baseGroupId,'fresh');assert.equal(whey.store.id,store);
      assert.equal(items.find(item=>item.foodId===foods[2]).store,null);
      assert.equal((await listShoppingRequirements(pool,h,'2026-10-20','2026-10-25')).length,0);
    });
    await t.test('foreign shops and unknown foods roll back the entire bulk assignment',async()=>{
      assert.equal((await assign([foods[0]],foreign)).status,404);
      assert.equal((await assign([foods[0],absent],second)).status,404);
      assert.equal((await assign([foods[0]],absent)).status,404);
      assert.equal((await assign([foods[0]],store,absent)).status,404);
      assert.ok((await listFoodStores(pool,h)).every(item=>item.orderLinkId===store));
      await assert.rejects(()=>pool.query('UPDATE household_food_stores SET order_link_id=$2 WHERE household_id=$1',[h,foreign]),/foreign key/i);
    });
    await t.test('reassignment routes the right shop without changing quantity, recipes, packages or checkboxes',async()=>{
      assert.equal((await assign([foods[1]],second)).status,200);
      const items=await getList(),whey=items.find(item=>item.foodId===foods[0]),flour=items.find(item=>item.foodId===foods[1]);
      assert.equal(whey.store.label,'Nutripure');assert.equal(flour.store.label,'Greenwhiz');
      assert.equal(whey.checked,true);assert.equal(flour.quantity,800);assert.equal(flour.recipes[0].id,recipe.id);
      assert.equal((await assign([foods[0]],null)).status,200);
      const restored=(await getList()).find(item=>item.foodId===foods[0]);
      assert.equal(restored.groupId,'fresh');assert.equal(restored.store,null);assert.equal(restored.quantity,1000);assert.equal(restored.checked,true);
    });
    await t.test('tracked stock still deducts quantities and preserves the same shop on replenishment',async()=>{
      await pool.query('INSERT INTO household_ingredient_stock(household_id,food_id,quantity_g,minimum_g,target_g,lead_days) VALUES($1,$2,300,100,500,7)',[h,foods[1]]);
      const flour=(await getList()).find(item=>item.foodId===foods[1]);
      assert.equal(flour.quantity,600);assert.equal(flour.neededQuantity,600);assert.equal(flour.store.id,second);
      assert.match(flour.warning,/Stock/);
    });
    await t.test('deleting a shop removes its assignments but never removes purchases or other household links',async()=>{
      assert.equal(await deleteOrderLink(pool,other,second),false);
      assert.equal(await deleteOrderLink(pool,h,second),true);
      assert.equal((await listFoodStores(pool,h)).length,0);
      const flour=(await getList()).find(item=>item.foodId===foods[1]);
      assert.equal(flour.store,null);assert.equal(flour.quantity,600);assert.equal(flour.groupId,'whey_flour');
      assert.equal((await pool.query('SELECT id FROM household_order_links WHERE household_id=$1',[other])).rowCount,1);
    });
  }finally{await db.close();}
});
