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
import {resolveRecipeChoices} from '../src/server/recipe-choices.mjs';
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

test('choices require real catalogue references, distinct ingredient groups and valid amounts',async t=>{
 const f=await fixture(t),{input,pool}=f;const check=value=>validateRecipeInput(value);
 assert.equal(check(input).error,undefined);
 assert.equal(check({...input,choiceGroups:[{...input.choiceGroups[0],options:[{foodName:'texte libre',quantity:10,unitId:'g'}]}]}).error,'invalid-choice-option');
 assert.equal(check({...input,choiceGroups:[input.choiceGroups[0],{...input.choiceGroups[1],lineIndex:1}]}).error,'invalid-recipe-choices');
 const bad=structuredClone(input);bad.choiceGroups[0].options[1].quantity=-1;assert.equal(check(bad).error,'invalid-quantity');
 const unknown=structuredClone(input);unknown.choiceGroups[0].options[1].foodId=randomUUID();assert.equal((await createRecipe(pool,check(unknown).data)).error,'unknown-choice-food');
 assert.equal((await pool.query('SELECT id FROM recipes')).rows.length,0,'a rejected alternative rolls back the entire recipe');
});

test('dessert flavour and topping resolve once, drive nutrition, shopping and stock, and preserve saved meals',async t=>{
 const {pool,h,person,foods,input}=await fixture(t);
 const source=await createRecipe(pool,validateRecipeInput(input).data);assert.equal(source.nutrition.batch.energyKcal,420);
 assert.equal(source.choiceGroups.length,2);
 const selection={saveur:foods['Pépites chocolat'],topping:foods.Banane};
 const chosen=await resolveRecipeChoices(pool,source.id,h,selection);assert.equal(chosen.nutrition.batch.energyKcal,448);assert.equal(chosen.choiceInstance,true);assert.equal(chosen.choiceGroups.length,0);
 assert.deepEqual(chosen.lines.map(l=>l.foodId),[foods.Lait,foods['Pépites chocolat'],foods.Banane]);
 assert.equal((await resolveRecipeChoices(pool,source.id,h,{topping:foods.Banane,saveur:foods['Pépites chocolat']})).id,chosen.id);
 assert.equal((await pool.query('SELECT id FROM recipes')).rows.length,2,'only the requested combination is materialized');
 await assert.rejects(resolveRecipeChoices(pool,source.id,h,{saveur:foods.Myrtilles}),/choice-selection-required/);
 await assert.rejects(resolveRecipeChoices(pool,source.id,h,{saveur:randomUUID(),topping:foods.Banane}),/invalid-choice-selection/);
 const noTopping=await resolveRecipeChoices(pool,source.id,h,{saveur:foods.Myrtilles,topping:null});assert.equal(noTopping.lines.length,2);assert.equal(noTopping.nutrition.batch.energyKcal,300);
 const mixed=await savePlannedMeal(pool,null,{householdId:h,mealDate:'2026-11-18',slot:'snack',notes:'',attendeeIds:[person],items:[chosen,noTopping].map(r=>({recipeId:r.id,role:'dessert',categoryId:'dessert',amounts:[{personId:person,quantity:1}]}))});assert.equal(mixed.error,'one-recipe-combination-per-meal');
 const meal=await savePlannedMeal(pool,null,{householdId:h,mealDate:'2026-11-17',slot:'snack',notes:'',attendeeIds:[person],items:[{recipeId:chosen.id,role:'dessert',categoryId:'dessert',amounts:[{personId:person,quantity:4}]}]});assert.ok(meal.id);
 const shopping=await listShoppingRequirements(pool,h,'2026-11-16','2026-11-22');assert.ok(shopping.some(x=>x.foodId===foods['Pépites chocolat']));assert.ok(!shopping.some(x=>[foods.Myrtilles,foods.Amandes].includes(x.foodId)));
 for(const foodId of Object.values(foods))await saveIngredientStock(pool,{householdId:h,foodId,quantityG:1000,minimumG:0,targetG:0,leadDays:0,version:0});
 const lot=await addStockLot(pool,{householdId:h,recipeId:chosen.id,quantity:4,producedOn:'2026-11-16',storage:'freezer',note:'',requestId:randomUUID()});assert.equal(lot.error,undefined);
 const stock=await listIngredientStock(pool,h),quantity=id=>stock.find(x=>x.foodId===id).quantityG;
 assert.equal(quantity(foods.Lait),600);assert.equal(quantity(foods['Pépites chocolat']),960);assert.equal(quantity(foods.Banane),940);assert.equal(quantity(foods.Myrtilles),1000);
 const edited=structuredClone(input);edited.lines[0].quantity=800;edited.choiceGroups[0].options[1].quantity=100;
 assert.equal((await updateRecipe(pool,source.id,validateRecipeInput(edited).data)).error,undefined);
 const frozen=await readRecipe(pool,chosen.id);assert.equal(frozen.nutrition.batch.energyKcal,448);assert.equal(frozen.lines[0].quantity,400);
 assert.equal((await listPlannedMeals(pool,h,'2026-11-16')).find(m=>m.id===meal.id).items[0].recipeId,chosen.id);
 assert.equal((await updateRecipe(pool,chosen.id,validateRecipeInput({...input,choiceGroups:[]}).data)).error,'recipe-choice-instance-readonly');
 await assert.rejects(resolveRecipeChoices(pool,source.id,h,selection,source.version),/recipe-version-conflict/);
 const fresh=await resolveRecipeChoices(pool,source.id,h,selection);assert.notEqual(fresh.id,chosen.id);assert.equal(fresh.lines[0].quantity,800);
});


