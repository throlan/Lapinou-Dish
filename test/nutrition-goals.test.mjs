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

test('target form waits for preview and explicit confirmation and clears a preview after editing',async t=>{
 const oldDocument=globalThis.document,oldFormData=globalThis.FormData;
 t.after(()=>{globalThis.document=oldDocument;globalThis.FormData=oldFormData;});
 const make=tag=>({tag,children:[],elements:{},handlers:{},append(...nodes){this.children.push(...nodes);},replaceChildren(...nodes){this.children=nodes;},setAttribute(){},addEventListener(name,handler){this.handlers[name]=handler;},set innerHTML(html){for(const name of html.matchAll(/name="([^"]+)"/g))this.elements[name[1]]={value:''};}});
 globalThis.document={createElement:make};globalThis.FormData=class {constructor(form){this.form=form;}*[Symbol.iterator](){for(const [name,input] of Object.entries(this.form.elements))yield [name,input.value];}};
 const root=make('div'),requests=[];let saved=0;
 renderNutritionGoals(root,{id:'person',birthDate:'1980-01-01',profileHistory:[],weightHistory:[],nutritionTargetHistory:[]},{api:async(...args)=>requests.push(args),householdId:'house',today:'2026-11-18',onSaved:async()=>saved++});
 const all=node=>[node,...node.children.flatMap(all)];
 const form=all(root).find(node=>node.tag==='form'&&node.elements.dailyEnergyKcal);
 Object.assign(form.elements.dailyEnergyKcal,{value:'2000'});form.elements.origin.value='manual';form.elements.dailyProteinG.value='90';form.elements.method.value='Choix fictif';
 await form.handlers.submit({preventDefault(){}});assert.equal(requests.length,0);
 let confirmation=all(root).find(node=>node.textContent==='Valider cette cible');assert.ok(confirmation);
 form.handlers.input();assert.equal(all(root).some(node=>node.textContent==='Valider cette cible'),false);
 await form.handlers.submit({preventDefault(){}});confirmation=all(root).find(node=>node.textContent==='Valider cette cible');
 await confirmation.handlers.click();assert.equal(requests.length,1);assert.equal(JSON.parse(requests[0][1].body).confirmed,true);assert.equal(saved,1);
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
 const pool={async query(sql,args){const result=await db.query(sql,args);return {...result,rowCount:result.rows.length||result.affectedRows||0};}};
 let [saved]=await listPeople(pool,household);
 assert.equal(effectiveNutritionProfile(saved,'2026-11-18').dailyEnergyKcal,2100);assert.equal(dailyProteinTarget(saved,{},'2026-11-18'),95);
 const data={effectiveFrom:'2026-11-18',dailyEnergyKcal:2000,dailyProteinG:100,origin:'manual',method:'Choix fictif'};
 assert.ok(await addNutritionTarget(pool,person,household,data));
 await addNutritionTarget(pool,person,household,{...data,dailyEnergyKcal:1900});
 await addNutritionTarget(pool,person,household,{...data,effectiveFrom:'2027-01-01',dailyEnergyKcal:2200});
 assert.equal(await addNutritionTarget(pool,person,other,data),null);
 [saved]=await listPeople(pool,household);
 assert.equal(saved.nutritionTargetHistory.length,4);
 assert.equal(effectiveNutritionProfile(saved,'2026-11-17').dailyEnergyKcal,2100);
 assert.equal(effectiveNutritionProfile(saved,'2026-11-18').dailyEnergyKcal,1900);
 assert.equal(effectiveNutritionProfile(saved,'2027-01-01').dailyEnergyKcal,2200);
 const sqlTarget=await db.query("SELECT daily_energy_kcal FROM effective_energy_history WHERE person_id=$1 AND effective_from<='2026-11-18' ORDER BY effective_from DESC,priority DESC,revision_order DESC LIMIT 1",[person]);assert.equal(sqlTarget.rows[0].daily_energy_kcal,1900);
 await saveProteinSettings(pool,household,{[person]:110});
 [saved]=await listPeople(pool,household);assert.equal(saved.nutritionTargetHistory.length,5);
 const current=saved.nutritionTargetHistory.find(x=>x.method==='Minimum protéique confirmé dans Administration');assert.equal(current.dailyProteinG,110);
 await db.query("SELECT set_config('app.household_id',$1,false),set_config('app.person_id',$2,false),set_config('app.is_manager','false',false)",[household,other]);
 await db.exec('SET ROLE lapinou_request');
 assert.equal((await db.query('SELECT id FROM person_nutrition_goals')).rows.length,0);
 await assert.rejects(()=>db.query("INSERT INTO person_nutrition_goals(id,person_id,effective_from,daily_energy_kcal,origin) VALUES($1,$2,'2026-11-18',2000,'manual')",[randomUUID(),person]),/row-level security/);
 await db.exec('RESET ROLE');
});
