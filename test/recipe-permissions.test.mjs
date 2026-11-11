import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {Readable} from 'node:stream';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {accountGateway} from '../src/server/accounts.mjs';
import {communityRoutes} from '../src/server/community.mjs';
import {handleRequest} from '../src/server/app.mjs';
import {recipePermissions} from '../web/recipe-permissions.js';

test('recipe capabilities distinguish creator editing from manager-only photo and duplication',()=>{
 const recipe={createdByAccountId:'author'};
 assert.deepEqual(recipePermissions(recipe,{id:'author',role:'member'}),{curate:false,edit:true,remove:true,rename:true,photo:false,duplicate:false});
 assert.equal(recipePermissions(recipe,{id:'other',role:'member'}).edit,false);
 assert.equal(recipePermissions(recipe,{id:'other',role:'manager'}).photo,true);
 assert.equal(recipePermissions(recipe,{id:'other',role:'member',applicationAdmin:true}).duplicate,true);
 assert.equal(recipePermissions({},null).edit,false);
});

test('API stamps the real creator, preserves authors through revisions and enforces the role matrix on private copies',async t=>{
 const db=new PGlite();t.after(()=>db.close());for(const file of (await readdir(new URL('../db/migrations/',import.meta.url))).filter(n=>n.endsWith('.sql')).sort())await db.exec(await readFile(new URL('../db/migrations/'+file,import.meta.url),'utf8'));
 const pool={async query(sql,args=[]){const result=await db.query(sql,args);return {...result,rowCount:result.rows.length||result.affectedRows||0};},async connect(){return {...this,release(){}};}};
 const house=randomUUID(),person=randomUUID();await pool.query("INSERT INTO households(id,name) VALUES($1,'A')",[house]);await pool.query("INSERT INTO people(id,household_id,display_name) VALUES($1,$2,'Owner')",[person,house]);
 async function request(method,url,body,cookie){
  const req=Readable.from(body?[JSON.stringify(body)]:[]);Object.assign(req,{method,url,headers:{host:'localhost',cookie},socket:{remoteAddress:randomUUID()}});
  const headers={},res={setHeader(k,v){headers[k]=v;},writeHead(status){this.status=status;},end(value){this.body=JSON.parse(String(value));}};
  await accountGateway(req,res,pool,'setup-password',(req,res,scoped)=>handleRequest(req,res,scoped,'setup-password'),communityRoutes);return {status:res.status,body:res.body,cookie:headers['Set-Cookie']?.split(';')[0]};
 }
 const owner=await request('POST','/api/accounts/bootstrap',{applicationPassword:'setup-password',login:'owner',displayName:'Owner',password:'owner-personal-password',householdId:house,personId:person});assert.equal(owner.status,201);
 async function account(login,role){const created=await request('POST','/api/accounts/members',{login,displayName:login,password:login+'-personal-password',role},owner.cookie);assert.equal(created.status,201,JSON.stringify(created.body));const session=await request('POST','/api/login',{login,password:login+'-personal-password'});return {id:created.body.id,cookie:session.cookie};}
 const author=await account('author','manager'),importer=await account('importer','manager'),reader=await account('reader','member');
 const food=(await request('POST','/api/foods',{name:'Flour fixture',nutrientsPer100g:{energyKcal:300},gramsPerUnit:{},aliases:[]},owner.cookie)).body.food.id;
 const input={householdId:house,name:'Original',yield:{amount:4,unitId:'portion'},instructions:'Mix.',lines:[{foodId:food,quantity:100,unitId:'g'}]};
 const created=await request('POST','/api/recipes',{...input,createdByAccountId:owner.body.account.id},author.cookie);assert.equal(created.status,201,JSON.stringify(created.body));let recipe=created.body.recipe;assert.equal(recipe.createdByAccountId,author.id,'the request cannot forge creator ownership');
 const photo={householdId:house,mediaType:'image/png',imageBase64:Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]).toString('base64')};
 assert.equal((await request('PUT','/api/recipes/'+recipe.id+'/image',photo,author.cookie)).status,200);
 const publication=await request('POST','/api/community/publish',{kind:'recipe',id:recipe.id},author.cookie);assert.equal(publication.status,201,JSON.stringify(publication.body));
 const payload=(await request('GET','/api/community/publications/'+publication.body.id,null,reader.cookie)).body.payload;assert.equal(payload.recipes.at(-1).createdByAccountId,undefined);
 const copied=await request('POST','/api/community/import',{publicationId:publication.body.id},importer.cookie);assert.equal(copied.status,201,JSON.stringify(copied.body));
 assert.equal((await request('GET','/api/recipes/'+copied.body.id,null,reader.cookie)).body.recipe.createdByAccountId,importer.id);
 assert.equal((await request('PUT','/api/accounts/members/'+author.id,{role:'member'},owner.cookie)).status,200);
 assert.equal((await request('GET','/api/recipes/'+recipe.id,null,author.cookie)).status,200);
 assert.equal((await request('PATCH','/api/recipes/'+recipe.id,{householdId:house,version:recipe.version,name:'Renamed'},author.cookie)).status,200);
 const edited=await request('PUT','/api/recipes/'+recipe.id,{...input,name:'Edited',lines:[{foodId:food,quantity:150,unitId:'g'}]},author.cookie);assert.equal(edited.status,200,JSON.stringify(edited.body));recipe=edited.body.recipe;assert.equal(recipe.createdByAccountId,author.id);
 for(const [method,path,body] of [['PUT','/api/recipes/'+recipe.id+'/image',photo],['DELETE','/api/recipes/'+recipe.id+'/image',{householdId:house}],['POST','/api/recipes/'+recipe.id+'/image/ai',{householdId:house}],['POST','/api/recipes',input],['PUT','/api/recipes/'+copied.body.id,input]])assert.equal((await request(method,path,body,author.cookie)).status,403,path);
 for(const method of ['PUT','PATCH','DELETE'])assert.equal((await request(method,'/api/recipes/'+recipe.id,{...input,version:recipe.version},reader.cookie)).status,403);
 const meal=randomUUID();await pool.query("INSERT INTO planned_meals(id,household_id,meal_date,slot,prepared_at) VALUES($1,$2,'2026-11-11','dinner',now())",[meal,house]);await pool.query('INSERT INTO planned_meal_items(id,meal_id,recipe_id,sort_order) VALUES($1,$2,$3,0)',[randomUUID(),meal,recipe.id]);
 const revised=await request('PUT','/api/recipes/'+recipe.id,{...input,yield:{amount:100,unitId:'g'}},owner.cookie);assert.equal(revised.status,200,JSON.stringify(revised.body));assert.equal(revised.body.recipe.createdByAccountId,author.id);assert.notEqual(revised.body.recipe.id,recipe.id);
 assert.equal((await request('PUT','/api/recipes/'+revised.body.recipe.id,{...input,yield:{amount:100,unitId:'g'}},author.cookie)).status,200);
 const disposable=await request('POST','/api/recipes',{...input,name:'Delete own'},importer.cookie);assert.equal(disposable.status,201);
 await request('PUT','/api/accounts/members/'+importer.id,{role:'member'},owner.cookie);
 assert.equal((await request('DELETE','/api/recipes/'+disposable.body.recipe.id,{householdId:house,version:disposable.body.recipe.version},importer.cookie)).status,200);
 // An application administrator who is merely a household member still manages recipes.
 await request('PUT','/api/accounts/members/'+reader.id,{role:'manager'},owner.cookie);
 await request('PUT','/api/accounts/members/'+owner.body.account.id,{role:'member',personId:person},owner.cookie);
 assert.equal((await request('PUT','/api/recipes/'+copied.body.id+'/image',photo,owner.cookie)).status,200);
 const adminCopy=await request('POST','/api/recipes',{...input,name:'Admin member copy'},owner.cookie);assert.equal(adminCopy.status,201,JSON.stringify(adminCopy.body));
 // A creator's identity never bypasses the active household boundary.
 await request('PUT','/api/accounts/members/'+author.id,{role:'manager'},owner.cookie);
 const other=(await request('POST','/api/accounts/households',{name:'B',managerId:author.id},owner.cookie)).body.household.id;
 await request('PUT','/api/accounts/household',{householdId:other},author.cookie);
 assert.equal((await request('PUT','/api/recipes/'+revised.body.recipe.id,{...input,householdId:other},author.cookie)).status,404);
});