test('choice libraries are private, manager edited, versioned, and shared recipes carry only catalogue-linked choices',async t=>{
 const {pool,h,person,foods,input}=await fixture(t);
 async function request(method,url,body,cookie){const req=Readable.from(body?[JSON.stringify(body)]:[]);Object.assign(req,{method,url,headers:{host:'localhost',cookie},socket:{remoteAddress:randomUUID()}});const headers={},res={setHeader(k,v){headers[k]=v;},writeHead(status){this.status=status;},end(value){this.body=JSON.parse(String(value));}};await accountGateway(req,res,pool,'setup-password',(q,r,p)=>handleRequest(q,r,p,'setup-password'),communityRoutes);return {status:res.status,body:res.body,cookie:headers['Set-Cookie']?.split(';')[0]};}
 const owner=await request('POST','/api/accounts/bootstrap',{applicationPassword:'setup-password',login:'owner',displayName:'Owner',password:'owner-personal-password',householdId:h,personId:person});assert.equal(owner.status,201);
 const member=await request('POST','/api/accounts/members',{login:'member',displayName:'Member',password:'member-personal-password',role:'member'},owner.cookie);assert.equal(member.status,201);const reader=await request('POST','/api/login',{login:'member',password:'member-personal-password'});
 const data={householdId:h,name:'Saveurs',foodIds:[foods.Myrtilles,foods['Pépites chocolat']]};
 assert.equal((await request('POST','/api/recipe-choice-lists',data,reader.cookie)).status,403);
 const created=await request('POST','/api/recipe-choice-lists',data,owner.cookie);assert.equal(created.status,201,JSON.stringify(created.body));const listId=created.body.id;
 let list=(await request('GET','/api/recipe-choice-lists?householdId='+h,null,reader.cookie)).body.lists[0];assert.equal(list.foods.length,2);assert.equal(list.foods[0].name,'Myrtilles');
 assert.equal((await request('PUT','/api/recipe-choice-lists/'+listId,{...data,name:'Saveurs renommées',version:list.version},owner.cookie)).status,200);
 assert.equal((await request('PUT','/api/recipe-choice-lists/'+listId,{...data,version:list.version},owner.cookie)).status,409);
 const sourceInput=structuredClone(input);sourceInput.choiceGroups[0].listId=listId;
 const source=await request('POST','/api/recipes',sourceInput,owner.cookie);assert.equal(source.status,201,JSON.stringify(source.body));
 const selection={saveur:foods['Pépites chocolat'],topping:null};
 const instance=await request('POST','/api/recipes/'+source.body.recipe.id+'/choices/resolve',{householdId:h,selection},reader.cookie);assert.equal(instance.status,200,JSON.stringify(instance.body));assert.equal(instance.body.recipe.choiceInstance,true);
 assert.equal((await request('DELETE','/api/foods/'+foods['Pépites chocolat'],{},owner.cookie)).status,409);
 const publication=await request('POST','/api/community/publish',{kind:'recipe',id:source.body.recipe.id},owner.cookie);assert.equal(publication.status,201,JSON.stringify(publication.body));
 const snapshot=(await request('GET','/api/community/publications/'+publication.body.id,null,reader.cookie)).body.payload;assert.equal(snapshot.recipes.at(-1).choiceGroups[0].listId,null);assert.equal(snapshot.foods.length,5);
 const second=await request('POST','/api/accounts/households',{name:'Other private house'},owner.cookie);assert.equal(second.status,201);const other=second.body.household.id;
 await request('PUT','/api/accounts/household',{householdId:other},owner.cookie);
 assert.deepEqual((await request('GET','/api/recipe-choice-lists?householdId='+other,null,owner.cookie)).body.lists,[]);
 assert.equal((await request('PUT','/api/recipe-choice-lists/'+listId,{...data,householdId:other,version:1},owner.cookie)).status,409);
 assert.equal((await request('POST','/api/recipes/'+source.body.recipe.id+'/choices/resolve',{householdId:other,selection},owner.cookie)).status,404);
 const imported=await request('POST','/api/community/import',{publicationId:publication.body.id},owner.cookie);assert.equal(imported.status,201,JSON.stringify(imported.body));
 const copy=(await request('GET','/api/recipes/'+imported.body.id,null,owner.cookie)).body.recipe;assert.equal(copy.choiceGroups.length,2);assert.equal(copy.choiceGroups[0].listId,null);
 assert.equal((await request('POST','/api/recipes/'+copy.id+'/choices/resolve',{householdId:other,selection},owner.cookie)).status,200);
 await request('PUT','/api/accounts/household',{householdId:h},owner.cookie);
 list=(await request('GET','/api/recipe-choice-lists?householdId='+h,null,owner.cookie)).body.lists[0];assert.equal((await request('DELETE','/api/recipe-choice-lists/'+listId,{householdId:h,version:list.version},owner.cookie)).status,200);
 assert.deepEqual((await request('GET','/api/recipe-choice-lists?householdId='+h,null,owner.cookie)).body.lists,[]);
 const old=await request('POST','/api/recipes/'+source.body.recipe.id+'/choices/resolve',{householdId:h,selection},owner.cookie);assert.equal(old.status,200);assert.equal(old.body.recipe.id,instance.body.recipe.id,'archiving a reusable list preserves recipe snapshots and deduplication');
});


