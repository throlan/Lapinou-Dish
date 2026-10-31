import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {roundServingCalories,compensateServingCalories,compensateManualServing} from '../web/serving-compensation.js';
import {suggestPlatePortions} from '../web/portion-planner.js';
import * as planner from '../web/portion-planner.js';
import * as units from '../web/serving-quantities.js';

const parts=['main','starch','vegetables'];
const rows=()=>parts.map((part,i)=>({parentRecipeId:'plate',plateParts:parts,servingPart:part,recipeUnit:'g',role:i?'accompaniment':'main',
  countStep:[50,35,null][i],quantity:[84,86,480][i],recipeKcal:[1.4,2.6,0.285][i],proteinG:[0.12,0.08,0.01][i]}));
const kcal=entries=>entries.reduce((sum,row)=>sum+row.quantity*row.recipeKcal,0);
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-4,`${a} versus ${b}`);
const recipes=()=>[{id:'plate',servingParts:parts.map(servingPart=>({servingPart}))},...rows().map((row,i)=>({id:row.servingPart,parentRecipeId:'plate',servingPart:row.servingPart,yield:{unitId:'g'},
  servingDisplay:row.countStep?{unitId:i?'slice':'piece',gramsPerUnit:row.countStep}:null,nutrition:{perYieldUnit:{energyKcal:row.recipeKcal}}}))];

test('84 g eggs and 86 g bread become two 50 g eggs and two 35 g slices, with calorie rather than weight compensation',()=>{
  const initial=rows(),result=roundServingCalories(initial);
  assert.deepEqual(result.proposals.slice(0,2).map(r=>r.quantity),[100,70]);
  near(result.proposals[2].quantity,480-(16*1.4-16*2.6)/0.285);
  near(kcal(result.proposals),kcal(initial));assert.equal(initial[2].quantity,480);
  assert.notEqual(result.proposals[2].quantity,480,'equal gram changes still have different calories');
});

test('rounding is nearest, and both upward/downward calorie deltas change the soup in the opposite direction',()=>{
  const initial=rows();initial[1].quantity=70;
  const up=roundServingCalories(initial).proposals;assert.ok(up[2].quantity<480);near(kcal(up),kcal(initial));
  initial[0].quantity=60;const down=roundServingCalories(initial).proposals;
  assert.equal(down[0].quantity,50);assert.ok(down[2].quantity>480);near(kcal(down),kcal(initial));
});

test('the original gram plan still follows custom Administration ratios before post-processing and retains its calories afterward',()=>{
  const ratios={whole:{main:1},separate:{main:0.66,starch:0.34},three:{main:0.2,starch:0.3,vegetables:0.5}};
  const proposals=rows().map((row,i)=>({...row,step:10,maxQuantity:Infinity,budgetFraction:i?0.15:0.7}));
  const initial=suggestPlatePortions(proposals,700,ratios),total=initial.proposals.reduce((sum,r)=>sum+r.quantity,0);
  near(initial.proposals[0].quantity/total,0.2);near(initial.proposals[1].quantity/total,0.3);near(initial.proposals[2].quantity/total,0.5);
  const rounded=roundServingCalories(initial.proposals);near(kcal(rounded.proposals),kcal(initial.proposals));
  assert.equal(rounded.proposals[0].quantity%50,0);assert.equal(rounded.proposals[1].quantity%35,0);
});

test('all-gram plates and fixed desserts, sauces or drinks are unaffected by the post-processing',()=>{
  const grams=rows().map(row=>({...row,countStep:null}));assert.deepEqual(roundServingCalories(grams).proposals,grams);
  const fixed={role:'beverage',quantity:1,recipeKcal:80},initial=[...rows(),fixed];
  assert.deepEqual(roundServingCalories(initial).proposals[3],fixed);near(kcal(roundServingCalories(initial).proposals),kcal(initial));
});

