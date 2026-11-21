import {servedGramsPerUnit} from '../web/main-dish-cap.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import * as planner from '../web/portion-planner.js';
import {roundServingCalories} from '../web/serving-compensation.js';

const source = await readFile(new URL('../web/app.js', import.meta.url), 'utf8');
const start = source.indexOf('function applyAutomaticPortions(');
const end = source.indexOf('function mealProteinSummary(', start);
const individualStart=source.indexOf('function isIndividualRole(');
const individualEnd=source.indexOf('function individualDefaultQuantity(',individualStart);
function addIndividualMealItemRule(context){runInNewContext(source.slice(individualStart,individualEnd),context);}

test('recalculation proposes one breakfast piece for all profiles, including a counted gram equivalent',()=>{
  const parent={id:'parent',yield:{amount:4,unitId:'piece'},servingParts:[{servingPart:'main'}]};
  const mousse={id:'whole',yield:{amount:4,unitId:'piece'},nutrition:{perYieldUnit:{energyKcal:255.2,proteinG:3.7}}};
  const counted={id:'counted',parentRecipeId:parent.id,servingPart:'main',yield:{amount:475,unitId:'g'},
    nutrition:{perYieldUnit:{energyKcal:255.2/118.75,proteinG:3.7/118.75}}};
  const recipes=[parent,mousse,counted],people=[{id:'a',energy:1000},{id:'b',energy:3200}];
  const context={...planner,servedGramsPerUnit,roundServingCalories,format:String,state:{recipes,people},
    allPlanningRecipes:()=>recipes,latestProfile:person=>({dailyEnergyKcal:person.energy})};
  addIndividualMealItemRule(context);
  runInNewContext(source.slice(start,end)+'\nglobalThis.calculate=applyAutomaticPortions;',context);
  for(const [recipe,quantity] of [[mousse,'1'],[counted,'118.75']]){
    const items=[{recipeId:recipe.id,role:'main'}];
    context.calculate(items,['a','b'],{date:'2026-11-21',slot:'breakfast',quiet:true});
    assert.equal(items[0].amounts.a,quantity);assert.equal(items[0].amounts.b,quantity);
    context.calculate(items,['a','b'],{date:'2026-11-21',slot:'breakfast',energyBudget:900,quiet:true});
    assert.equal(items[0].amounts.a,quantity);assert.equal(items[0].amounts.b,quantity);
  }
});

test('automatic snack portions stay within the configured share with pieces, grams and a drink',()=>{
  const biscuit={id:'biscuit',yield:{amount:24,unitId:'piece'},nutrition:{perYieldUnit:{energyKcal:42,proteinG:3}}};
  const heavy={id:'heavy',yield:{amount:4,unitId:'piece'},nutrition:{perYieldUnit:{energyKcal:210,proteinG:5}}};
  const skyr={id:'skyr',yield:{amount:500,unitId:'g'},nutrition:{perYieldUnit:{energyKcal:1.05,proteinG:.07}}};
  const drink={id:'drink',yield:{amount:1,unitId:'piece'},nutrition:{perYieldUnit:{energyKcal:30,proteinG:0}}};
  const recipes=[biscuit,heavy,skyr,drink],people=[{id:'a',energy:1300},{id:'b',energy:2300}];
  const context={...planner,servedGramsPerUnit,roundServingCalories,format:String,
    state:{recipes,people,mealRatios:{breakfast:.15,lunch:.45,snack:.1,dinner:.3,evening_snack:0}},
    allPlanningRecipes:()=>recipes,latestProfile:person=>({dailyEnergyKcal:person.energy})};
  addIndividualMealItemRule(context);
  runInNewContext(source.slice(start,end)+'\nglobalThis.calculate=applyAutomaticPortions;',context);
  const options={date:'2026-11-21',slot:'snack',energyBudget:900,quiet:true};
  const item={recipeId:biscuit.id,role:'main',amounts:{a:'12',b:'21'}};
  context.calculate([item],['a','b'],options);
  assert.deepEqual(item.amounts,{a:'3',b:'5'});
  const grams={recipeId:skyr.id,role:'main'};
  context.calculate([grams],['a'],options);
  assert.equal(grams.amounts.a,'120');
  const large={recipeId:heavy.id,role:'main'};
  context.calculate([large],['a','b'],options);
  assert.equal(large.amounts.a,'0');
  assert.equal(large.amounts.b,'1');
  const beverage={role:'beverage',assignments:{a:{recipeId:drink.id,quantity:'1'}}};
  context.calculate([item,beverage],['a'],options);
  assert.ok(Number(item.amounts.a)*42+Number(beverage.assignments.a.quantity)*30<=130);
});

