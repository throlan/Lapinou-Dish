import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {instructionSteps,validateMethod,preheatReminder,cookingFromText,durationMinutes} from '../src/domain/recipe-method.mjs';
import {parseRecipeText} from '../src/domain/recipe-import.mjs';
import {extractRecipeWithOpenAI,recipeExtractionSchema} from '../src/server/openai-recipe-import.mjs';
import {createRecipe,updateRecipe,readRecipe,validateRecipeInput} from '../src/server/recipes.mjs';
import {saveImportDrafts,listImportDrafts} from '../src/server/recipe-imports.mjs';
import {snapshotPublication,importPublication} from '../src/server/community.mjs';
import {filterRecipeDirectory} from '../web/recipe-directory.js';

test('legacy instructions become ordered editable steps without splitting quantities or losing text',()=>{
 assert.deepEqual(instructionSteps('1. Mélanger.\n\n2) Cuire 35 minutes.\n2 œufs par ramequin.'),['Mélanger.','Cuire 35 minutes.','2 œufs par ramequin.']);
 const huge=Array.from({length:350},(_,i)=>'Action '+i).join('\n');const steps=instructionSteps(huge);assert.equal(steps.length,300);assert.match(steps.at(-1),/Action 349/);
 assert.equal(validateMethod({steps:['Mélanger','Cuire'],cooking:{prepMinutes:20,method:'oven',temperatureC:180}}).data.instructions,'Mélanger\nCuire');
 for(const cooking of [{prepMinutes:-1},{cookMinutes:1.5},{temperatureC:501},{method:'unknown'},{difficulty:'invented'}])assert.ok(validateMethod({cooking}).error);
 assert.ok(validateMethod({steps:['']}).error);assert.ok(validateMethod({steps:['x'.repeat(20001)]}).error);
});

test('preheat is only suggested for explicit oven cooking without rest and is never duplicated',()=>{
 const recipe={steps:['Mélanger','Enfourner'],cooking:{method:'oven',cookMinutes:35,temperatureC:180}};
 assert.equal(preheatReminder(recipe),'Préchauffer le four à 180 °C avant de commencer.');
 assert.equal(preheatReminder({...recipe,cooking:{...recipe.cooking,restMinutes:90}}),null);
 assert.equal(preheatReminder({...recipe,cooking:{...recipe.cooking,method:'hob'}}),null);
 assert.equal(preheatReminder({...recipe,cooking:{...recipe.cooking,cookMinutes:null}}),null);
 assert.equal(preheatReminder({...recipe,steps:['Préchauffer le four à 180°C.','Cuire.']}),null);
 assert.equal(preheatReminder({...recipe,cooking:{...recipe.cooking,restMinutes:0}}),preheatReminder(recipe));
 assert.equal(preheatReminder({...recipe,steps:['Pétrir.','Laisser lever une heure.','Cuire.']}),null);
});

test('plain text import extracts explicit timings, Celsius and difficulty without treating step numbers as durations',()=>{
 const text='Cake\nPréparation : 20 min\nRepos : 1 h 30\nCuisson : 35 min\nDifficulté : Facile\nPour 4 portions\n100 g de farine\nPréparation:\n1. Mélanger.\n2. Cuire au four à 180°C.';
 const parsed=parseRecipeText(text).data;assert.deepEqual(parsed.cooking,{prepMinutes:20,restMinutes:90,cookMinutes:35,method:'oven',temperatureC:180,difficulty:'easy'});
 assert.equal(parsed.steps.length,2);assert.equal(cookingFromText('Préparation:\n1. Mélanger').prepMinutes,undefined);
 assert.equal(cookingFromText('Cuisson : 35 à 45 minutes').cookMinutes,undefined);
 assert.equal(cookingFromText('Four à 350°F').temperatureC,undefined);
 assert.equal(durationMinutes('PT1H30M'),90);assert.equal(durationMinutes('P1DT2H'),1560);assert.equal(durationMinutes('35 à 45 min'),null);
});

test('AI produces structured steps and distinct source timings, persists them in the review draft, and accepts no invented field defaults',async t=>{
 const text='Cake\n100 g farine\nPréparation 20 min. Repos 60 min. Cuisson au four 30 min à 180°C.';
 const payload={name:'Cake',description:'',yieldAmount:4,yieldUnitId:'portion',ingredients:[{rawText:'100 g farine',foodName:'farine',quantity:100,unitId:'g'}],steps:['Mélanger.','Laisser reposer 60 min.','Cuire au four.'],cooking:{prepMinutes:20,restMinutes:60,cookMinutes:30,temperatureC:180,method:'oven',difficulty:null},warnings:[],variants:[]};
 assert.ok(recipeExtractionSchema.required.includes('steps'));assert.ok(recipeExtractionSchema.required.includes('cooking'));assert.equal(recipeExtractionSchema.properties.instructions,undefined,'do not pay twice for the same instructions');
 const extracted=await extractRecipeWithOpenAI(text,null,{apiKey:'fake-test-key',model:'test',fetchImpl:async()=>({ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(payload)}]}]})})});
 assert.equal(extracted.error,undefined);assert.deepEqual(extracted.data.steps,payload.steps);assert.deepEqual(extracted.data.cooking,payload.cooking);
 const {pool,house}=await fixture(t);await saveImportDrafts(pool,house,[extracted.data]);const [draft]=await listImportDrafts(pool,house);assert.deepEqual(draft.steps,payload.steps);assert.deepEqual(draft.cooking,payload.cooking);
});

