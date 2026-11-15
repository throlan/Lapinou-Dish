import {variantNutritionValues} from '../web/recipe-choices.js';
import {Readable} from 'node:stream';
import {accountGateway} from '../src/server/accounts.mjs';
import {handleRequest} from '../src/server/app.mjs';
import {communityRoutes} from '../src/server/community.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {createRecipe,readRecipe,updateRecipe,validateRecipeInput} from '../src/server/recipes.mjs';
import {resolveRecipeChoices,previewRecipeChoices} from '../src/server/recipe-choices.mjs';
import {savePlannedMeal,listPlannedMeals} from '../src/server/planning.mjs';
import {addStockLot,listShoppingRequirements} from '../src/server/household-planning.mjs';
import {saveIngredientStock,listIngredientStock} from '../src/server/ingredient-stock.mjs';

async function fixture(t){
 const db=new PGlite();t.after(()=>db.close());for(const file of (await readdir(new URL('../db/migrations/',import.meta.url))).filter(n=>n.endsWith('.sql')).sort())await db.exec(await readFile(new URL('../db/migrations/'+file,import.meta.url),'utf8'));
 const pool={async query(sql,args=[]){const r=await db.query(sql,args);return {...r,rowCount:r.rows.length||r.affectedRows||0};},async connect(){return {...this,release(){}};}};
 const h=randomUUID(),person=randomUUID();await pool.query("INSERT INTO households(id,name) VALUES($1,'Foyer fictif')",[h]);await pool.query("INSERT INTO people(id,household_id,display_name) VALUES($1,$2,'Personne fictive')",[person,h]);
 const foods={};for(const [name,kcal] of [['Lait',50],['Myrtilles',100],['Pépites chocolat',500],['Amandes',600],['Banane',80]]){
  const id=randomUUID();foods[name]=id;await pool.query("INSERT INTO foods(id,canonical_name,source,cooking_factor) VALUES($1,$2,'manual',1)",[id,name]);
  for(const [nutrient,value] of [['energy_kcal',kcal],['protein_g',1],['carbohydrate_g',5],['fat_g',1],['fibre_g',1]])await pool.query('INSERT INTO food_nutrients(food_id,nutrient_id,value_per_100g) VALUES($1,$2,$3)',[id,nutrient,value]);
 }
 const line=(name,quantity)=>({foodId:foods[name],quantity,unitId:'g',cookingState:'served_raw',foodName:name});
 const groups=[{id:'saveur',label:'Saveur',lineIndex:1,options:[line('Myrtilles',100),line('Pépites chocolat',40)]},{id:'topping',label:'Topping',lineIndex:2,allowNone:true,options:[line('Amandes',20),line('Banane',60)]}];
 const input={householdId:h,name:'Flan',recipeType:'dessert',productionType:'batch_cooking',yield:{amount:4,unitId:'portion'},lines:[line('Lait',400),line('Myrtilles',100),line('Amandes',20)],choiceGroups:groups};
 return {db,pool,h,person,foods,input};
}

test('nutrition previews match materialized choices without creating any recipe or meal',async t=>{
 const {db,pool,h,input,foods}=await fixture(t);const source=await createRecipe(pool,validateRecipeInput(input).data);
 const selections=[{saveur:foods.Myrtilles,topping:foods.Amandes},{saveur:foods['Pépites chocolat'],topping:foods.Banane},{saveur:foods.Myrtilles,topping:null}];
 for(const selection of selections){const before=(await pool.query('SELECT count(*) AS n FROM recipes')).rows[0].n;const preview=await previewRecipeChoices(pool,source.id,h,selection,source.version);assert.equal((await pool.query('SELECT count(*) AS n FROM recipes')).rows[0].n,before);const chosen=await resolveRecipeChoices(pool,source.id,h,selection,source.version);assert.deepEqual(preview.nutrition,chosen.nutrition);assert.equal(preview.servingWeightG,chosen.servingWeightG);assert.equal(preview.energyKnown,chosen.energyKnown);}
 await assert.rejects(previewRecipeChoices(pool,source.id,h,selections[0],source.version+1),/recipe-version-conflict/);await assert.rejects(previewRecipeChoices(pool,source.id,'11111111-1111-4111-8111-111111111111',selections[0],source.version),/recipe-not-found/);await assert.rejects(previewRecipeChoices(pool,source.id,h,{},source.version),/choice-selection-required/);
});
test('split recipe previews keep selected cooking states and incomplete nutrients',async t=>{
 const {db,pool,h,input,foods}=await fixture(t);
 const split={...input,recipeType:'dish',separateStarch:true,servingMode:'three',lines:input.lines.map((l,i)=>({...l,servingPart:['main','starch','vegetables'][i]})),choiceGroups:input.choiceGroups.map(g=>({...g,options:g.options.map(o=>({...o,cookingState:'cooked_from_raw',cookingFactor:2}))}))};
 const source=await createRecipe(pool,validateRecipeInput(split).data);assert.ok(source.id);const selection={saveur:foods['Pépites chocolat'],topping:foods.Banane};const preview=await previewRecipeChoices(pool,source.id,h,selection,source.version),chosen=await resolveRecipeChoices(pool,source.id,h,selection,source.version);assert.deepEqual(preview.nutrition,chosen.nutrition);assert.equal(preview.servingWeightG,chosen.servingWeightG);
 await pool.query("DELETE FROM food_nutrients WHERE food_id=$1 AND nutrient_id='energy_kcal'",[foods['Pépites chocolat']]);const missing=await previewRecipeChoices(pool,source.id,h,selection,source.version);assert.equal(missing.nutrition.complete,false);assert.equal(missing.energyKnown,false);
});

