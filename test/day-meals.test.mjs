import test from 'node:test';
import assert from 'node:assert/strict';
import {homeBudgetShare,plannedMacro,expandDayMealPortions} from '../web/day-meals.js';
import {DEFAULT_MEAL_RATIOS as ratios} from '../web/meal-config.js';

test('a child away for lunch keeps 60 percent of home targets, while an empty slot signals no absence',()=>{
 const date='2026-11-25', lunch={mealDate:date,slot:'lunch',attendees:[{id:'adult'}]};
 assert.equal(homeBudgetShare([lunch],'child',date,ratios),.6);
 assert.equal(homeBudgetShare([lunch],'adult',date,ratios),1);
 assert.equal(homeBudgetShare([],'child',date,ratios),1);
 assert.equal(homeBudgetShare([lunch,{...lunch,attendees:[{id:'child'}]}],'child',date,ratios),1);
 assert.equal(homeBudgetShare([lunch,{...lunch,slot:'dinner'}],'child',date,ratios),.3);
});

test('calendar macros multiply planned amounts and distinguish missing values from zero',()=>{
 const date='2026-11-25', item=(perYieldUnit)=>({amounts:[{personId:'adult',quantity:2}],recipe:{nutrition:{perYieldUnit}}});
 const meals=[{mealDate:date,items:[item({carbohydrateG:8,fatG:0}),item({carbohydrateG:null,fatG:4})]}];
 assert.deepEqual(plannedMacro(meals,'adult',date,'carbohydrateG'),{grams:16,incomplete:true});
 assert.deepEqual(plannedMacro(meals,'adult',date,'fatG'),{grams:8,incomplete:false});
 assert.deepEqual(plannedMacro(meals,'child',date,'fatG'),{grams:null,incomplete:false});
});

test('an incomplete ingredient component does not make the calories uncertain when its energy is known',()=>{
 const date='2026-11-25', item={amounts:[{personId:'a',quantity:2}],recipe:{energyKnown:true,
   nutrition:{perYieldUnit:{energyKcal:100},lineIssues:[{reason:'component-data-missing'}]}}};
 assert.deepEqual(plannedMacro([{mealDate:date,items:[item]}],'a',date,'energyKcal'),{grams:200,incomplete:false});
 item.recipe.energyKnown=false;
 assert.deepEqual(plannedMacro([{mealDate:date,items:[item]}],'a',date,'energyKcal'),{grams:200,incomplete:true});
});

test('a daily balance can grow whole servings within the remaining budget, keeping incomplete days out',()=>{
 const ids=['a','b','c','d'];
 const meal={slot:'lunch',attendeeIds:ids,items:[{kcal:250,amounts:ids.map(personId=>({personId,quantity:1}))}]};
 const targets=new Map([['a',900],['b',1200],['c',1200],['d',1200]]);
 const used=new Map([['a',750],['b',650],['c',650],['d',650]]);
 const calls=[];
 const breakfast={slot:'breakfast',attendeeIds:ids,items:[{kcal:120,amounts:ids.map(personId=>({personId,quantity:1}))}]};
 const snack={slot:'snack',attendeeIds:ids,items:[{kcal:30,amounts:ids.map(personId=>({personId,quantity:4}))}]};
 expandDayMealPortions([breakfast,snack,meal],{targets,used,incomplete:new Set(['c']),energy:item=>item.kcal,
   propose:(slotMeal,person,budget)=>{assert.equal(slotMeal.slot,'lunch');calls.push(person);return [person==='d'?5:Math.floor(budget/250)];}});
 assert.deepEqual(meal.items[0].amounts.map(amount=>amount.quantity),[1,3,1,1]);
 assert.deepEqual([...used.values()],[750,1150,650,650]);
 assert.ok(!calls.includes('c'));
 assert.ok(snack.items[0].amounts.every(amount=>amount.quantity===4));
 assert.ok(breakfast.items[0].amounts.every(amount=>amount.quantity===1));
});
