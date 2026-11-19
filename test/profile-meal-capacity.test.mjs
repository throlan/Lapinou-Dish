import test from 'node:test';
import assert from 'node:assert/strict';
import {capMainDish,servedGramsPerUnit} from '../web/main-dish-cap.js';
import {effectiveServingCaps} from '../web/meal-config.js';
import {cappedMealPortions} from '../web/portion-planner.js';
import {automaticNutrition} from '../web/automatic-nutrition.js';
import {validatePersonServingCap,readServingCaps} from '../src/server/serving-cap-settings.mjs';
import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {handleRequest} from '../src/server/app.mjs';

test('personal capacity covers all cooked main parts, preserves separate protein and ignores optional additions',()=>{
 const input=[{role:'main',parentRecipeId:'p',recipeUnit:'g',quantity:150,servingLoad:{meat:1}},
 {role:'accompaniment',parentRecipeId:'p',recipeUnit:'g',quantity:200},
 {role:'accompaniment',parentRecipeId:'p',recipeUnit:'g',quantity:400},
 {role:'dessert',assignment:{},recipeUnit:'g',quantity:100}];
 for(const max of [450,600]){const r=capMainDish(input,max);assert.equal(r.changed,true);assert.equal(r.proposals[0].quantity,150);assert.ok(r.afterGrams<=max);assert.ok(r.afterGrams>max-.001);assert.equal(r.proposals[3].quantity,100);}
 assert.equal(input[1].quantity,200);
 assert.equal(capMainDish(input,100).conflicts[0],'protein-part-exceeds-volume');
 assert.deepEqual(capMainDish(input,undefined).proposals,input);
});
test('whole mixed dishes use total cooked mass, unknown weights and indivisible portions keep quantities with a conflict',()=>{
 assert.equal(servedGramsPerUnit({yield:{amount:24,unitId:'piece'},servingWeightG:2400}),100);
 assert.equal(servedGramsPerUnit({yield:{amount:10,unitId:'g'}}),1);
 const mixed=[{role:'main',recipeUnit:'g',quantity:750,servingLoad:{meat:.1}}];
 assert.equal(capMainDish(mixed,600).afterGrams,600);
 const whole=[{role:'main',recipeUnit:'piece',quantity:1,servedGramsPerUnit:650}];
 const conflict=capMainDish(whole,600);assert.equal(conflict.changed,false);assert.equal(conflict.proposals[0].quantity,1);assert.ok(conflict.conflicts.length);
 assert.equal(capMainDish([{role:'main',recipeUnit:'portion',quantity:1}],600).conflicts[0],'unknown-served-weight');
 const withAbsent=[{role:'main',recipeUnit:'g',quantity:750},{role:'main',recipeUnit:'portion',quantity:0}];assert.equal(capMainDish(withAbsent,450).afterGrams,450);
});
test('planner applies personal total after legacy portion calculations and replaces only the old mixed cap',()=>{
 assert.equal(effectiveServingCaps({plateTotal:900,mixed:550}).mixed,Infinity);
 assert.equal(effectiveServingCaps({mixed:550}).mixed,550);
 const parts=['main','starch','vegetables'];const rows=parts.map((servingPart,i)=>({parentRecipeId:'p',plateParts:parts,servingPart,recipeUnit:'g',role:i?'accompaniment':'main',recipeKcal:1,servingLoad:[{meat:1.25},{starch:1},{vegetables:1}][i]}));
 const initial=cappedMealPortions(rows,1200),limited=cappedMealPortions(rows,1200,undefined,{plateTotal:450});
 assert.equal(limited.proposals[0].quantity,initial.proposals[0].quantity);assert.ok(limited.proposals.reduce((n,r)=>n+r.quantity,0)<=450);assert.ok(limited.warnings.length);
});
test('all loss paces distribute the final reduced calories as 35/35/30; maintenance and minors keep their domain',()=>{
 const date='2026-11-19',person={birthDate:'1976-01-01',profileHistory:[{effectiveFrom:date,heightCm:173,activityLevel:'sedentary'}],weightHistory:[{measuredOn:date,weightKg:115.9}],weightGoalHistory:[{effectiveFrom:date,comfortableWeightKg:90}]};
 const context={diabetes:'type2',surgery:'none',renal:'no',hypoglycemia:'no',pregnancy:'no',cholesterol:'no'};
 for(const [lossPace,rate] of [['fast',.3],['moderate',.2],['slow',.1]]){
 const r=automaticNutrition({person,settings:{sex:'male',lossPace,context},date});assert.equal(r.status,'calculated');assert.equal(r.adjustmentKcal,Math.floor(Math.min(750,r.maintenanceKcal*rate)));
 for(const [g,factor,ratio] of [[r.dailyProteinG,4,.35],[r.dailyCarbohydrateG,4,.35],[r.dailyFatG,9,.30]])assert.ok(Math.abs(g*factor-r.dailyEnergyKcal*ratio)<.46);
 assert.ok(Math.abs(r.dailyEnergyKcal-r.dailyProteinG*4-r.dailyCarbohydrateG*4-r.dailyFatG*9)<1);
 }
 const maintain=automaticNutrition({person,settings:{sex:'male',lossPace:'maintain',context},date});assert.equal(maintain.objective,'maintain');assert.equal(maintain.dailyEnergyKcal,maintain.maintenanceKcal);assert.ok(Math.abs(maintain.dailyCarbohydrateG*4/maintain.dailyEnergyKcal-.45)<.001);
 const reached=automaticNutrition({person:{...person,weightHistory:[{measuredOn:date,weightKg:90}]},settings:{sex:'male',lossPace:'fast',context},date});assert.equal(reached.objective,'maintain');
 assert.equal(automaticNutrition({person:{...person,birthDate:'2012-01-01'},settings:{sex:'male',lossPace:'fast',context},date}).status,'needs-review');
});
test('capacity is optional, bounded and saved independently without nutrition questionnaire or another household writes',async()=>{
 for(const raw of [-1,0,5001,2.5,true,[],{},undefined])assert.ok(validatePersonServingCap({mainDishCapG:raw}).error);
 assert.ok(validatePersonServingCap({}).error);assert.equal(validatePersonServingCap({mainDishCapG:''}).data,null);
 const db=new PGlite();try{
 const dir=new URL('../db/migrations/',import.meta.url);for(const f of (await readdir(dir)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(f,dir),'utf8'));
 const [h,other,p]=Array.from({length:3},()=>randomUUID());await db.query("INSERT INTO households(id,name) VALUES($1,'A'),($2,'B')",[h,other]);await db.query("INSERT INTO people(id,household_id,display_name) VALUES($1,$2,'Fictif')",[p,h]);
 const request=async(body)=>{const response={setHeader(){},writeHead(s){this.status=s;},end(v){this.body=JSON.parse(v);}};await handleRequest({method:'POST',url:'/api/people/'+p+'/serving-cap',headers:{},async *[Symbol.asyncIterator](){yield Buffer.from(JSON.stringify(body));}},response,db);return response;};
 assert.deepEqual((await readServingCaps(db,h)).caps,{});
 assert.equal((await request({householdId:h,mainDishCapG:450})).status,200);assert.equal((await readServingCaps(db,h)).caps[p].plateTotal,450);
 assert.equal((await request({householdId:other,mainDishCapG:600})).status,404);assert.equal((await readServingCaps(db,h)).caps[p].plateTotal,450);
 assert.equal((await request({householdId:h,mainDishCapG:''})).status,200);assert.deepEqual((await readServingCaps(db,h)).caps,{});
 assert.equal((await db.query('SELECT * FROM person_nutrition_goals')).rows.length,0);
 }finally{await db.close();}
});
