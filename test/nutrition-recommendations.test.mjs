import test from 'node:test';
import assert from 'node:assert/strict';
import {proposeNutritionPlan,idealWeight} from '../web/nutrition-recommendations.js';
import {validateNutritionTarget} from '../src/server/nutrition-targets.mjs';

const input={date:'2026-11-18',estimate:{maintenanceKcal:1962,age:47,weightKg:76.6,heightCm:165,sex:'female'},objective:'lose',adjustmentKcal:300,proteinG:80,fatPercent:30,context:{diabetes:'none',renal:'no',pregnancy:'no',hypoglycemia:'no',surgery:'none',dumping:'no'}};
test('a confirmed weight-loss goal uses an explicit adjustment, not maintenance, with coherent macros',()=>{
 const p=proposeNutritionPlan(input);assert.equal(p.dailyEnergyKcal,1662);assert.equal(p.dailyProteinG,80);assert.deepEqual(p.conflicts,[]);
 assert.ok(Math.abs(p.dailyFatG*9+p.dailyCarbohydrateG*4+p.dailyProteinG*4-p.dailyEnergyKcal)<1);
 assert.equal(proposeNutritionPlan({...input,objective:'maintain',adjustmentKcal:''}).dailyEnergyKcal,1962);
 assert.equal(proposeNutritionPlan({...input,objective:'gain'}).dailyEnergyKcal,2262);
 assert.ok(proposeNutritionPlan({...input,adjustmentKcal:''}).error);
 assert.ok(proposeNutritionPlan({...input,estimate:{...input.estimate,age:17}}).error);
});
test('type 2 diabetes adds sourced fibre guidance without imposing a carbohydrate ratio or calorie coefficient',()=>{
 const p=proposeNutritionPlan({...input,context:{...input.context,diabetes:'type2'}});
 assert.equal(p.dailyEnergyKcal,1662);assert.equal(p.dailyFibreG,24);
 assert.equal(p.dailyCarbohydrateG,proposeNutritionPlan(input).dailyCarbohydrateG);
 assert.ok(p.notes.some(note=>note.includes('aucune répartition universelle')));
});
test('stable bariatric follow-up uses an explicitly selected medical weight formula, not personal goal weight',()=>{
 assert.equal(idealWeight(165,'female','lorentz'),59);
 assert.equal(idealWeight(165,'female',''),null);
 const context={...input.context,surgery:'mini_bypass',surgeryDate:'2020-01-01'};
 const p=proposeNutritionPlan({...input,context,proteinG:'',idealWeightMethod:'lorentz',comfortableWeightKg:69});
 assert.equal(p.referenceWeight,59);assert.equal(p.dailyProteinG,65);assert.deepEqual(p.conflicts,[]);
 assert.ok(proposeNutritionPlan({...input,context,idealWeightMethod:''}).conflicts.length);
 assert.ok(proposeNutritionPlan({...input,context,proteinG:60,idealWeightMethod:'lorentz'}).conflicts.some(x=>x.includes('inférieur')));
});
test('medical conflicts are listed and cannot be applied through the recommendation API',()=>{
 for(const context of [{renal:'yes'},{renal:'unknown'},{hypoglycemia:'yes'},{pregnancy:'yes'},{dumping:'yes'},{diabetes:'type1'},{surgery:'sleeve',surgeryDate:'2026-10-01'},{surgery:'bypass',surgeryDate:'2026-02-30'}]){
  const questionnaire={...input,context:{...input.context,...context},idealWeightMethod:'lorentz'};
  const p=proposeNutritionPlan(questionnaire);assert.ok(p.conflicts.length,JSON.stringify(context));
  assert.equal(validateNutritionTarget({effectiveFrom:input.date,dailyEnergyKcal:p.dailyEnergyKcal,dailyProteinG:p.dailyProteinG,origin:'estimate',method:'Sources',confirmed:true,questionnaire}).error,'nutrition-conflicts-require-review');
 }
 assert.ok(proposeNutritionPlan({...input,adjustmentKcal:800}).conflicts.some(x=>x.includes('1 200')));
});
test('validated macros and private questionnaire remain explicit, while changed automatic results are rejected',()=>{
 const p=proposeNutritionPlan(input),body={effectiveFrom:input.date,dailyEnergyKcal:p.dailyEnergyKcal,dailyProteinG:p.dailyProteinG,dailyFatG:p.dailyFatG,dailyCarbohydrateG:p.dailyCarbohydrateG,dailyFibreG:p.dailyFibreG,origin:'estimate',method:'Sources documentées',confirmed:true,questionnaire:input};
 assert.ok(validateNutritionTarget(body).data);
 assert.equal(validateNutritionTarget({...body,dailyEnergyKcal:1962}).error,'nutrition-proposal-changed');
 assert.ok(validateNutritionTarget({...body,dailyFatG:-1}).error);
 assert.ok(validateNutritionTarget({...body,origin:'manual',dailyEnergyKcal:1700}).data);
});
