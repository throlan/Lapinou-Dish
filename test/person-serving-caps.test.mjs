import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {randomUUID} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {handleRequest} from '../src/server/app.mjs';
import {cappedMealPortions} from '../web/portion-planner.js';
import {servingIngredientLoad} from '../src/server/serving-limits.mjs';

async function request(pool,method,url,body){
  const response={setHeader(){},writeHead(status){this.status=status;},end(value){this.body=JSON.parse(value);}};
  await handleRequest({method,url,headers:{},async *[Symbol.asyncIterator](){if(body)yield Buffer.from(JSON.stringify(body));}},response,pool);
  return response;
}

test('per-profile caps persist, validate household ownership and can be reset to defaults',async()=>{
  const db=new PGlite();
  try{
    const dir=new URL('../db/migrations/',import.meta.url);
    for(const f of (await readdir(dir)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(f,dir),'utf8'));
    const [h,other,a,b,foreign]=Array.from({length:5},()=>randomUUID());
    await db.query("INSERT INTO households(id,name) VALUES($1,'Test'),($2,'Other')",[h,other]);
    await db.query("INSERT INTO people(id,household_id,display_name) VALUES($1,$4,'A'),($2,$4,'B'),($3,$5,'Other')",[a,b,foreign,h,other]);
    const endpoint='/api/serving-caps',url=endpoint+'?householdId='+h;
    assert.deepEqual((await request(db,'GET',url)).body,{caps:{}});
    const caps={[a]:{starch:150,vegetables:280},[b]:{starch:250,eggs:4}};
    assert.deepEqual((await request(db,'PUT',endpoint,{householdId:h,caps})).body,{caps});
    for(const invalid of [{[foreign]:{starch:250}},{[a]:{eggs:2.5}},{[a]:{starch:-1}},{[a]:{other:10}}]){
      assert.equal((await request(db,'PUT',endpoint,{householdId:h,caps:invalid})).status,400);
    }
    assert.deepEqual((await request(db,'GET',url)).body,{caps});
    assert.deepEqual((await request(db,'PUT',endpoint,{householdId:h,caps:{[b]:{}}})).body,{caps:{}});
  }finally{await db.close();}
});

test('per-profile starch and vegetable caps preserve the configured ratio in a three-part plate',()=>{
  const parts=['main','starch','vegetables'];
  const plate=parts.map((servingPart,i)=>({parentRecipeId:'plate',plateParts:parts,servingPart,recipeUnit:'g',
    role:i?'accompaniment':'main',recipeKcal:1,budgetFraction:1/3,
    servingLoad:[{meat:1.25},{starch:1},{vegetables:1}][i]}));
  const result=caps=>cappedMealPortions(plate,1200,undefined,caps).proposals.map(row=>row.quantity);
  assert.deepEqual(result(undefined),[100,200,400]);
  assert.deepEqual(result({starch:150}),[100,150,300]);
  assert.deepEqual(result({starch:250}),[100,250,500]);
  assert.deepEqual(result({starch:250,vegetables:360,meat:100}),[80,180,360]);
});

test('a mixed dish counts served vegetable mass and retains its proportions when capped',()=>{
  const vegetables=servingIngredientLoad({quantity:100,unitId:'g',cookingState:'cooked_from_raw',foodCookingFactor:.8},
    {name:'Carotte',category:'Légumes',gramsPerUnit:{}},{},'main');
  assert.deepEqual(vegetables,{vegetables:80});
  const dish={role:'main',recipeUnit:'portion',quantity:4,recipeKcal:250,servingLoad:{vegetables:80,fish:100}};
  assert.equal(cappedMealPortions([dish],1200,undefined,{vegetables:85}).proposals[0].quantity,1);
});


test('calorie budgets change the sides, not the shared main protein amount',()=>{
  const parts=['main','starch','vegetables'];
  for(const [key,perGram,step,want] of [['meat',1.25,undefined,100],['fish',1.25,undefined,120],['eggs',.02,50,150]]){
    const plate=parts.map((servingPart,i)=>({parentRecipeId:'plate',plateParts:parts,servingPart,recipeUnit:'g',
      role:i?'accompaniment':'main',recipeKcal:i?1:2,budgetFraction:1/3,
      servingLoad:[{[key]:perGram},{starch:1},{vegetables:1}][i],countStep:i?undefined:step}));
    const low=cappedMealPortions(plate,400).proposals;
    const high=cappedMealPortions(plate,1200).proposals;
    assert.equal(low[0].quantity,want);assert.equal(high[0].quantity,want);
    assert.ok(low[1].quantity<high[1].quantity);
  }
});
