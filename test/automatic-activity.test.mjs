import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {automaticNutrition} from '../web/automatic-nutrition.js';
import {projectWeight,addedActivityKcal,activitySummary,datePlusDays} from '../web/activity-model.js';
import {validateAutomaticProfile,saveAutomaticProfile,recalculateAutomatic,readAutomaticActivity,validateActivity,saveActivity,parisToday} from '../src/server/automatic-profile.mjs';
import {listPeople,addWeightEntry} from '../src/server/people.mjs';

const date='2026-11-19',context={diabetes:'type2',surgery:'none',surgeryDate:null,renal:'no',hypoglycemia:'no',pregnancy:'no',dumping:'no',cholesterol:'yes'};
const person={birthDate:'1976-01-01',profileHistory:[{effectiveFrom:'2026-01-01',heightCm:173,activityLevel:'sedentary'}],weightHistory:[{measuredOn:date,weightKg:115.9}],weightGoalHistory:[{effectiveFrom:'2026-01-01',comfortableWeightKg:90,interimTargetKg:105}]};
test('automatic profile derives all five targets, cholesterol advice and goal direction without personal diet inputs',()=>{
 const result=automaticNutrition({person,settings:{sex:'male',context,dailyEnergyKcal:1750,dailyProteinG:999},date});
 assert.equal(result.status,'calculated');assert.equal(result.objective,'lose');assert.ok(result.dailyProteinG<999);assert.ok(result.dailyEnergyKcal!==1750);
 assert.ok(result.notes.some(text=>text.includes('Cholestérol')));
 assert.ok(Math.abs(result.dailyEnergyKcal-result.dailyProteinG*4-result.dailyFatG*9-result.dailyCarbohydrateG*4)<1);
 for(const name of ['dailyEnergyKcal','dailyProteinG','dailyFatG','dailyCarbohydrateG','dailyFibreG'])assert.ok(result[name]>0,name);
 const progressed={...person,weightHistory:[{measuredOn:date,weightKg:100}]};assert.equal(automaticNutrition({person:progressed,settings:{sex:'male',context},date}).objective,'lose','a reached intermediate goal must not reverse weight loss');
 assert.ok(automaticNutrition({person:progressed,settings:{sex:'male',context},date}).dailyEnergyKcal<result.dailyEnergyKcal);
});
test('automatic mode does not fabricate targets for minors, unknown inputs or conflicting medical contexts',()=>{
 for(const facts of [{...context,renal:'yes'},{...context,hypoglycemia:'unknown'},{...context,pregnancy:'yes'},{...context,surgery:'mini_bypass',surgeryDate:'2026-10-01'}])assert.equal(automaticNutrition({person,settings:{sex:'male',context:facts},date}).status,'needs-review');
 assert.equal(automaticNutrition({person:{...person,birthDate:'2012-01-01'},settings:{sex:'male',context},date}).status,'needs-review');
 assert.equal(automaticNutrition({person:{...person,weightHistory:[]},settings:{sex:'male',context},date}).status,'needs-review');
 assert.equal(automaticNutrition({person,settings:{sex:'male',context:{...context,surgery:'bypass',surgeryDate:'invalid'}},date}).status,'needs-review');
 assert.equal(automaticNutrition({person:{...person,weightHistory:[{measuredOn:date,weightKg:500}],profileHistory:[{effectiveFrom:date,heightCm:260,activityLevel:'very_active'}]},settings:{sex:'male',context},date}).status,'needs-review');
});
test('four chosen paces respect their rates, the exact 750 kcal cap and maintenance',()=>{
 const results={};for(const [lossPace,rate] of [['fast',.3],['moderate',.2],['slow',.1],['maintain',0]]){
  const r=automaticNutrition({person,settings:{sex:'male',lossPace,context},date});results[lossPace]=r;
  assert.equal(r.status,'calculated');assert.equal(r.requestedDeficitRate,rate);
  assert.equal(r.adjustmentKcal,Math.floor(Math.min(750,r.maintenanceKcal*rate)));
  assert.equal(r.dailyEnergyKcal,r.maintenanceKcal-r.adjustmentKcal);assert.ok(r.adjustmentKcal<=750);
 }
 assert.equal(results.fast.adjustmentKcal,750);assert.equal(results.maintain.objective,'maintain');assert.equal(results.maintain.dailyEnergyKcal,results.maintain.maintenanceKcal);
 assert.ok(results.fast.dailyEnergyKcal<results.moderate.dailyEnergyKcal);assert.ok(results.moderate.dailyEnergyKcal<results.slow.dailyEnergyKcal);
 for(const weightKg of [90,100,110,120,130])for(const lossPace of ['fast','moderate','slow']){
  const r=automaticNutrition({person:{...person,weightHistory:[{measuredOn:date,weightKg}]},settings:{sex:'male',lossPace,context},date});assert.equal(r.status,'calculated');assert.ok(r.maintenanceKcal-r.dailyEnergyKcal<=750);
 }
 const reached={...person,weightHistory:[{measuredOn:date,weightKg:90}]};assert.equal(automaticNutrition({person:reached,settings:{sex:'male',lossPace:'fast',context},date}).adjustmentKcal,0);
 assert.equal(automaticNutrition({person,settings:{sex:'male',lossPace:'other',context},date}).status,'needs-review');
});