test('automatic servings cap raw meat inside the mixed part for all four profiles', () => {
  const parent = { id: 'parent', yield: { amount: 4, unitId: 'portion' }, servingParts:[{servingPart:'main'},{servingPart:'starch'}] };
  const main = { id: 'main', parentRecipeId: parent.id, servingPart: 'main', servingLoad:{meat:.5}, yield: { amount: 1660, unitId: 'g' }, nutrition: { perYieldUnit: { energyKcal: 1.3, proteinG: 0.075 } } };
  const rice = { id: 'rice', parentRecipeId: parent.id, servingPart: 'starch', yield: { amount: 750, unitId: 'g' }, nutrition: { perYieldUnit: { energyKcal: 1.2, proteinG: 0.02 } } };
  const people = [1600, 3200, 2200, 2600].map((energy, i) => ({ id: String(i), displayName: String(i), energy }));
  const items = { 0: { recipeId: main.id, role: 'main' }, 1: { recipeId: rice.id, role: 'accompaniment' } };
  const root = { replaceChildren() {} };
  const context = { ...planner,servedGramsPerUnit,roundServingCalories, state: { recipes: [parent], people, calendarMeals: [] },
    $: selector => selector === '#meal-form' ? { elements: { mealDate: { value: '2026-10-19' }, slot: { value: 'lunch' } } } : root,
    allPlanningRecipes: () => [parent, main, rice], isIndividualRole: () => false,
    latestProfile: person => ({ dailyEnergyKcal: person.energy }), plannedCaloriesForPerson: () => 0,
    document: { createElement: () => ({ append() {} }) } };
  addIndividualMealItemRule(context);
  runInNewContext(source.slice(start, end) + '\nglobalThis.calculate = applyAutomaticPortions;', context);
  context.calculate(items, people.map(person => person.id));
  for (const person of people) {
    assert.ok(Number(items[0].amounts[person.id]) > 0);
    assert.equal(Number(items[0].amounts[person.id]),250);
    assert.ok(Number(items[1].amounts[person.id]) > 0);
    assert.ok(Number(items[1].amounts[person.id]) <= 200);
  }
});

