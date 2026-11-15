import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createRecipe,updateRecipe,readRecipe,listRecipes,validateRecipeInput} from '../src/server/recipes.mjs';
import {savePlannedMeal} from '../src/server/planning.mjs';
import {addStockLot} from '../src/server/household-planning.mjs';
import {planningPeriod} from '../web/planning-periods.js';
import {validatePlanningCopy,previewPlanningCopy,copyPlanningPeriod,addPlanningSelection} from '../src/server/planning-copy.mjs';
import {createApiClient} from '../web/api-client.js';
import {Readable} from 'node:stream';
import {accountGateway} from '../src/server/accounts.mjs';
import {handleRequest} from '../src/server/app.mjs';
import {communityRoutes} from '../src/server/community.mjs';
import {previewRecipeReplacement,applyRecipeReplacement} from '../src/server/recipe-replacements.mjs';
import {recipeRequirements} from '../src/server/recipe-ingredients.mjs';
import {saveExtraProduction,listExtraProductions,validateExtraProduction} from '../src/server/extra-productions.mjs';
async function fixture(t){
 const db=new PGlite();t.after(()=>db.close());for(const file of (await readdir(new URL('../db/migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL('../db/migrations/'+file,import.meta.url),'utf8'));
 const pool={async query(sql,args=[]){const r=await db.query(sql,args);return {...r,rowCount:r.rows.length||r.affectedRows||0};},async connect(){return {...this,release(){}};}};
 const h=randomUUID(),person=randomUUID(),food=randomUUID();await pool.query("INSERT INTO households(id,name) VALUES($1,'Foyer fictif')",[h]);await pool.query("INSERT INTO people(id,household_id,display_name) VALUES($1,$2,'Personne fictive')",[person,h]);await pool.query("INSERT INTO foods(id,canonical_name,source) VALUES($1,'Aliment fictif','manual')",[food]);
 const input={householdId:h,name:'Recette fictive',productionType:'batch_cooking',yield:{amount:4,unitId:'portion'},lines:[{foodId:food,quantity:100,unitId:'g'}]};
 const recipe=await createRecipe(pool,validateRecipeInput(input).data);
 async function meal(date,slot,quantity,extra={}){const data={householdId:h,mealDate:date,slot,notes:'',attendeeIds:[person],items:[{recipeId:recipe.id,role:'main',amounts:[{personId:person,quantity}]}],...extra};return {data,result:await savePlannedMeal(pool,null,data)};}
 const produce=data=>addStockLot(pool,{householdId:h,recipeId:recipe.id,quantity:4,producedOn:'2026-11-15',storage:'freezer',note:'',requestId:randomUUID(),...data});
 return {pool,h,person,recipe,input,meal,produce};
}
test('replacement review converts explicit units for unprepared meals, preserves prepared meals and lots, and refreshes ingredients',async t=>{
 const f=await fixture(t),future=await f.meal('2026-11-18','lunch',2),prepared=await f.meal('2026-11-19','lunch',1);await f.pool.query('UPDATE planned_meals SET prepared_at=now() WHERE id=$1',[prepared.result.id]);await f.produce({quantity:4});
 const changed=await updateRecipe(f.pool,f.recipe.id,validateRecipeInput({...f.input,yield:{amount:8,unitId:'piece'},outputUnits:{portion:4},lines:[{...f.input.lines[0],quantity:200}]}).data);assert.ok(changed.replacesRecipeId);
 const p=await previewRecipeReplacement(f.pool,f.recipe.id,f.h,'2026-11-16','2026-11-22');assert.equal(p.protectedMeals,1);assert.equal(p.meals.length,1);assert.equal(p.changes[0].proposed,4);
 const result=await applyRecipeReplacement(f.pool,f.recipe.id,f.h,p.start,p.end,p.token,Object.fromEntries(p.changes.map(c=>[c.key,c.proposed])));assert.equal(result.updated,1);
 const rows=(await f.pool.query('SELECT i.recipe_id,a.quantity,m.id FROM planned_meals m JOIN planned_meal_items i ON i.meal_id=m.id JOIN planned_amounts a ON a.planned_item_id=i.id WHERE m.household_id=$1',[f.h])).rows;
 assert.equal(rows.find(r=>r.id===future.result.id).recipe_id,changed.id);assert.equal(Number(rows.find(r=>r.id===future.result.id).quantity),4);assert.equal(rows.find(r=>r.id===prepared.result.id).recipe_id,f.recipe.id);
 assert.equal((await f.pool.query('SELECT recipe_id FROM stock_lots WHERE household_id=$1',[f.h])).rows[0].recipe_id,f.recipe.id);
 const needs=await recipeRequirements(f.pool,f.h,p.start,p.end);assert.equal(needs.foods[0].quantity,100);assert.equal(needs.preparations.find(r=>r.recipeId===changed.id).toMakeQuantity,4);
 await assert.rejects(applyRecipeReplacement(f.pool,f.recipe.id,f.h,p.start,p.end,p.token,Object.fromEntries(p.changes.map(c=>[c.key,c.proposed]))),/replacement-preview-stale/);
});
test('unknown unit equivalence requires manual quantities; preview changes cannot partially update menus',async t=>{
 const f=await fixture(t);await f.meal('2026-11-18','lunch',2);const changed=await updateRecipe(f.pool,f.recipe.id,validateRecipeInput({...f.input,yield:{amount:8,unitId:'piece'}}).data);const p=await previewRecipeReplacement(f.pool,f.recipe.id,f.h,'2026-11-16','2026-11-22');assert.equal(p.changes[0].proposed,null);
 await assert.rejects(applyRecipeReplacement(f.pool,f.recipe.id,f.h,p.start,p.end,p.token,{}),/replacement-quantities-required/);
 await assert.rejects(previewRecipeReplacement(f.pool,f.recipe.id,randomUUID(),p.start,p.end),/recipe-not-found/);
 assert.equal((await f.pool.query('SELECT recipe_id FROM planned_meal_items')).rows[0].recipe_id,f.recipe.id);
 assert.equal((await applyRecipeReplacement(f.pool,f.recipe.id,f.h,p.start,p.end,p.token,{[p.changes[0].key]:3})).updated,1);
 assert.equal((await f.pool.query('SELECT recipe_id FROM planned_meal_items')).rows[0].recipe_id,changed.id);
});
test('extra production keeps its type and enters requirements once without becoming a planned meal',async t=>{
 const f=await fixture(t);const input=validateExtraProduction({householdId:f.h,recipeId:f.recipe.id,plannedOn:'2026-11-16',quantity:12,storage:'freezer'}).data;assert.ok(await saveExtraProduction(f.pool,input));
 const plans=await listExtraProductions(f.pool,f.h,'2026-11-15','2026-11-30');assert.equal(plans[0].productionType,'batch_cooking');
 const needs=await recipeRequirements(f.pool,f.h,'2026-11-16','2026-11-22');assert.equal(needs.foods[0].quantity,300);assert.equal(needs.preparations.length,0);assert.equal((await f.pool.query('SELECT count(*) AS n FROM planned_meals')).rows[0].n,0);
});
