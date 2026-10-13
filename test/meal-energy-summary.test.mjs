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
  assert.equal(context.summary(items,['p']).children[1].textContent,'Bibinette : 420 / 800 kcal');
  items[0].amounts.p='300';
  assert.equal(context.summary(items,['p']).children[1].textContent,'Bibinette : 570 / 800 kcal');
  context.state.mealRatios={lunch:0.35};
  assert.equal(context.summary(items,['p']).children[1].textContent,'Bibinette : 570 / 700 kcal');
  context.latestProfile=()=>({dailyEnergyKcal:null});
  assert.equal(context.summary(items,['p']).children[1].textContent,'Bibinette : 570 / — kcal');
});