test('retired combined dumping question cannot block a complete profile or its projection',()=>{
 const profile={birthDate:'1978-06-15',profileHistory:[{effectiveFrom:date,heightCm:167,activityLevel:'sedentary'}],weightHistory:[{measuredOn:date,weightKg:77.2}],weightGoalHistory:[{effectiveFrom:date,comfortableWeightKg:70,interimTargetKg:73}]};
 for(const oldValue of ['yes','no','unknown',undefined]){
  const result=automaticNutrition({person:profile,settings:{sex:'female',context:{...context,diabetes:'none',surgery:'mini_bypass',surgeryDate:'2013-04-01',dumping:oldValue}},date});
  assert.equal(result.status,'calculated');assert.equal(result.dailyEnergyKcal,1585);
  assert.deepEqual([result.dailyProteinG,result.dailyFatG,result.dailyCarbohydrateG,result.dailyFibreG],[138.7,52.8,138.7,25]);
  const projection=projectWeight({startDate:date,birthDate:profile.birthDate,weightKg:77.2,heightCm:167,sex:'female',pal:1.4,maintenanceKcal:result.maintenanceKcal,intakeKcal:result.dailyEnergyKcal});assert.ok(projection.points.length>1);assert.equal(projection.error,undefined);
 }
 const {dumping,...withoutRetiredField}=context;assert.ok(validateAutomaticProfile({effectiveFrom:date,displayName:'Fictif',birthDate:profile.birthDate,sex:'female',heightCm:167,activityLevel:'sedentary',context:withoutRetiredField},date).data);
});

