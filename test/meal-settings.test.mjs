import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile,readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { MEAL_ORDER,DEFAULT_MEAL_RATIOS,validMealRatios } from '../web/meal-config.js';
import { suggestQuantity } from '../web/portion-planner.js';
import { handleRequest } from '../src/server/app.mjs';
import { createRecipe,validateRecipeInput } from '../src/server/recipes.mjs';
import { savePlannedMeal,listPlannedMeals,duplicatePlannedMeal,validatePlannedMeal } from '../src/server/planning.mjs';
import { rawShoppingRequirements } from '../src/server/shopping-requirements.mjs';
const h='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',p='cccccccc-cccc-4ccc-8ccc-cccccccccccc',food='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const custom={breakfast:0.1,lunch:0.4,snack:0.15,dinner:0.2,evening_snack:0.15};

test('five daily shares total 100 percent and match the requested Lapinou objectives',()=>{
  assert.equal(validMealRatios(DEFAULT_MEAL_RATIOS),true);
  assert.deepEqual(MEAL_ORDER.map(slot=>1850*DEFAULT_MEAL_RATIOS[slot]),[277.5,740,185,462.5,185]);
  for(const value of [null,[],{...custom,lunch:0.5},{...custom,breakfast:-0.1},{...custom,snack:'0.15'},{...custom,extra:0},Object.fromEntries(Object.entries(custom).filter(([key])=>key!=='evening_snack'))]) assert.equal(validMealRatios(value),false);
  assert.equal(validMealRatios({breakfast:0,lunch:0.5,snack:0,dinner:0.5,evening_snack:0}),true);
});
test('automatic quantities use the saved shares for both snacks, including zero and remaining daily budget',()=>{
  const base={dailyTargetKcal:2000,recipeKcal:1,recipeUnit:'g',slotRatios:custom};
  assert.equal(suggestQuantity({...base,slot:'evening_snack'}).quantity,400);
  assert.equal(suggestQuantity({...base,slot:'snack'}).quantity,400);
  assert.equal(suggestQuantity({...base,slot:'evening_snack',plannedOtherKcal:1950}).quantity,50);
  assert.equal(suggestQuantity({...base,slot:'evening_snack',slotRatios:{...custom,evening_snack:0}}).reason,'no-slot-budget');
});
async function request(pool,method,url,body,password){
  const response={headers:{},setHeader(k,v){this.headers[k]=v;},writeHead(status){this.status=status;},end(body){this.body=JSON.parse(body);}};
  await handleRequest({method,url,headers:{},async *[Symbol.asyncIterator](){if(body!==undefined)yield Buffer.from(JSON.stringify(body));}},response,pool,password);
  return response;
}
test('meal distribution administration requires the existing authenticated session',async()=>{
  const pool={query(){throw new Error('must not access database');}};
  for(const method of ['GET','PUT'])assert.equal((await request(pool,method,'/api/meal-settings?householdId='+h,{householdId:h,ratios:custom},'synthetic-password')).status,401);
});
test('saved household ratios, evening meals, copies and shopping persist against PostgreSQL',async()=>{
  const db=new PGlite();
  try{
    const dir=new URL('../db/migrations/',import.meta.url);
    for(const file of (await readdir(dir)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,dir),'utf8'));
    const pool={async query(sql,args=[]){const r=await db.query(sql,args);return {...r,rowCount:r.rows.length||r.affectedRows||0};},async connect(){return {...this,release(){}};}};
    await pool.query('INSERT INTO households(id,name) VALUES($1,\'A\'),($2,\'B\')',[h,other]);
    const path='/api/meal-settings?householdId='+h;
    assert.deepEqual((await request(pool,'GET',path)).body.ratios,DEFAULT_MEAL_RATIOS);
    assert.equal((await request(pool,'PUT',path,{householdId:h,ratios:{...custom,lunch:0.5}})).status,400);
    assert.equal((await request(pool,'PUT',path,{householdId:h,ratios:custom})).status,200);
    assert.deepEqual((await request(pool,'GET',path)).body.ratios,custom);
    assert.deepEqual((await request(pool,'GET','/api/meal-settings?householdId='+other)).body.ratios,DEFAULT_MEAL_RATIOS);
    assert.equal((await request(pool,'GET','/api/meal-settings?householdId=eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee')).status,404);
    await pool.query('INSERT INTO people(id,household_id,display_name) VALUES($1,$2,\'Test\')',[p,h]);
    await pool.query('INSERT INTO foods(id,canonical_name,source) VALUES($1,\'Snack test\',\'manual\')',[food]);
    const recipe=await createRecipe(pool,validateRecipeInput({householdId:h,name:'Snack',mealMoments:['snack'],yield:{amount:100,unitId:'g'},lines:[{foodId:food,quantity:100,unitId:'g'}]}).data);
    const input={householdId:h,mealDate:'2026-10-19',slot:'evening_snack',notes:'soir',attendeeIds:[p],items:[{recipeId:recipe.id,role:'main',amounts:[{personId:p,quantity:80}]}]};
    assert.equal(validatePlannedMeal(input).error,undefined);
    const meal=await savePlannedMeal(pool,null,input);
    assert.equal(meal.slot,'evening_snack');
    const copy=await duplicatePlannedMeal(pool,meal.id,{householdId:h,requestId:'ffffffff-ffff-4fff-8fff-ffffffffffff',slot:'evening_snack',dates:['2026-10-20']});
    const meals=await listPlannedMeals(pool,h,'2026-10-19');assert.equal(meals.find(m=>m.id===copy.mealIds[0]).slot,'evening_snack');
    assert.equal((await rawShoppingRequirements(pool,h,'2026-10-19','2026-10-20'))[0].quantity,160);
    await request(pool,'PUT',path,{householdId:h,ratios:DEFAULT_MEAL_RATIOS});
    assert.equal((await listPlannedMeals(pool,h,'2026-10-19'))[0].items[0].amounts[0].quantity,80);
  }finally{await db.close();}
});