test('choices also preserve independent cooking factors and parts for split main dishes',async t=>{
 const {pool,h,input,foods}=await fixture(t);input.recipeType='dish';input.name='Bowl fictif';input.servingMode='three';input.separateStarch=true;input.cookingFactors={main:1,starch:1,vegetables:1};
 for(const [index,part] of ['main','vegetables','starch'].entries())input.lines[index].servingPart=part;
 input.lines[2].cookingState='legacy';input.lines[2].cookingFactor=2;input.choiceGroups[1].options[1].cookingState='legacy';input.choiceGroups[1].options[1].cookingFactor=3;
 await pool.query('UPDATE foods SET cooking_factor=2 WHERE id=$1',[foods.Amandes]);await pool.query('UPDATE foods SET cooking_factor=3 WHERE id=$1',[foods.Banane]);
 const source=await createRecipe(pool,validateRecipeInput(input).data);assert.equal(source.error,undefined);
 const chosen=await resolveRecipeChoices(pool,source.id,h,{saveur:foods['Pépites chocolat'],topping:foods.Banane});
 assert.equal(chosen.servingParts.length,3);assert.equal(chosen.servingParts.find(p=>p.servingPart==='starch').yield.amount,180);assert.equal(chosen.servingParts.find(p=>p.servingPart==='vegetables').yield.amount,40);
 assert.equal(chosen.servingParts.find(p=>p.servingPart==='starch').lines[0].foodId,foods.Banane);
 assert.equal(source.servingParts.find(p=>p.servingPart==='starch').yield.amount,40);
});


test('an unknown alternative nutrient never becomes zero or invalidates the known default composition',async t=>{
 const {pool,h,input,foods}=await fixture(t);await pool.query("UPDATE food_nutrients SET value_per_100g=NULL WHERE food_id=$1 AND nutrient_id='energy_kcal'",[foods['Pépites chocolat']]);
 const source=await createRecipe(pool,validateRecipeInput(input).data);assert.equal(source.energyKnown,true);
 const chosen=await resolveRecipeChoices(pool,source.id,h,{saveur:foods['Pépites chocolat'],topping:foods.Banane});assert.equal(chosen.energyKnown,false);assert.equal(chosen.nutrition.complete,false);assert.ok(chosen.nutrition.lineIssues.length>0);
});