test('missing data, duplicate services, no gram service and impossible compensation preserve the initial plan with an explanation',()=>{
  for(const initial of [rows().slice(0,2),[...rows(),rows()[0]],rows().map(row=>({...row,recipeKcal:null})),rows().map(row=>({...row,countStep:50})),rows().map((row,i)=>({...row,quantity:i===2?1:i===0?26:70}))]){
    const result=roundServingCalories(initial);assert.deepEqual(result.proposals,initial);assert.ok(result.warnings.length);
  }
  assert.equal(compensateServingCalories(rows(),[84,86,480],[100,700,480]).ok,false);
});

test('manual changes preserve the preceding calories for only the selected person and plate, including successive changes',()=>{
  const items=Object.fromEntries(rows().map((row,i)=>[i,{recipeId:row.servingPart,role:row.role,amounts:{a:String(row.quantity),b:'200'}}]));
  items[0].amounts.a='100';
  const first=compensateManualServing(items,recipes(),'main','a',84);assert.equal(first.ok,true);assert.equal(first.itemKey,'2');near(first.quantity,480-16*1.4/0.285);
  items[2].amounts.a=String(first.quantity);items[0].amounts.a='50';
  const second=compensateManualServing(items,recipes(),'main','a',100);near(second.quantity,first.quantity+50*1.4/0.285);
  assert.equal(items[2].amounts.b,'200');
});

test('two-part plates can compensate the free gram part without imposing new weight proportions',()=>{
  const initial=rows().slice(0,2);initial[0].countStep=null;initial.forEach(row=>row.plateParts=['main','starch']);
  const rounded=roundServingCalories(initial).proposals;assert.equal(rounded[1].quantity,70);near(kcal(rounded),kcal(initial));
});

test('the actual recalculation calls the original planner then calorie compensation for each profile',async()=>{
  const source=await readFile(new URL('../web/app.js',import.meta.url),'utf8');
  const start=source.indexOf('function applyAutomaticPortions('),end=source.indexOf('function mealProteinSummary(',start);
  const rs=recipes();rs[0].yield={amount:4,unitId:'portion'};
  rs.slice(1).forEach(r=>{r.yield.amount=10000;r.nutrition.perYieldUnit.proteinG=0.01;});
  const people=[{id:'a',displayName:'Adult A'},{id:'b',displayName:'Adult B'}];
  const root={replaceChildren(){}};
  const context={...planner,roundServingCalories,state:{recipes:rs,people,calendarMeals:[]},allPlanningRecipes:()=>rs,isIndividualRole:()=>false,isIndividualMealItem:()=>false,
    latestProfile:person=>({dailyEnergyKcal:person.id==='a'?1850:2500}),formatQty:String,
    document:{createElement:()=>({append(){}})},$:selector=>selector==='#planned-items'?root:{elements:{mealDate:{value:'2026-10-20'},slot:{value:'dinner'}}}};
  runInNewContext(source.slice(start,end)+'\nglobalThis.apply=applyAutomaticPortions;',context);
  const items=Object.fromEntries(rows().map((row,i)=>[i,{recipeId:row.servingPart,role:row.role,amounts:{}}]));
  context.apply(items,['a','b']);
  for(const person of people){assert.equal(Number(items[0].amounts[person.id])%50,0);assert.equal(Number(items[1].amounts[person.id])%35,0);assert.ok(Number(items[2].amounts[person.id])>0);}
  assert.notEqual(items[2].amounts.a,items[2].amounts.b,'the initial profile-specific proposal is not replaced by a common counted-weight plate');
});

