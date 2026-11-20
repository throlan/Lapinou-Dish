import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {homeBudgetShare,plannedMacro,fitsDayExtra} from '../web/day-meals.js';
import {MEAL_ORDER,MEAL_LABELS,DEFAULT_MEAL_RATIOS} from '../web/meal-config.js';

test('the four day selectors recalculate totals and offer shared extras using every participant’s remaining budget',async()=>{
  const source=await readFile(new URL('../web/app.js',import.meta.url),'utf8');
  const start=source.indexOf('function openDayMeals('),end=source.indexOf('let macroView',start);
  const node=tag=>({tag,value:'',children:[],handlers:{},append(...children){this.children.push(...children);},
    replaceChildren(){this.children=[];},setAttribute(){},add(option){this.append(option);},
    addEventListener(type,handler){this.handlers[type]=handler;},showModal(){},close(){},focus(){},
    get elements(){return this.children.flatMap(group=>group.children.flatMap(item=>item.tag==='select'?[item]:item.children.filter(c=>c.tag==='input')));},
    querySelectorAll(tag){return this.children.flatMap(item=>item.children.filter(c=>c.tag===tag));}
  });
  const nodes=Object.fromEntries(['dialog','choices','message','title'].map(key=>['#day-meals-'+key,node(key)]));
  const recipe=(id,recipeType,slot,kcal)=>({id,name:id,recipeType,slot,yield:{unitId:'piece'},nutrition:{perYieldUnit:{energyKcal:kcal}}});
  const recipes=[recipe('Pancakes','dish','breakfast',200),recipe('Fruit','dessert','snack',150),recipe('Salade','salad','lunch',300),recipe('Dîner','dish','dinner',300),
    recipe('Sauce','sauce','lunch',25),recipe('Crème','dessert','dinner',50),recipe('Yaourt','dessert','dinner',100),recipe('Gâteau','dessert','dinner',350)];
  let payload;
  const context={MEAL_ORDER,homeBudgetShare,plannedMacro,fitsDayExtra,$:selector=>nodes[selector],document:{createElement:node,createTextNode:text=>({text})},
    Option:function(label,value){Object.assign(this,{label,value});},
    state:{household:{id:'h'},people:[{id:'a',displayName:'Adulte'},{id:'b',displayName:'Enfant'}],recipes,mealAdditions:[],mealRatios:DEFAULT_MEAL_RATIOS},
    slotLabels:MEAL_LABELS,displayDate:x=>x,latestProfile:()=>({dailyEnergyKcal:1000}),format:String,formatQty:String,
    displayServingQuantity:(_,q)=>q,servingUnitLabel:x=>x,servingUnit:()=> 'pièce',allPlanningRecipes:()=>recipes,
    recipesForPlanning:(slot,role)=>recipes.filter(r=>r.slot===slot&&(role==='main'||r.recipeType===role)),
    applyAutomaticPortions:(items,ids)=>{for(const item of items)item.amounts=Object.fromEntries(ids.map(id=>[id,1]));return [];},
    individualDefaultQuantity:()=>1,calculateDailyEnergy:()=>({kcal:0}),newProductionRequestId:()=> 'request',
    api:async(_,options)=>{payload=JSON.parse(options.body);},refreshCalendar:async()=>{},refreshDashboard:async()=>{}};
  runInNewContext(source.slice(start,end)+'\nopenDayMeals("2026-11-25",[]);',context);
  const [form,review]=nodes['#day-meals-choices'].children;
  assert.equal(form.children.length,4);
  const [breakfast,lunch,snack,dinner]=form.children;
  breakfast.children[1].value='Pancakes';lunch.children[1].value='Salade';dinner.children[1].value='Dîner';
  lunch.children[3].children[0].checked=false;
  form.handlers.change();
  const totals=()=>review.children.find(child=>child.className==='day-meal-totals').children.map(child=>child.textContent);
  assert.match(totals()[2],/Enfant · 500 \/ 600 kcal/);
  const dessert=()=>review.children.find(child=>child.children[0]?.text==='Dîner · Dessert').children[1];
  assert.deepEqual(dessert().children.map(option=>option.value),['','Crème','Yaourt']);
  dessert().value='Yaourt';dessert().handlers.change();
  assert.match(totals()[2],/Enfant · 600 \/ 600 kcal/);
  snack.children[1].value='Fruit';snack.children[3].children[0].checked=false;
  form.handlers.change();
  assert.match(totals()[1],/Adulte · 950 \/ 1000 kcal/);
  assert.deepEqual(dessert().children.map(option=>option.value),['','Crème']);
  dessert().value='Crème';dessert().handlers.change();
  await review.children.at(-1).handlers.click();
  assert.deepEqual(payload.meals.find(meal=>meal.slot==='breakfast').attendeeIds,['a','b']);
  assert.deepEqual(payload.meals.find(meal=>meal.slot==='lunch').attendeeIds,['a']);
  assert.deepEqual(payload.meals.find(meal=>meal.slot==='dinner').items[1].amounts,[{personId:'a',quantity:1},{personId:'b',quantity:1}]);
});
