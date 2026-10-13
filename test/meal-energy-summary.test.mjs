import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import * as planner from '../web/portion-planner.js';

test('energy total includes all dishes, drinks and desserts and flags missing nutrition',()=>{
  const meal={items:[{recipe:{nutrition:{perYieldUnit:{energyKcal:1.5}}},amounts:[{personId:'p',quantity:200}]},{recipe:{nutrition:{perYieldUnit:{energyKcal:120}}},amounts:[{personId:'p',quantity:1}]}]};
  assert.equal(planner.calculatePersonEnergy(meal,'p').kcal,420);
  meal.items[1].recipe.nutrition.perYieldUnit.energyKcal=null;
  assert.equal(planner.calculatePersonEnergy(meal,'p').known,false);
  assert.equal(planner.calculatePersonEnergy(meal,'other').known,false);
});

test('editor shows current kcal versus the profile meal objective, including individual choices',async()=>{
  const source=await readFile(new URL('../web/app.js',import.meta.url),'utf8');
  const start=source.indexOf('function mealProteinSummary('),end=source.indexOf('function updateMealProteinSummary(',start);
  const recipes=[{id:'dish',nutrition:{perYieldUnit:{energyKcal:1.5,proteinG:0.1}}},{id:'dessert',nutrition:{perYieldUnit:{energyKcal:120,proteinG:3}}}];
  const element=()=>({children:[],append(...children){this.children.push(...children);},setAttribute(){}});
  const context={...planner,document:{createElement:element},state:{people:[{id:'p',displayName:'Bibinette'}]},allPlanningRecipes:()=>recipes,isIndividualRole:role=>role==='dessert',
    $:()=>({elements:{mealDate:{value:'2026-10-19'},slot:{value:'lunch'}}}),latestProfile:()=>({dailyEnergyKcal:2000}),format:n=>String(n)};
  runInNewContext(source.slice(start,end)+'\nglobalThis.summary=mealProteinSummary;',context);
  const items={0:{recipeId:'dish',amounts:{p:'200'}},1:{role:'dessert',assignments:{p:{recipeId:'dessert',quantity:'1'}}}};
  assert.equal(context.summary(items,['p']).children[0].children[1].textContent,'Kcal : 420 / 800');
  assert.equal(context.summary(items,['p']).children[0].children[2].textContent,'Prot : 23 / 40 g');
  items[0].amounts.p='300';
  assert.equal(context.summary(items,['p']).children[0].children[1].textContent,'Kcal : 570 / 800');
  context.state.mealRatios={lunch:0.35};
  assert.equal(context.summary(items,['p']).children[0].children[1].textContent,'Kcal : 570 / 700');
  context.latestProfile=()=>({dailyEnergyKcal:null});
  assert.equal(context.summary(items,['p']).children[0].children[1].textContent,'Kcal : 570 / —');
  context.state.people.push({id:'b',displayName:'Bibou'},{id:'l',displayName:'Lapinou'},{id:'t',displayName:'Titus'});
  assert.deepEqual(Array.from(context.summary(items,['b','t','p','l']).children,row=>row.children[0].textContent),['Bibinette :','Lapinou :','Bibou :','Titus :']);
});

test('daily energy counts all five slots and individual additions, excluding other days and people',()=>{
  const date='2026-10-20',values=[507,444.4,182.3,646.8,150];
  const meals=values.map((kcal,i)=>({mealDate:date,slot:['breakfast','lunch','snack','dinner','evening_snack'][i],items:[{recipe:{nutrition:{complete:true,perYieldUnit:{energyKcal:kcal}}},amounts:[{personId:'p',quantity:1},{personId:'other',quantity:2}]}]}));
  meals.push({...meals[0],mealDate:'2026-10-21'});
  assert.ok(Math.abs(planner.calculateDailyEnergy(meals,'p',date).kcal-1930.5)<1e-8);
  assert.equal(planner.calculateDailyEnergy(meals,'p',date).incomplete,false);
  assert.equal(planner.calculateDailyEnergy(meals,'absent',date).kcal,0);
  meals[4].items[0].recipe.nutrition.perYieldUnit.energyKcal=null;
  const partial=planner.calculateDailyEnergy(meals,'p',date);
  assert.ok(Math.abs(partial.kcal-1780.5)<1e-8);assert.equal(partial.incomplete,true);
  assert.equal(planner.calculateDailyEnergy([meals[4]],'p',date).kcal,null);
});
