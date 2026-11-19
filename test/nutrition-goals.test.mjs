import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {validateNutritionTarget,addNutritionTarget} from '../src/server/nutrition-targets.mjs';
import {listPeople} from '../src/server/people.mjs';
import {effectiveNutritionProfile,monthlyReview,estimateDailyEnergy,renderNutritionGoals} from '../web/nutrition-goals.js';
import {dailyProteinTarget} from '../web/portion-planner.js';
import {saveProteinSettings} from '../src/server/protein-settings.mjs';

test('nutrition targets require an explicit confirmation and valid dated attributed values',()=>{
 const input={effectiveFrom:'2026-11-18',dailyEnergyKcal:2000,dailyProteinG:90,origin:'manual',confirmed:true};
 assert.ok(validateNutritionTarget(input).data);
 for(const change of [{confirmed:false},{effectiveFrom:'2026-02-30'},{effectiveFrom:'2026-99-99'},{dailyEnergyKcal:0},{dailyProteinG:-1},{origin:'unknown'},{origin:'estimate',method:''}])assert.ok(validateNutritionTarget({...input,...change}).error);
 assert.equal(validateNutritionTarget({...input,dailyProteinG:''}).data.dailyProteinG,null);
});

test('monthly reviews keep the original anniversary including short months and use both weight directions',()=>{
 const person={weightHistory:[{measuredOn:'2027-03-01',weightKg:85},{measuredOn:'2027-01-31',weightKg:80}],nutritionTargetHistory:[{effectiveFrom:'2027-01-31',referenceWeightKg:80}]};
 assert.equal(monthlyReview(person,'2027-02-27').due,false);
 assert.equal(monthlyReview(person,'2027-02-28').monthly,true);
 assert.equal(monthlyReview(person,'2027-03-01').weightThreshold,true);
 person.weightHistory[0].weightKg=75;assert.equal(monthlyReview(person,'2027-03-01').weightThreshold,true);
 person.nutritionTargetHistory.unshift({effectiveFrom:'2027-03-01',referenceWeightKg:75});
 assert.equal(monthlyReview(person,'2027-03-01').due,false);
 assert.equal(monthlyReview(person,'2027-03-30').monthly,false);
 assert.equal(monthlyReview(person,'2027-03-31').monthly,true);
 assert.equal(monthlyReview({weightHistory:[]},'2027-03-31').reason,'no-weights');
});

test('documented resting estimate uses measured weight, explicit sex and PAL, and rejects minors or missing data',()=>{
 const input={birthDate:'1976-01-01',date:'2026-11-18',weightKg:80,heightCm:180,sex:'male',pal:1.4};
 assert.equal(estimateDailyEnergy(input).restingKcal,1680);
 assert.equal(estimateDailyEnergy(input).maintenanceKcal,2352);
 assert.equal(estimateDailyEnergy({...input,sex:'female'}).restingKcal,1514);
 for(const change of [{birthDate:null},{birthDate:'2012-01-01'},{sex:''},{pal:0},{weightKg:null},{heightCm:null}])assert.ok(estimateDailyEnergy({...input,...change}).error);
});

test('automatic profile UI submits facts and cholesterol without manual nutrition controls',async t=>{
 const oldDocument=globalThis.document,oldFormData=globalThis.FormData;
 t.after(()=>{globalThis.document=oldDocument;globalThis.FormData=oldFormData;});
 const all=node=>[node,...node.children.flatMap(all)];
 const make=tag=>({tag,children:[],handlers:{},value:'',append(...nodes){for(const node of nodes){node.parentElement=this;this.children.push(node);}},replaceChildren(...nodes){this.children=[];this.append(...nodes);},setAttribute(){},addEventListener(name,handler){this.handlers[name]=handler;},get elements(){return Object.fromEntries(all(this).filter(n=>n.name).map(n=>[n.name,n]));}});
 globalThis.document={createElement:make};globalThis.FormData=class {constructor(form){this.form=form;}*[Symbol.iterator](){for(const [name,input] of Object.entries(this.form.elements))if(input.type!=='checkbox'||input.checked)yield [name,String(input.value)];}};
 const root=make('div'),requests=[];let saved=0;
 renderNutritionGoals(root,{id:'person',displayName:'Fictif',birthDate:'1980-01-01',profileHistory:[{effectiveFrom:'2026-01-01',heightCm:165,activityLevel:'sedentary'}],weightHistory:[{measuredOn:'2026-11-01',weightKg:76}],weightGoalHistory:[{effectiveFrom:'2026-01-01',comfortableWeightKg:69}],nutritionTargetHistory:[]},{api:async(path,options)=>{requests.push([path,options]);return {settings:null,calculation:null,plans:[],sessions:[]};},householdId:'house',today:'2026-11-19',onSaved:async()=>saved++});
 await new Promise(resolve=>setImmediate(resolve));
 const form=all(root).find(node=>node.tag==='form'&&node.elements.cholesterol);assert.ok(form);
 for(const name of ['dailyEnergyKcal','dailyProteinG','fatPercent','adjustmentChoice','idealWeightMethod','dumping'])assert.equal(form.elements[name],undefined);
 assert.equal(form.elements.lossPace.value,'moderate');form.elements.lossPace.value='fast';
 for(const [name,value] of Object.entries({sex:'female',diabetes:'none',renal:'no',hypoglycemia:'no',pregnancy:'no',surgery:'none',cholesterol:'yes'}))form.elements[name].value=value;
 form.handlers.submit({preventDefault(){}});await new Promise(resolve=>setImmediate(resolve));
 assert.equal(requests.length,2);assert.match(requests[1][0],/automatic-profile$/);
 const body=JSON.parse(requests[1][1].body);assert.equal(body.context.cholesterol,'yes');assert.equal(body.heightCm,'165');assert.equal(body.dailyEnergyKcal,undefined);assert.equal(body.lossPace,'fast');assert.equal(saved,1);
 const capacity=all(root).find(node=>node.tag==='form'&&node.elements.mainDishCapG);assert.ok(capacity);assert.equal(capacity.elements.mainDishCapG.value,'');
 assert.deepEqual(Object.keys(capacity.elements),['mainDishCapG']);capacity.elements.mainDishCapG.value='450';
 capacity.handlers.submit({preventDefault(){}});await new Promise(resolve=>setImmediate(resolve));
 const capRequest=requests.find(([path])=>path.endsWith('/serving-cap'));assert.deepEqual(JSON.parse(capRequest[1].body),{householdId:'house',mainDishCapG:'450'});
 const plan=all(root).find(node=>node.tag==='form'&&node.elements.sessionsPerWeek);assert.ok(plan);assert.equal(plan.elements.durationMinutes,undefined);
 const session=all(root).find(node=>node.tag==='form'&&node.elements.durationMinutes);assert.ok(session);assert.equal(session.elements.sessionsPerWeek,undefined);
});