test('linked rice uses the configured plate proportion instead of a one-gram accompaniment default',()=>{
  const parent={id:'parent',yield:{amount:4,unitId:'portion'},servingParts:[{servingPart:'main'},{servingPart:'starch'}]};
  const main={id:'main',parentRecipeId:'parent',servingPart:'main',yield:{amount:1900,unitId:'g'},nutrition:{perYieldUnit:{energyKcal:0.58,proteinG:0.08}}};
  const rice={id:'rice',parentRecipeId:'parent',servingPart:'starch',yield:{amount:360,unitId:'g'},nutrition:{perYieldUnit:{energyKcal:1.3,proteinG:0.03}}};
  const people=[{id:'bibinette',displayName:'Bibinette'}];
  const items={0:{recipeId:'main',role:'main',amounts:{}},1:{recipeId:'rice',role:'accompaniment',categoryId:'accompaniment',amounts:{}}};
  const root={replaceChildren(){}};
  const context={...planner,servedGramsPerUnit,roundServingCalories,format:String,state:{recipes:[parent],people,calendarMeals:[],plateRatios:{whole:{main:1},separate:{main:0.66,starch:0.34},three:{main:0.25,starch:0.25,vegetables:0.5}}},
    $:selector=>selector==='#meal-form'?{elements:{mealDate:{value:'2026-10-31'},slot:{value:'dinner'}}}:root,
    allPlanningRecipes:()=>[parent,main,rice],latestProfile:()=>({dailyEnergyKcal:1000}),plannedCaloriesForPerson:()=>0,
    document:{createElement:()=>({append(){}})}};
  addIndividualMealItemRule(context);
  runInNewContext(source.slice(start,end)+'\nglobalThis.calculate=applyAutomaticPortions;',context);
  context.calculate(items,['bibinette']);
  const mainGrams=Number(items[0].amounts.bibinette),riceGrams=Number(items[1].amounts.bibinette);
  assert.ok(riceGrams>1,`rice should be a real plate part, received ${riceGrams} g`);
  assert.equal(riceGrams%10,0);
  assert.ok(Math.abs(mainGrams/(mainGrams+riceGrams)-0.66)<0.04);
  assert.ok(mainGrams*0.58+riceGrams*1.3<=1000*planner.SLOT_RATIOS.dinner+20);
});

test('a split dinner uses its 390 kcal target even when only 233.2 kcal remain for the day',()=>{
  const parts=['main','starch','vegetables'];
  const recipes=parts.map((servingPart,index)=>({
    id:servingPart,parentRecipeId:'plate',servingPart,yield:{unitId:'g'},
    servingLoad:[{meat:1},{starch:1},{vegetables:1}][index],
    nutrition:{perYieldUnit:{energyKcal:[1.3,1.46,.5][index],proteinG:.01}},
  }));
  const parent={id:'plate',servingParts:recipes};
  const date='2026-11-08',person={id:'bibinette',displayName:'Bibinette'};
  const items=Object.fromEntries(recipes.map((recipe,i)=>[recipe.id,{recipeId:recipe.id,role:i?'accompaniment':'main'}]));
  let notice;
  const context={...planner,servedGramsPerUnit,format:String,state:{recipes:[parent],people:[person],mealRatios:{dinner:.30},calendarMeals:[{id:'earlier',mealDate:date}]},
    $:selector=>selector==='#meal-form'?{elements:{mealDate:{value:date},slot:{value:'dinner'}}}:{replaceChildren(element){notice=element;}},
    allPlanningRecipes:()=>[parent,...recipes],latestProfile:()=>({dailyEnergyKcal:1300}),plannedCaloriesForPerson:()=>1066.8,
    document:{createElement:()=>({append(...children){this.children=children;}})}};
  addIndividualMealItemRule(context);
  runInNewContext(source.slice(start,end)+'\nglobalThis.calculate=applyAutomaticPortions;',context);
  context.calculate(items,[person.id]);
  assert.deepEqual(parts.map(part=>Number(items[part].amounts.bibinette)),[125,100,200]);
  assert.match(notice.children[1].textContent,/dépassement de \d+(?:\.\d+)? kcal/);
});

test('protein adjustment cannot bypass the main serving ceiling; piece recipes keep their own portions', () => {
  const parent = { yield: { amount: 4, unitId: 'portion' } };
  const child = { servingPart: 'main', yield: { amount: 1660, unitId: 'g' } };
  const limit = planner.mainServingLimit(child, parent);
  const result = planner.rebalanceNaturalPortions([{ role: 'main', quantity: limit, step: 10, recipeKcal: 1, proteinG: 0.01, maxQuantity: limit }], 2000);
  assert.equal(result.proposals[0].quantity, 410);
  assert.equal(result.proteinTargetMet, false);
  assert.equal(planner.mainServingLimit(child, { yield: { amount: 24, unitId: 'piece' } }), Infinity);
  assert.equal(planner.mainServingLimit({ ...child, servingPart: 'starch' }, parent), Infinity);
});

