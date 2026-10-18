import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {runInNewContext} from 'node:vm';
import {createRecipe,readRecipe,validateRecipeInput} from '../src/server/recipes.mjs';
import {savePlannedMeal,listPlannedMeals} from '../src/server/planning.mjs';
import {rawShoppingRequirements} from '../src/server/shopping-requirements.mjs';
import {listPreparationsToMake} from '../src/server/household-planning.mjs';
import {recipePlanningLabel} from '../web/recipe-directory.js';
import {suggestPlatePortions} from '../web/portion-planner.js';
import {rebalanceDailyEnergy} from '../src/server/daily-rebalance.mjs';
import * as units from '../web/serving-quantities.js';
import {handleRequest} from '../src/server/app.mjs';

test('the browser can load the shared serving conversion module with JavaScript content type',async()=>{
  const response={status:200,headers:{},setHeader(k,v){this.headers[k]=v;},writeHead(code){this.status=code;},end(body){this.body=String(body);}};
  await handleRequest({method:'GET',url:'/serving-quantities.js',headers:{}},response,{});
  assert.equal(response.status,200);assert.match(response.headers['Content-Type'],/^text\/javascript/);
  assert.match(response.body,/export function servingInputValue/);
});

test('split eggs, soup and homemade bread expose pieces/grams/slices while menus and shopping retain exact grams',async t=>{
  const db=new PGlite();t.after(()=>db.close());
  const dir=new URL('../db/migrations/',import.meta.url);
  for(const file of (await readdir(dir)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,dir),'utf8'));
  const pool={async query(sql,args=[]){const r=await db.query(sql,args);return {...r,rowCount:r.rows.length||r.affectedRows||0};},async connect(){return {...this,release(){}};}};
  const householdId=randomUUID(),personId=randomUUID(),eggs=randomUUID(),flour=randomUUID(),veg=randomUUID();
  await pool.query("INSERT INTO households(id,name) VALUES($1,'Synthetic mixed units')",[householdId]);
  await pool.query("INSERT INTO people(id,household_id,display_name) VALUES($1,$2,'Test')",[personId,householdId]);
  for(const [foodId,name] of [[eggs,'Synthetic egg'],[flour,'Synthetic flour'],[veg,'Synthetic vegetables']]){
    await pool.query("INSERT INTO foods(id,canonical_name,source) VALUES($1,$2,'manual')",[foodId,name]);
    for(const [key,value] of Object.entries({energy_kcal:100,protein_g:10,carbohydrate_g:10,fat_g:1,fibre_g:1}))await pool.query('INSERT INTO food_nutrients(food_id,nutrient_id,value_per_100g) VALUES($1,$2,$3)',[foodId,key,value]);
  }
  await pool.query("INSERT INTO food_unit_conversions(food_id,unit_id,grams_per_unit,source_note) VALUES($1,'piece',50,'Synthetic fixture')",[eggs]);
  const create=async input=>{const checked=validateRecipeInput({householdId,name:'Synthetic recipe',yield:{amount:4,unitId:'portion'},...input});assert.equal(checked.error,undefined);const r=await createRecipe(pool,checked.data);assert.equal(r.error,undefined);return r;};
  const bread=await create({yield:{amount:20,unitId:'slice'},productionType:'bread',lines:[{foodId:flour,quantity:1000,unitId:'g'}]});
  const input={separateStarch:true,servingMode:'three',productionType:'batch_cooking',lines:[
    {foodId:eggs,quantity:8,unitId:'piece',servingPart:'main'},
    {foodId:veg,quantity:1300,unitId:'g',servingPart:'vegetables'},
    {recipeId:bread.id,quantity:8,unitId:'slice',servingPart:'starch'}]};
  const recipe=await create(input),main=recipe.servingParts.find(r=>r.servingPart==='main'),soup=recipe.servingParts.find(r=>r.servingPart==='vegetables'),toast=recipe.servingParts.find(r=>r.servingPart==='starch');
  assert.equal(main.yield.unitId,'g');assert.equal(main.servingDisplay.unitId,'piece');assert.equal(main.servingDisplay.gramsPerUnit,50);
  assert.equal(toast.servingDisplay.unitId,'slice');assert.equal(toast.servingDisplay.gramsPerUnit,50);
  assert.equal(soup.servingDisplay,null);
  assert.equal((await readRecipe(pool,main.id)).servingDisplay.unitId,'piece','direct reads and parent reads agree');
  assert.match(recipePlanningLabel(main),/50 kcal\/pièce.*8 pièces/);assert.match(recipePlanningLabel(toast),/50 kcal\/tranche.*8 tranches/);
  const quantity=units.canonicalServingQuantity(main,2),breadQuantity=units.canonicalServingQuantity(toast,2);
  const meal=await savePlannedMeal(pool,null,{householdId,mealDate:'2026-10-20',slot:'dinner',notes:'',attendeeIds:[personId],items:[
    {recipeId:main.id,role:'main',amounts:[{personId,quantity}]},
    {recipeId:soup.id,role:'accompaniment',amounts:[{personId,quantity:350}]},
    {recipeId:toast.id,role:'accompaniment',amounts:[{personId,quantity:breadQuantity}]}]});
  assert.equal(meal.items[0].amounts[0].quantity,100);assert.equal(meal.items[2].amounts[0].quantity,100);
  const [saved]=await listPlannedMeals(pool,householdId,'2026-10-19');
  assert.equal(units.displayServingQuantity(saved.items[0].recipe,saved.items[0].amounts[0].quantity),2);
  const shopping=await rawShoppingRequirements(pool,householdId,'2026-10-19','2026-10-25');
  assert.equal(shopping.find(r=>r.foodId===eggs).quantity,2);assert.equal(shopping.find(r=>r.foodId===flour).quantity,100);assert.equal(shopping.find(r=>r.foodId===veg).quantity,350);
  assert.equal((await listPreparationsToMake(pool,householdId,'2026-10-19','2026-10-25')).find(r=>r.recipeId===bread.id).toMakeQuantity,2);
  const mixed=await create({...input,lines:[...input.lines,{foodId:veg,quantity:50,unitId:'g',servingPart:'main'}]});
  assert.equal(mixed.servingParts.find(r=>r.servingPart==='main').servingDisplay,null,'a mixed preparation is not guessed to be an egg');
  const cake=await create({separateStarch:true,servingMode:'whole',lines:[{foodId:eggs,quantity:8,unitId:'piece'}]});
  assert.equal(cake.servingParts[0].servingDisplay,null,'a whole preparation keeps its gram serving mode');
});