test('presentation uses 100 g for gram recipes and never turns missing energy into zero',()=>{
 const p={yield:{amount:1000,unitId:'g'},nutrition:{complete:false,batch:{energyKcal:500},perYieldUnit:{energyKcal:.5,proteinG:.1,carbohydrateG:0,fatG:.02,fibreG:null},lineIssues:[{reason:'nutrient-data-missing',missingNutrients:['fibreG']}]},servingWeightG:1000,energyKnown:true};const values=variantNutritionValues(p);assert.equal(values.label,'100 g');assert.equal(values.values.energyKcal,50);assert.equal(values.values.carbohydrateG,0);assert.equal(values.values.fibreG,null);p.energyKnown=false;assert.equal(variantNutritionValues(p).values.energyKcal,null);assert.equal(variantNutritionValues(p).badge,null);
});
test('members can preview their own household recipes without creating snapshots or menus',async t=>{
 const {pool,h,person,input,foods}=await fixture(t),source=await createRecipe(pool,validateRecipeInput(input).data);
 async function request(method,url,body,cookie){const req=Readable.from(body?[JSON.stringify(body)]:[]);Object.assign(req,{method,url,headers:{host:'localhost',cookie},socket:{remoteAddress:randomUUID()}});const headers={},res={setHeader(k,v){headers[k]=v;},writeHead(status){this.status=status;},end(value){this.body=JSON.parse(String(value));}};await accountGateway(req,res,pool,'setup-password',(q,r,p)=>handleRequest(q,r,p,'setup-password'),communityRoutes);return {status:res.status,body:res.body,cookie:headers['Set-Cookie']?.split(';')[0]};}
 const owner=await request('POST','/api/accounts/bootstrap',{applicationPassword:'setup-password',login:'owner',displayName:'Owner',password:'owner-personal-password',householdId:h,personId:person});assert.equal(owner.status,201);await request('POST','/api/accounts/members',{login:'reader',displayName:'Reader',password:'reader-personal-password',role:'member'},owner.cookie);const reader=await request('POST','/api/login',{login:'reader',password:'reader-personal-password'});
 const url='/api/recipes/'+source.id+'/choices/preview?householdId='+h+'&version='+source.version+'&selection='+encodeURIComponent(JSON.stringify({saveur:foods.Myrtilles,topping:null})),before=(await pool.query('SELECT count(*) AS n FROM recipes')).rows[0].n;assert.equal((await request('GET',url,null,reader.cookie)).status,200);assert.equal((await request('GET',url.replace(h,randomUUID()),null,reader.cookie)).status,403);assert.equal((await request('GET',url)).status,401);assert.equal((await pool.query('SELECT count(*) AS n FROM recipes')).rows[0].n,before);assert.equal((await pool.query('SELECT count(*) AS n FROM planned_meals')).rows[0].n,0);
});

test('preview keeps prepared ingredients and their weights identical to the chosen recipe',async t=>{
 const {pool,h,input,foods}=await fixture(t),component=await createRecipe(pool,validateRecipeInput({...input,name:'Préparation liée',productionType:'none',choiceGroups:[],yield:{amount:1,unitId:'portion'},lines:[input.lines[0]]}).data);
 const source=await createRecipe(pool,validateRecipeInput({...input,lines:[{recipeId:component.id,quantity:1,unitId:'portion'},...input.lines.slice(1)]}).data),selection={saveur:foods['Pépites chocolat'],topping:foods.Banane};const preview=await previewRecipeChoices(pool,source.id,h,selection,source.version),chosen=await resolveRecipeChoices(pool,source.id,h,selection,source.version);assert.deepEqual(preview.nutrition,chosen.nutrition);assert.equal(preview.servingWeightG,chosen.servingWeightG);
});