test('the actual input handler compensates soup live on successive edits, and collection saves the adjusted canonical grams once',async()=>{
  const source=await readFile(new URL('../web/app.js',import.meta.url),'utf8');
  const start=source.indexOf('        let previousQuantity=servingInputValue(input);'),end=source.indexOf('        label.append(input);',start);
  const input={dataset:{personId:'a'},value:'',listeners:{},addEventListener(name,callback){this.listeners[name]=callback;}};
  units.setServingInput(input,recipes()[1],84);
  const soup={value:'480',dataset:{personId:'a'}},otherPerson={value:'200',dataset:{personId:'b'}},root={},targetRow={dataset:{itemKey:'2'}},message={};
  const collect=()=>Object.fromEntries(rows().map((row,i)=>[i,{recipeId:row.servingPart,role:row.role,amounts:{a:i===0?units.servingInputValue(input):i===2?soup.value:String(row.quantity),b:'200'}}]));
  let updates=0;
  const context={...units,compensateManualServing,input,recipe:recipes()[1],personId:'a',root,currentFormAmounts:collect,
    allPlanningRecipes:recipes,updateMealProteinSummary(){updates++;},$:()=>message,
    $$(selector){return selector==='.planned-item-editor'?[targetRow]:[soup,otherPerson];}};
  runInNewContext(source.slice(start,end),context);
  input.value='2';input.listeners.input();near(Number(soup.value),480-16*1.4/0.285);
  near(Number(collect()[0].amounts.a)*1.4+86*2.6+Number(collect()[2].amounts.a)*0.285,478);
  const previousSoup=soup.value;input.value='30';input.listeners.input();assert.equal(soup.value,previousSoup);assert.match(message.textContent,/ne laissent plus/);
  input.value='1';input.listeners.input();near(Number(soup.value),480+34*1.4/0.285);
  assert.equal(otherPerson.value,'200');assert.equal(updates,3);assert.match(message.textContent,/conserver les calories/);
});

test('the calorie compensation module is available over HTTP as JavaScript',async()=>{
  const {handleRequest}=await import('../src/server/app.mjs');
  const response={headers:{},setHeader(k,v){this.headers[k]=v;},writeHead(code){this.status=code;},end(body){this.body=String(body);}};
  await handleRequest({method:'GET',url:'/serving-compensation.js',headers:{}},response,{});
  assert.match(response.headers['Content-Type'],/^text\/javascript/);assert.match(response.body,/export function roundServingCalories/);
});

test('the real save path serializes two eggs as 100 g and two slices as 70 g, not as 2 g',async()=>{
  const source=await readFile(new URL('../web/app.js',import.meta.url),'utf8');
  const start=source.indexOf('  const items = isOccasion ? [] : rows.flatMap((row) => {');
  const end=source.indexOf('  if (!attendeeIds.length)',start);
  const inputs=[{},{}].map((_,i)=>({value:'',dataset:{personId:'a'}}));
  units.setServingInput(inputs[0],recipes()[1],100);units.setServingInput(inputs[1],recipes()[2],70);
  const context={...units,isOccasion:false,rows:[{index:0},{index:1}],isIndividualRole:()=>false,
    $(selector,row){return {value:selector==='select[name="role"]'?'main':row.index?'starch':'main'};},
    $$(selector,row){return [inputs[row.index]];}};
  runInNewContext(source.slice(start,end)+'\nglobalThis.saved=items;',context);
  assert.deepEqual(Array.from(context.saved,item=>item.amounts[0].quantity),[100,70]);
});

test('the save path keeps linked starch as a gram component of the same meal',async()=>{
  const source=await readFile(new URL('../web/app.js',import.meta.url),'utf8');
  const start=source.indexOf('  const items = isOccasion ? [] : rows.flatMap((row) => {');
  const end=source.indexOf('  if (!attendeeIds.length)',start);
  const inputs=[{value:'160',dataset:{personId:'a'}},{value:'180',dataset:{personId:'b'}}];
  const row={dataset:{linkedRecipeId:'rice',role:'accompaniment'}};
  const context={...units,isOccasion:false,rows:[row],mealAdditionById:()=>null,
    $(selector){return {value:selector==='select[name="role"]'?'accompaniment':'rice'};},
    $$:()=>inputs};
  runInNewContext(source.slice(start,end)+'\nglobalThis.saved=items;',context);
  assert.equal(context.saved[0].recipeId,'rice');
  assert.equal(context.saved[0].role,'accompaniment');
  assert.equal(context.saved[0].categoryId,'accompaniment');
  assert.deepEqual(Array.from(context.saved[0].amounts,amount=>amount.quantity),[160,180]);
});