test('editing a displayed count preserves an untouched fractional menu exactly and converts an explicit change once',()=>{
  const recipe={yield:{unitId:'g'},servingDisplay:{unitId:'piece',gramsPerUnit:50}};
  const input={dataset:{},value:''};units.setServingInput(input,recipe,'82.62713');
  assert.equal(input.value,'1.652543');assert.equal(units.servingInputValue(input),'82.62713');assert.equal(input.step,'any');
  input.value='2';assert.equal(units.servingInputValue(input),'100');
  input.value='';assert.equal(units.servingInputValue(input),'');
  const plain={dataset:{},value:'462.85712'};units.setServingInput(plain,{yield:{unitId:'g'}},plain.value);assert.equal(units.servingInputValue(plain),'462.85712');
  assert.equal(units.servingUnit({yield:{unitId:'g'},servingDisplay:{unitId:'slice',gramsPerUnit:1}}),'slice');
  assert.equal(units.servingScale({yield:{unitId:'g'},servingDisplay:{unitId:'piece',gramsPerUnit:0}}),1);
});

test('explicit automatic proposals use whole eggs and slices, keep soup grams and report their actual nutrition',()=>{
  const proposals=['main','vegetables','starch'].map((part,i)=>({parentRecipeId:'parent',plateParts:['main','vegetables','starch'],servingPart:part,recipeUnit:'g',
    role:i?'accompaniment':'main',quantity:100,step:10,recipeKcal:[1.5,0.3,2][i],proteinG:[0.12,0.01,0.08][i],budgetFraction:i?0.15:0.7,
    ...(part==='vegetables'?{}:{countStep:50})}));
  const result=suggestPlatePortions(proposals,700);
  assert.equal(result.proposals[0].quantity%50,0);assert.equal(result.proposals[2].quantity%50,0);
  assert.ok(result.proposals[1].quantity>0);assert.equal(result.withinBudget,true);
  assert.equal(result.estimatedKcal,result.proposals.reduce((sum,r)=>sum+(r.quantity??0)*r.recipeKcal,0));
  assert.equal(result.estimatedProteinG,result.proposals.reduce((sum,r)=>sum+(r.quantity??0)*r.proteinG,0));
  assert.equal(proposals[0].quantity,100);
});