test('reduced dynamic model remains at maintenance, slows monthly loss and accounts for net additional activity once',()=>{
 const input={startDate:date,birthDate:'1976-01-01',weightKg:80,heightCm:180,sex:'male',pal:1.4,maintenanceKcal:2352,intakeKcal:2352,horizonDays:365};
 const maintained=projectWeight(input);assert.ok(Math.abs(maintained.finalWeightKg-80)<1e-9);
 const loss=projectWeight({...input,intakeKcal:1900,targets:{comfortable:79}});assert.ok(loss.finalWeightKg<80);assert.ok(loss.reached.comfortable);assert.ok(Math.abs(loss.points[1].changeKg)>Math.abs(loss.points.at(-1).changeKg));
 const plan={activityType:'walk',minutesPerSession:30,sessionsPerWeek:3,additional:true};
 const activity=projectWeight({...input,intakeKcal:1900,plan});assert.ok(activity.finalWeightKg<loss.finalWeightKg);
 assert.ok(Math.abs(activity.additionalKcalPerDay-addedActivityKcal(80,'walk',30,3,true))<1e-9);
 assert.equal(projectWeight({...input,intakeKcal:1900,plan:{...plan,additional:false}}).finalWeightKg,loss.finalWeightKg);
 assert.equal(addedActivityKcal(80,'walk',30,7,true),84);
});
test('projection respects date boundaries, model limits and unattainable targets without fabricating arrival dates',()=>{
 assert.equal(datePlusDays('2026-03-29',1),'2026-03-30');assert.equal(datePlusDays('2028-02-28',1),'2028-02-29');
 const input={startDate:'2026-01-31',birthDate:'1976-01-01',weightKg:80,heightCm:180,sex:'male',pal:1.4,maintenanceKcal:2352,intakeKcal:2352,targets:{comfortable:70}};
 const r=projectWeight(input);assert.equal(r.points[1].date,'2026-02-28');assert.equal(r.points[2].date,'2026-03-31');assert.equal(r.reached.comfortable,null);
 assert.ok(projectWeight({...input,birthDate:'2012-01-01'}).error);assert.ok(projectWeight({...input,intakeKcal:1000}).error);assert.ok(projectWeight({...input,horizonDays:1096}).error);
});
test('manual sessions are distinct from plans and only recorded non-cancelled sessions enter the realized summary',()=>{
 const rows=[{performedOn:date,durationMinutes:25,additional:true},{performedOn:date,durationMinutes:10,additional:false},{performedOn:date,durationMinutes:40,additional:true,cancelledAt:'now'},{performedOn:'2026-10-01',durationMinutes:90}];
 assert.deepEqual(activitySummary(rows,date),{startsOn:'2026-11-13',endsOn:date,sessions:2,minutes:35,additionalMinutes:25});
 assert.ok(validateActivity({requestId:randomUUID(),activityType:'walk',performedOn:'2026-12-01',durationMinutes:30,additional:true},'activity-sessions',date).error);
 assert.ok(validateActivity({requestId:randomUUID(),activityType:'walk',effectiveFrom:date,minutesPerSession:30,sessionsPerWeek:8,additional:true},'activity-plans',date).error);
});
test('automatic persistence is additive, dated, idempotent, recalculated after new data, and protected by RLS',async t=>{
 // The save path stamps Paris today: keep this persistence scenario on the same day.
 const date=parisToday();
 const db=new PGlite();t.after(()=>db.close());const migrations=(await readdir(new URL('../db/migrations/',import.meta.url))).filter(x=>x.endsWith('.sql')).sort();
 for(const name of migrations)await db.exec(await readFile(new URL('../db/migrations/'+name,import.meta.url),'utf8'));
 const pool={async query(sql,args=[]){const result=await db.query(sql,args);return {...result,rowCount:result.rows.length||result.affectedRows||0};},async connect(){return {...this,release(){}};}};
 const h=randomUUID(),p=randomUUID(),other=randomUUID();await pool.query("INSERT INTO households(id,name) VALUES($1,'Fictif')",[h]);await pool.query("INSERT INTO people(id,household_id,display_name) VALUES($1,$2,'Profil fictif')",[p,h]);
 const checked=validateAutomaticProfile({effectiveFrom:date,displayName:'Profil fictif',birthDate:'1976-01-01',sex:'male',heightCm:173,activityLevel:'sedentary',objective:'lose',lossPace:'slow',weightKg:115.9,measuredOn:'2026-11-18',comfortableWeightKg:90,interimTargetKg:105,context},date);assert.ok(checked.data);
 checked.data.settings.context.dumping='yes';
 const saved=await saveAutomaticProfile(pool,p,h,checked.data);assert.equal(saved.result.status,'calculated');
 let entries=(await listPeople(pool,h))[0].nutritionTargetHistory;assert.equal(entries.length,1);assert.equal(entries[0].questionnaire.automatic,true);
 await recalculateAutomatic(pool,p,h,date);assert.equal((await listPeople(pool,h))[0].nutritionTargetHistory.length,1);
 await addWeightEntry(pool,p,h,{measuredOn:date,weightKg:110});await recalculateAutomatic(pool,p,h,date);
 entries=(await listPeople(pool,h))[0].nutritionTargetHistory;assert.equal(entries.length,2);assert.ok(entries[0].dailyEnergyKcal<entries[1].dailyEnergyKcal);
 const plan=validateActivity({requestId:randomUUID(),effectiveFrom:date,activityType:'walk',minutesPerSession:30,sessionsPerWeek:3,additional:true},'activity-plans',date).data;
 await saveActivity(pool,p,h,'activity-plans',plan);await saveActivity(pool,p,h,'activity-plans',plan);
 const session=validateActivity({requestId:randomUUID(),performedOn:date,activityType:'walk',durationMinutes:20,additional:true},'activity-sessions',date).data;
 await saveActivity(pool,p,h,'activity-sessions',session);await saveActivity(pool,p,h,'activity-sessions',session);
 assert.equal((await saveActivity(pool,p,h,'activity-sessions',{...session,durationMinutes:21})).error,'activity-request-conflict');
 const data=await readAutomaticActivity(pool,p,h,date);assert.equal(data.plans.length,1);assert.equal(data.sessions.length,1);assert.equal(data.settings.lossPace,'slow');assert.equal(data.settings.objective,'lose');assert.equal(data.calculation.requestedDeficitRate,.1);assert.equal(data.settings.context.cholesterol,'yes');assert.equal(data.settings.context.dumping,'yes');assert.equal(data.calculation.status,'calculated');assert.equal((await listPeople(pool,h))[0].nutritionTargetHistory.length,2,'activity must not add food calories');
 await saveActivity(pool,p,h,'activity-sessions',{action:'cancel',sessionId:session.id});assert.ok((await readAutomaticActivity(pool,p,h,date)).sessions[0].cancelledAt);
 assert.equal(await readAutomaticActivity(pool,p,other,date),null);
 await pool.query("SELECT set_config('app.household_id',$1,false),set_config('app.person_id',$2,false),set_config('app.is_manager','false',false)",[h,other]);await pool.query('SET ROLE lapinou_request');
 for(const table of ['person_automatic_profiles','person_activity_plans','person_activity_sessions','person_automatic_state'])assert.equal((await pool.query('SELECT * FROM '+table)).rows.length,0);
 await assert.rejects(()=>pool.query('INSERT INTO person_activity_sessions(id,person_id,performed_on,activity_type,duration_minutes,additional) VALUES($1,$2,$3,$4,20,true)',[randomUUID(),p,date,'walk']),/row-level security/);await pool.query('RESET ROLE');
});
