import test from 'node:test';
import assert from 'node:assert/strict';
import {automaticNutrition} from '../web/automatic-nutrition.js';
import {validateAutomaticProfile} from '../src/server/automatic-profile.mjs';
import {renderAutomaticProfile} from '../web/automatic-profile-ui.js';
const date='2026-11-19',context={diabetes:'none',surgery:'none',renal:'no',hypoglycemia:'no',pregnancy:'no',cholesterol:'no'};
const person={id:'p',displayName:'Fictif',birthDate:'1980-01-01',profileHistory:[{effectiveFrom:date,heightCm:175,activityLevel:'sedentary'}],weightHistory:[{measuredOn:date,weightKg:90}],weightGoalHistory:[{effectiveFrom:date,comfortableWeightKg:70}],nutritionTargetHistory:[]};
test('explicit maintenance overrides a lower weight goal, loss is explicit, gain preserves the prior target until surplus is defined',()=>{
 const settings={sex:'male',lossPace:'fast',context};
 const maintenance=automaticNutrition({person,settings:{...settings,objective:'maintain'},date});assert.equal(maintenance.status,'calculated');assert.equal(maintenance.objective,'maintain');assert.equal(maintenance.adjustmentKcal,0);assert.equal(maintenance.requestedDeficitRate,0);assert.ok(Math.abs(maintenance.dailyCarbohydrateG*4/maintenance.dailyEnergyKcal-.45)<.001);
 const loss=automaticNutrition({person,settings:{...settings,objective:'lose'},date});assert.equal(loss.objective,'lose');assert.ok(loss.adjustmentKcal>0);
 const gain=automaticNutrition({person,settings:{...settings,objective:'gain'},date});assert.equal(gain.status,'needs-review');assert.equal(gain.objective,'gain');assert.match(gain.problems.join(),/surplus/);assert.equal(gain.dailyEnergyKcal,undefined);
 const input={effectiveFrom:date,displayName:'Fictif',birthDate:person.birthDate,heightCm:175,activityLevel:'sedentary',sex:'male',lossPace:'moderate',context};
 for(const objective of ['maintain','lose','gain'])assert.equal(validateAutomaticProfile({...input,objective},date).data.settings.objective,objective);
 assert.ok(validateAutomaticProfile({...input,objective:'unknown'},date).error);assert.ok(validateAutomaticProfile({...input,objective:'lose',lossPace:'maintain'},date).error);
});
function fakeDOM(t){
 const oldDocument=globalThis.document,oldFormData=globalThis.FormData;t.after(()=>{globalThis.document=oldDocument;globalThis.FormData=oldFormData;});
 const all=node=>[node,...node.children.flatMap(all)];const make=tag=>({tag,children:[],handlers:{},value:'',append(...nodes){for(const node of nodes){node.parentElement=this;this.children.push(node);}},replaceChildren(...nodes){this.children=[];this.append(...nodes);},setAttribute(){},addEventListener(k,v){this.handlers[k]=v;},get elements(){return Object.fromEntries(all(this).filter(n=>n.name).map(n=>[n.name,n]));}});
 globalThis.document={createElement:make};globalThis.FormData=class {constructor(form){this.form=form;}*[Symbol.iterator](){for(const [name,field] of Object.entries(this.form.elements))yield [name,String(field.value)];}};return {make,all};
}
test('three objectives are visible, pace only for loss, and maintenance projection table is open',async t=>{
 const {make,all}=fakeDOM(t),root=make('div');const calculation=automaticNutrition({person,settings:{sex:'male',objective:'maintain',lossPace:'fast',context},date});
 renderAutomaticProfile(root,person,{api:async()=>({settings:{sex:'male',objective:'maintain',lossPace:'fast',context},calculation,plans:[],sessions:[]}),householdId:'h',today:date,onSaved:async()=>{}});await new Promise(setImmediate);
 const form=all(root).find(n=>n.tag==='form'&&n.elements.objective);assert.deepEqual(form.elements.objective.children.map(n=>n.value),['maintain','lose','gain']);assert.equal(form.elements.lossPace.parentElement.hidden,true);
 form.elements.objective.value='lose';form.elements.objective.handlers.change();assert.equal(form.elements.lossPace.parentElement.hidden,false);assert.deepEqual(form.elements.lossPace.children.map(n=>n.value),['fast','moderate','slow']);
 form.elements.objective.value='gain';form.elements.objective.handlers.change();assert.equal(form.elements.lossPace.parentElement.hidden,true);
 const projection=all(root).find(n=>n.tag==='details'&&n.children.some(c=>c.tag==='summary'&&c.textContent==='Suivi du poids et estimation d’évolution'));assert.equal(projection.open,true);assert.ok(all(projection).filter(n=>n.tag==='table').length>=2);
});
test('adolescent goals save independently of clinical facts and measured weight history stays visible without adult projection',async t=>{
 const {make,all}=fakeDOM(t),root=make('div'),requests=[];const teen={...person,birthDate:'2012-01-01',weightGoalHistory:[]};
 renderAutomaticProfile(root,teen,{api:async(path,options)=>{requests.push([path,options]);return {settings:{objective:'maintain'},calculation:{status:'needs-review',problems:['Domaine adulte']},plans:[],sessions:[]};},householdId:'h',today:date,onSaved:async()=>{}});await new Promise(setImmediate);
 const form=all(root).find(n=>n.tag==='form'&&n.elements.comfortableWeightKg);assert.ok(form);assert.equal(form.elements.sex,undefined);assert.equal(form.elements.renal,undefined);form.elements.comfortableWeightKg.value='65';form.elements.interimTargetKg.value='68';form.handlers.submit({preventDefault(){}});await new Promise(setImmediate);
 const request=requests.find(([path])=>path.endsWith('/weight-goals'));assert.deepEqual(JSON.parse(request[1].body),{householdId:'h',effectiveFrom:date,comfortableWeightKg:'65',interimTargetKg:'68'});
 assert.ok(all(root).some(n=>n.tag==='table'));assert.ok(all(root).some(n=>n.textContent?.includes('ne prédit pas la croissance')));
});