test('daily rebalancing reduces counted services in whole units without creating fractional eggs or bread',()=>{
  const common={mealId:'meal',personId:'adult',slot:'dinner',unitId:'g',complete:true,parentRecipeId:'parent',plateParts:['main','vegetables','starch'],proteinG:0.1};
  const rows=[{...common,itemId:'eggs',role:'main',servingPart:'main',quantity:200,energyKcal:2,countStep:50,displayUnitId:'piece'},
    {...common,itemId:'bread',role:'accompaniment',servingPart:'starch',quantity:200,energyKcal:2,countStep:50,displayUnitId:'slice'},
    {...common,itemId:'soup',role:'accompaniment',servingPart:'vegetables',quantity:400,energyKcal:0.2}];
  const result=rebalanceDailyEnergy(rows,[{id:'adult',targetKcal:720}]);
  for(const change of result.changes.filter(c=>c.itemId!=='soup')){assert.equal(change.after%50,0);assert.equal(change.displayScale,50);}
  assert.ok(result.changes.some(c=>c.itemId!=='soup'));assert.ok(result.results[0].afterKcal<=720);
});

test('dashboard/print presentation uses counts while nutrition still uses canonical grams',async()=>{
  const source=await readFile(new URL('../web/app.js',import.meta.url),'utf8'),a=source.indexOf('function mealNutritionForPerson('),b=source.indexOf('async function refreshDashboard(',a);
  const context={...units};runInNewContext(source.slice(a,b)+'\nglobalThis.calculate=mealNutritionForPerson;',context);
  const meal={items:[{recipe:{name:'Synthetic egg service',yield:{unitId:'g'},servingDisplay:{unitId:'piece',gramsPerUnit:50},nutrition:{complete:true,perYieldUnit:{energyKcal:2,proteinG:0.1}}},amounts:[{personId:'p',quantity:100}]}]};
  const result=context.calculate(meal,'p');assert.equal(result.items[0].quantity,2);assert.equal(result.items[0].unit,'pièce');assert.equal(result.kcal,200);assert.equal(result.protein,10);
});

test('the meal editor collects displayed counts as canonical quantities without a second conversion',async()=>{
  const source=await readFile(new URL('../web/app.js',import.meta.url),'utf8'),a=source.indexOf('function currentFormAmounts('),b=source.indexOf('function renderOccasionEnergy(',a);
  const row={},root={},input={dataset:{personId:'p'},value:''};
  const recipe={yield:{unitId:'g'},servingDisplay:{unitId:'slice',gramsPerUnit:44.75}};
  units.setServingInput(input,recipe,'84.51575');
  const context={...units,isIndividualRole:()=>false,
    $(selector){return selector==='#planned-items'?root:selector==='select[name="role"]'?{value:'accompaniment'}:{value:'bread-service'};},
    $$(selector){return selector==='.planned-item-editor'?[row]:selector==='input[data-person-id]'?[input]:[];}};
  runInNewContext(source.slice(a,b)+'\nglobalThis.collect=currentFormAmounts;',context);
  assert.equal(context.collect()[0].amounts.p,'84.51575');
  input.value='2';assert.equal(context.collect()[0].amounts.p,'89.5');
  const next={dataset:{personId:'p'},value:''};units.setServingInput(next,recipe,context.collect()[0].amounts.p);
  assert.equal(next.value,'2');assert.equal(units.servingInputValue(next),'89.5');
});
