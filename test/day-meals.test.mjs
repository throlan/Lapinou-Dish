import test from 'node:test';
import assert from 'node:assert/strict';
import {homeBudgetShare,plannedMacro} from '../web/day-meals.js';
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
