import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile,readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { DEFAULT_PLATE_RATIOS,validPlateRatios } from '../web/meal-config.js';
import { suggestPlatePortions } from '../web/portion-planner.js';
import { rebalanceDailyEnergy } from '../src/server/daily-rebalance.mjs';
import { handleRequest } from '../src/server/app.mjs';

const h='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const custom={whole:{main:1},separate:{main:0.6,starch:0.4},three:{main:0.3,starch:0.2,vegetables:0.5}};
const parts=['main','starch','vegetables'];
function plate(three=true) {
  const expected=three?parts:parts.slice(0,2);
  return expected.map((part,index)=>({parentRecipeId:'parent',servingPart:part,plateParts:expected,recipeUnit:'g',
    role:index?'accompaniment':'main',quantity:100,step:10,maxQuantity:Infinity,
    recipeKcal:[2,1.2,0.3][index],proteinG:[0.25,0.03,0.01][index],budgetFraction:index?0.3/(expected.length-1):0.7}));
}
test('plate defaults are weight shares, with 25 percent starch and 50 percent vegetables',()=>{
  assert.deepEqual(DEFAULT_PLATE_RATIOS,{whole:{main:1},separate:{main:0.7,starch:0.3},three:{main:0.25,starch:0.25,vegetables:0.5}});
  assert.equal(validPlateRatios(custom),true);
  for(const value of [null,[],{...custom,extra:{}},{...custom,separate:{main:0.6,starch:0.3}},{...custom,three:{main:0.5,starch:0,vegetables:0.5}},{...custom,three:{main:'0.3',starch:0.2,vegetables:0.5}},{...custom,whole:{main:0.9}}])assert.equal(validPlateRatios(value),false);
});
test('both split modes use grams rather than calorie percentages and preserve proportions during protein adjustment',()=>{
  for(const three of [false,true]) {
    const rows=plate(three),result=suggestPlatePortions(rows,600);
    const expected=three?DEFAULT_PLATE_RATIOS.three:DEFAULT_PLATE_RATIOS.separate;
    const total=result.proposals.reduce((sum,row)=>sum+row.quantity,0);
    for(const row of result.proposals)assert.ok(Math.abs(row.quantity/total-expected[row.servingPart])<1e-9);
    assert.ok(result.estimatedKcal<=600);assert.equal(result.proportionsApplied,true);
    assert.equal(rows[0].quantity,100,'inputs stay untouched');
  }
});
test('custom proportions, part caps and fixed dessert/beverage calories constrain the entire plate',()=>{
  const rows=plate();rows[0].maxQuantity=120;rows[2].maxQuantity=200;
  rows.push({role:'dessert',quantity:1,step:1,recipeKcal:100,proteinG:4});
  rows.push({role:'beverage',quantity:1,step:1,recipeKcal:50,proteinG:0});
  const result=suggestPlatePortions(rows,600,custom),[main,starch,veg,dessert,drink]=result.proposals;
  assert.ok(main.quantity<=120);assert.ok(veg.quantity<=200);
  assert.ok(Math.abs(main.quantity/starch.quantity-1.5)<1e-9);
  assert.ok(Math.abs(veg.quantity/starch.quantity-2.5)<1e-9);
  assert.equal(dessert.quantity,1);assert.equal(drink.quantity,1);
  assert.ok(result.estimatedKcal<=600);
});
test('whole dishes remain one quantity; missing parts, duplicate parts and unknown energy never create a false split',()=>{
  const single=plate()[0];single.plateParts=['main'];single.budgetFraction=1;
  assert.equal(suggestPlatePortions([single],600).proposals.length,1);
  for(const rows of [plate().slice(0,2),[plate()[0],plate()[0]],plate().map(row=>({...row,recipeKcal:NaN}))]) {
    const result=suggestPlatePortions(rows,600);
    assert.equal(result.proportionsApplied,false);assert.ok(result.warnings.length);
  }
});
test('a tiny remaining budget or binding weight cap leaves manual quantities instead of inventing zero portions',()=>{
  for(const [rows,budget] of [[plate(),1],[plate().map(row=>({...row,maxQuantity:0})),600]]) {
    const result=suggestPlatePortions(rows,budget);
    assert.ok(result.proposals.every(row=>row.quantity===null));assert.ok(result.warnings.length);
    assert.equal(result.estimatedKcal,0);assert.equal(result.proteinTargetMet,false);
  }
});
test('daily rebalance reduces linked plates proportionally and keeps the protein floor',()=>{
  const rows=plate().map((row,i)=>({...row,itemId:String(i),mealId:'meal',personId:'adult',slot:'lunch',unitId:'g',quantity:[200,200,400][i],energyKcal:row.recipeKcal,complete:true}));
  const result=rebalanceDailyEnergy(rows,[{id:'adult',targetKcal:600}]);
  assert.equal(result.changes.length,3);
  const after=rows.map(row=>result.changes.find(change=>change.itemId===row.itemId)?.after??row.quantity);
  assert.ok(Math.abs(after[0]-after[1])<1e-5);assert.ok(Math.abs(after[2]-2*after[0])<1e-5);
  assert.ok(after.reduce((sum,q,i)=>sum+q*rows[i].proteinG,0)>=40-1e-6);
});
async function request(pool,method,body,password,url='/api/plate-settings?householdId='+h) {
  const response={setHeader(){},writeHead(status){this.status=status;},end(body){this.body=JSON.parse(body);}};
  await handleRequest({method,url,headers:{},async *[Symbol.asyncIterator](){if(body)yield Buffer.from(JSON.stringify(body));}},response,pool,password);
  return response;
}
test('plate settings require authentication',async()=>{
  const pool={query(){throw new Error('database should not be reached');}};
  for(const method of ['GET','PUT'])assert.equal((await request(pool,method,{householdId:h,ratios:custom},'password')).status,401);
});
test('plate settings migrate, persist per household, reject invalid totals, and preserve daily calorie settings',async()=>{
  const db=new PGlite();
  try {
    const dir=new URL('../db/migrations/',import.meta.url);
    for(const file of (await readdir(dir)).filter(file=>file.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,dir),'utf8'));
    const pool={async query(sql,args=[]){const result=await db.query(sql,args);return {...result,rowCount:result.rows.length||result.affectedRows||0};}};
    await pool.query("INSERT INTO households(id,name) VALUES($1,'A'),($2,'B')",[h,other]);
    const before=(await pool.query('SELECT meal_ratios FROM households WHERE id=$1',[h])).rows[0];
    assert.deepEqual((await request(pool,'GET')).body.ratios,DEFAULT_PLATE_RATIOS);
    assert.equal((await request(pool,'PUT',{householdId:h,ratios:{...custom,separate:{main:0.7,starch:0.4}}})).status,400);
    assert.equal((await request(pool,'PUT',{householdId:h,ratios:custom})).status,200);
    assert.deepEqual((await request(pool,'GET')).body.ratios,custom);
    assert.deepEqual((await request(pool,'GET',null,null,'/api/plate-settings?householdId='+other)).body.ratios,DEFAULT_PLATE_RATIOS);
    assert.equal((await request(pool,'GET',null,null,'/api/plate-settings?householdId=cccccccc-cccc-4ccc-8ccc-cccccccccccc')).status,404);
    assert.deepEqual((await pool.query('SELECT meal_ratios FROM households WHERE id=$1',[h])).rows[0],before);
  }finally{await db.close();}
});