test('automatic salad servings are capped to one portion per person', () => {
  const salad = { id:'greens',recipeType:'salad',yield:{amount:50,unitId:'portion'},nutrition:{complete:true,perYieldUnit:{energyKcal:5,proteinG:0.1}} };
  const people = [{id:'a',displayName:'A'},{id:'b',displayName:'B'}];
  const items = { 0:{recipeId:salad.id,role:'accompaniment'} };
  const root = { replaceChildren(){} };
  const context = { ...planner,servedGramsPerUnit,roundServingCalories,state:{recipes:[salad],people,calendarMeals:[]},
    $:selector=>selector==='#meal-form'?{elements:{mealDate:{value:'2026-10-19'},slot:{value:'lunch'}}}:root,
    allPlanningRecipes:()=>[salad],isIndividualRole:()=>false,isIndividualMealItem:()=>false,latestProfile:()=>({dailyEnergyKcal:3000}),
    plannedCaloriesForPerson:()=>0,document:{createElement:()=>({append(){}})} };
  runInNewContext(source.slice(start,end)+'\nglobalThis.calculate=applyAutomaticPortions;',context);
  context.calculate(items,people.map(person=>person.id));
  assert.equal(items[0].amounts.a,'1');
  assert.equal(items[0].amounts.b,'1');
  assert.equal(planner.saladServingLimit(salad),1);
  assert.equal(planner.saladServingLimit({...salad,yield:{amount:250,unitId:'g'}}),Infinity);
  assert.equal(planner.saladServingLimit({...salad,parentRecipeId:'parent'}),Infinity);
});

test('sauce calories fit within the meal budget without increasing a fixed sauce quantity to chase protein',()=>{
  const salad={id:'salad',recipeType:'salad',yield:{amount:4,unitId:'portion'},nutrition:{perYieldUnit:{energyKcal:400,proteinG:30}}};
  const sauce={id:'sauce',recipeType:'sauce',yield:{amount:200,unitId:'g'},nutrition:{perYieldUnit:{energyKcal:5,proteinG:0.01}}};
  const people=[{id:'a',displayName:'A'},{id:'b',displayName:'B'},{id:'c',displayName:'C'}];
  const items={0:{recipeId:'salad',role:'main'},1:{recipeId:'',role:'sauce',categoryId:'sauce',assignments:{a:{recipeId:'sauce',quantity:'40'},b:{recipeId:'sauce',quantity:'0'}}}};
  const root={replaceChildren(){}};
  const context={...planner,servedGramsPerUnit,roundServingCalories,state:{recipes:[salad,sauce],people,calendarMeals:[]},
    $:selector=>selector==='#meal-form'?{elements:{mealDate:{value:'2026-10-19'},slot:{value:'lunch'}}}:root,
    allPlanningRecipes:()=>[salad,sauce],isIndividualRole:role=>role!=='main',latestProfile:()=>({dailyEnergyKcal:1500}),
    plannedCaloriesForPerson:()=>0,document:{createElement:()=>({append(){}})}};
  const helper=source.slice(source.indexOf('function sauceDefaultQuantity('),source.indexOf('function plannedItemRoleOptions('));
  addIndividualMealItemRule(context);
  runInNewContext(helper+source.slice(start,end)+'\nglobalThis.calculate=applyAutomaticPortions;',context);
  context.calculate(items,people.map(p=>p.id));
  assert.equal(items[1].assignments.a.quantity,'40');
  assert.equal(items[1].assignments.b.quantity,'0');
  assert.equal(items[1].assignments.c,undefined);
  for(const person of people){
    const sauceQuantity=Number(items[1].assignments[person.id]?.quantity??0);
    const total=Number(items[0].amounts?.[person.id]??1)*400+sauceQuantity*5;
    assert.ok(total<=700,`${person.id}: ${total} kcal exceeds the slot envelope`);
  }
});