test('migration preserves legacy targets, future targets and revisions remain distinct, protein settings append a target',async t=>{
 const db=new PGlite();t.after(()=>db.close());
 const migrations=(await readdir(new URL('../db/migrations/',import.meta.url))).filter(x=>x.endsWith('.sql')).sort();
 for(const name of migrations.filter(x=>x<'20261118_nutrition_goals.sql'))await db.exec(await readFile(new URL('../db/migrations/'+name,import.meta.url),'utf8'));
 const household=randomUUID(),person=randomUUID(),other=randomUUID();
 await db.query("INSERT INTO households(id,name,protein_targets) VALUES($1,'Fictif',$2)",[household,JSON.stringify({[person]:95})]);
 await db.query("INSERT INTO people(id,household_id,display_name) VALUES($1,$2,'Fictif')",[person,household]);
 await db.query("INSERT INTO person_profile_history(id,person_id,effective_from,daily_energy_kcal,daily_energy_origin) VALUES($1,$2,'2026-01-01',2100,'clinician')",[randomUUID(),person]);
 await db.exec(await readFile(new URL('../db/migrations/20261118_nutrition_goals.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../db/migrations/20261118_nutrition_macros.sql',import.meta.url),'utf8'));
 const pool={async query(sql,args){const result=await db.query(sql,args);return {...result,rowCount:result.rows.length||result.affectedRows||0};}};
 let [saved]=await listPeople(pool,household);
 assert.equal(effectiveNutritionProfile(saved,'2026-11-18').dailyEnergyKcal,2100);assert.equal(dailyProteinTarget(saved,{},'2026-11-18'),95);
 const data={effectiveFrom:'2026-11-18',dailyEnergyKcal:2000,dailyProteinG:100,dailyFatG:60,dailyCarbohydrateG:250,dailyFibreG:25,origin:'manual',method:'Choix fictif'};
 assert.ok(await addNutritionTarget(pool,person,household,data));
 await addNutritionTarget(pool,person,household,{...data,dailyEnergyKcal:1900});
 await addNutritionTarget(pool,person,household,{...data,effectiveFrom:'2027-01-01',dailyEnergyKcal:2200});
 assert.equal(await addNutritionTarget(pool,person,other,data),null);
 [saved]=await listPeople(pool,household);
 assert.equal(saved.nutritionTargetHistory.length,4);
 assert.equal(saved.nutritionTargetHistory[0].dailyFatG,60);assert.equal(saved.nutritionTargetHistory[0].dailyCarbohydrateG,250);
 assert.equal(effectiveNutritionProfile(saved,'2026-11-17').dailyEnergyKcal,2100);
 assert.equal(effectiveNutritionProfile(saved,'2026-11-18').dailyEnergyKcal,1900);
 assert.equal(effectiveNutritionProfile(saved,'2027-01-01').dailyEnergyKcal,2200);
 const sqlTarget=await db.query("SELECT daily_energy_kcal FROM effective_energy_history WHERE person_id=$1 AND effective_from<='2026-11-18' ORDER BY effective_from DESC,priority DESC,revision_order DESC LIMIT 1",[person]);assert.equal(sqlTarget.rows[0].daily_energy_kcal,1900);
 await saveProteinSettings(pool,household,{[person]:110});
 [saved]=await listPeople(pool,household);assert.equal(saved.nutritionTargetHistory.length,5);
 const current=saved.nutritionTargetHistory.find(x=>x.method.includes('Minimum protéique confirmé dans Administration'));assert.equal(current.dailyProteinG,110);assert.equal(current.dailyFatG,60);assert.equal(current.dailyCarbohydrateG,null);assert.equal(current.dailyFibreG,25);
 await db.query("SELECT set_config('app.household_id',$1,false),set_config('app.person_id',$2,false),set_config('app.is_manager','false',false)",[household,other]);
 await db.exec('SET ROLE lapinou_request');
 assert.equal((await db.query('SELECT id FROM person_nutrition_goals')).rows.length,0);
 await assert.rejects(()=>db.query("INSERT INTO person_nutrition_goals(id,person_id,effective_from,daily_energy_kcal,origin) VALUES($1,$2,'2026-11-18',2000,'manual')",[randomUUID(),person]),/row-level security/);
 await db.exec('RESET ROLE');
});
