import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import * as planner from '../web/portion-planner.js';
import {roundServingCalories} from '../web/serving-compensation.js';

const source = await readFile(new URL('../web/app.js', import.meta.url), 'utf8');
const start = source.indexOf('function applyAutomaticPortions(');
const end = source.indexOf('function mealProteinSummary(', start);

test('automatic meat and vegetable servings stay within one batch portion for all four profiles', () => {
  const parent = { id: 'parent', yield: { amount: 4, unitId: 'portion' } };
  const main = { id: 'main', parentRecipeId: parent.id, servingPart: 'main', yield: { amount: 1660, unitId: 'g' }, nutrition: { perYieldUnit: { energyKcal: 1.3, proteinG: 0.075 } } };
  const rice = { id: 'rice', parentRecipeId: parent.id, servingPart: 'starch', yield: { amount: 750, unitId: 'g' }, nutrition: { perYieldUnit: { energyKcal: 1.2, proteinG: 0.02 } } };
  const people = [1600, 3200, 2200, 2600].map((energy, i) => ({ id: String(i), displayName: String(i), energy }));
  const items = { 0: { recipeId: main.id, role: 'main' }, 1: { recipeId: rice.id, role: 'accompaniment' } };
  const root = { replaceChildren() {} };
  const context = { ...planner,roundServingCalories, state: { recipes: [parent], people, calendarMeals: [] },
    $: selector => selector === '#meal-form' ? { elements: { mealDate: { value: '2026-10-19' }, slot: { value: 'lunch' } } } : root,
    allPlanningRecipes: () => [parent, main, rice], isIndividualRole: () => false,
    latestProfile: person => ({ dailyEnergyKcal: person.energy }), plannedCaloriesForPerson: () => 0,
    document: { createElement: () => ({ append() {} }) } };
  runInNewContext(source.slice(start, end) + '\nglobalThis.calculate = applyAutomaticPortions;', context);
  context.calculate(items, people.map(person => person.id));
  for (const person of people) {
    assert.ok(Number(items[0].amounts[person.id]) > 0);
    assert.ok(Number(items[0].amounts[person.id]) <= 410);
    assert.ok(Number(items[1].amounts[person.id]) > 0);
  }
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
  const context = { ...planner,roundServingCalories,state:{recipes:[salad],people,calendarMeals:[]},
    $:selector=>selector==='#meal-form'?{elements:{mealDate:{value:'2026-10-19'},slot:{value:'lunch'}}}:root,
    allPlanningRecipes:()=>[salad],isIndividualRole:()=>false,latestProfile:()=>({dailyEnergyKcal:3000}),
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
  const context={...planner,roundServingCalories,state:{recipes:[salad,sauce],people,calendarMeals:[]},
    $:selector=>selector==='#meal-form'?{elements:{mealDate:{value:'2026-10-19'},slot:{value:'lunch'}}}:root,
    allPlanningRecipes:()=>[salad,sauce],isIndividualRole:role=>role!=='main',latestProfile:()=>({dailyEnergyKcal:1500}),
    plannedCaloriesForPerson:()=>0,document:{createElement:()=>({append(){}})}};
  const helper=source.slice(source.indexOf('function sauceDefaultQuantity('),source.indexOf('function plannedItemRoleOptions('));
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