async function fixture(t){
 const db=new PGlite();t.after(()=>db.close());for(const file of (await readdir(new URL('../db/migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL('../db/migrations/'+file,import.meta.url),'utf8'));
 const pool={async query(sql,args=[]){const r=await db.query(sql,args);return {...r,rowCount:r.affectedRows??r.rows.length};},async connect(){return {...this,release(){}};}};
 const [house,other,food]=Array.from({length:3},()=>randomUUID());await pool.query("INSERT INTO households(id,name) VALUES($1,'A'),($2,'B')",[house,other]);await pool.query("INSERT INTO foods(id,canonical_name,source) VALUES($1,'Fictitious flour','manual')",[food]);
 return {db,pool,house,other,food};
}

test('validated recipes remain editable, retain method metadata on legacy updates and import as unvalidated copies',async t=>{
 const {pool,house,other,food}=await fixture(t);
 const input={householdId:house,name:'Cake',yield:{amount:4,unitId:'portion'},lines:[{foodId:food,quantity:100,unitId:'g'}],steps:['Mélanger.','Cuire.'],cooking:{prepMinutes:20,restMinutes:0,cookMinutes:30,temperatureC:180,method:'oven',difficulty:'easy'},reviewValidated:true};
 let recipe=await createRecipe(pool,validateRecipeInput(input).data);assert.equal(recipe.reviewValidated,true);assert.deepEqual(recipe.steps,input.steps);assert.equal(recipe.cooking.temperatureC,180);
 const prepared=randomUUID();await pool.query("INSERT INTO planned_meals(id,household_id,meal_date,slot,prepared_at) VALUES($1,$2,'2026-11-11','dinner',now())",[prepared,house]);await pool.query('INSERT INTO planned_meal_items(id,meal_id,recipe_id,sort_order) VALUES($1,$2,$3,0)',[randomUUID(),prepared,recipe.id]);
 const legacy={...input,instructions:'Mélanger puis cuire autrement.',lines:[{foodId:food,quantity:150,unitId:'g'}]};delete legacy.steps;delete legacy.cooking;delete legacy.reviewValidated;
 const changed=await updateRecipe(pool,recipe.id,validateRecipeInput(legacy).data);assert.equal(changed.error,undefined);assert.equal(changed.lines[0].quantity,150);assert.equal(changed.reviewValidated,true);assert.equal(changed.cooking.temperatureC,180);assert.deepEqual(changed.steps,['Mélanger puis cuire autrement.']);
 const snapshot=await snapshotPublication(pool,{householdId:house},'recipe',recipe.id);assert.equal(snapshot.recipes.at(-1).reviewValidated,undefined);assert.deepEqual(snapshot.recipes.at(-1).cooking,changed.cooking);
 const publication={id:randomUUID(),name:snapshot.name,payload:snapshot};await pool.query("INSERT INTO shared_publications(id,author_household_id,kind,name,payload) VALUES($1,$2,'recipe',$3,$4::jsonb)",[publication.id,house,snapshot.name,JSON.stringify(snapshot)]);
 const copied=await importPublication(pool,{householdId:other},publication);const imported=await readRecipe(pool,copied.id);assert.equal(imported.reviewValidated,false);assert.deepEqual(imported.steps,changed.steps);assert.deepEqual(imported.cooking,changed.cooking);
 const unchecked=await updateRecipe(pool,recipe.id,validateRecipeInput({...input,reviewValidated:false}).data);assert.equal(unchecked.reviewValidated,false);
 assert.equal(filterRecipeDirectory([changed,unchecked],{validation:'validated'}).length,1);assert.equal(filterRecipeDirectory([changed,unchecked],{validation:'unvalidated'}).length,1);
});

test('migration preserves the original instruction text and starts existing recipes as unvalidated',async t=>{
 const db=new PGlite();t.after(()=>db.close());for(const file of (await readdir(new URL('../db/migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')&&f<'20261111_recipe_method_steps.sql').sort())await db.exec(await readFile(new URL('../db/migrations/'+file,import.meta.url),'utf8'));
 const house=randomUUID(),id=randomUUID();await db.query("INSERT INTO households(id,name) VALUES($1,'A')",[house]);await db.query("INSERT INTO recipes(id,household_id,name,yield_amount,yield_unit_id,instructions) VALUES($1,$2,'Old',4,'portion',$3)",[id,house,'1. Mélanger\n2. Cuire']);
 await db.exec(await readFile(new URL('../db/migrations/20261111_recipe_method_steps.sql',import.meta.url),'utf8'));
 const row=(await db.query('SELECT instructions,instruction_steps,review_validated FROM recipes WHERE id=$1',[id])).rows[0];assert.equal(row.instructions,'1. Mélanger\n2. Cuire');assert.equal(row.instruction_steps,null);assert.equal(row.review_validated,false);
});
