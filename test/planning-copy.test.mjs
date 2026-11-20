import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createRecipe,readRecipe,listRecipes,validateRecipeInput} from '../src/server/recipes.mjs';
import {savePlannedMeal} from '../src/server/planning.mjs';
import {addStockLot} from '../src/server/household-planning.mjs';
import {planningPeriod} from '../web/planning-periods.js';
import {validatePlanningCopy,previewPlanningCopy,copyPlanningPeriod,addPlanningSelection,addPlanningDay} from '../src/server/planning-copy.mjs';
import {createApiClient} from '../web/api-client.js';
import {Readable} from 'node:stream';
import {accountGateway} from '../src/server/accounts.mjs';
import {handleRequest} from '../src/server/app.mjs';
import {communityRoutes} from '../src/server/community.mjs';
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
test('planning presets use complete calendar weeks, next two weeks and leap months',()=>{
 assert.deepEqual(planningPeriod('2026-11-15','week'),{start:'2026-11-09',end:'2026-11-15'});
 assert.deepEqual(planningPeriod('2026-11-15','next-week'),{start:'2026-11-16',end:'2026-11-22'});
 assert.deepEqual(planningPeriod('2026-12-31','next-fortnight'),{start:'2027-01-04',end:'2027-01-17'});
 assert.deepEqual(planningPeriod('2028-02-28','month'),{start:'2028-02-01',end:'2028-02-29'});
});
test('multi-date planning is atomic, retains exact quantities and is durably idempotent',async t=>{
 const f=await fixture(t),data={householdId:f.h,requestId:randomUUID(),meal:{attendeeIds:[f.person],items:[{recipeId:f.recipe.id,role:'main',amounts:[{personId:f.person,quantity:2.5}]}]},targets:[{date:'2026-11-18',slot:'dinner'},{date:'2026-11-21',slot:'dinner'}]};
 const result=await addPlanningSelection(f.pool,data);assert.equal(result.mealIds.length,2);
 assert.equal((await addPlanningSelection(f.pool,data)).replayed,true);
 assert.equal((await addPlanningSelection(f.pool,{...data,targets:[data.targets[0]]})).error,'planning-request-conflict');
 const before=(await f.pool.query('SELECT * FROM planned_meals WHERE household_id=$1',[f.h])).rows;
 assert.equal((await addPlanningSelection(f.pool,{...data,requestId:randomUUID(),targets:[{date:'2026-11-19',slot:'dinner'},data.targets[0]]})).error,'planning-slot-unavailable');
 assert.deepEqual((await f.pool.query('SELECT * FROM planned_meals WHERE household_id=$1',[f.h])).rows,before);
 const amounts=await f.pool.query('SELECT quantity FROM planned_amounts a JOIN planned_meal_items i ON i.id=a.planned_item_id JOIN planned_meals m ON m.id=i.meal_id WHERE m.household_id=$1',[f.h]);assert.deepEqual(amounts.rows.map(a=>Number(a.quantity)),[2.5,2.5]);
 // A later invalid reference rolls back earlier copies in the same transaction.
 const broken={...data,requestId:randomUUID(),targets:[{date:'2026-11-24',slot:'lunch'}],meal:{...data.meal,attendeeIds:[randomUUID()]}};assert.equal((await addPlanningSelection(f.pool,broken)).error,'invalid-planned-amount-person');
 assert.equal((await f.pool.query('SELECT count(*) AS n FROM planned_meals WHERE household_id=$1',[f.h])).rows[0].n,2);
});
test('day/week copies preserve all slots, additions and people, with no prepared state or stock mutation',async t=>{
 const f=await fixture(t),a=await f.meal('2026-11-16','lunch',2),b=await f.meal('2026-11-16','dinner',3);
 await f.pool.query('UPDATE planned_meals SET prepared_at=now() WHERE id=$1',[a.result.id]);
 await f.meal('2026-11-18','snack',1);await f.meal('2026-11-22','dinner',4);
 const input={householdId:f.h,sourceStart:'2026-11-16',targetStart:'2026-12-28',days:7};assert.ok(validatePlanningCopy(input).data);
 const preview=await previewPlanningCopy(f.pool,input);assert.equal(preview.meals.length,4);assert.deepEqual(preview.conflicts,[]);assert.ok(preview.meals.some(m=>m.date==='2027-01-03'));
 const result=await copyPlanningPeriod(f.pool,{...input,fingerprint:preview.fingerprint,requestId:randomUUID()});assert.equal(result.mealIds.length,4);
 const rows=await f.pool.query('SELECT prepared_at FROM planned_meals WHERE id=ANY($1::uuid[])',[result.mealIds]);assert.ok(rows.rows.every(r=>r.prepared_at===null));
 assert.equal((await f.pool.query('SELECT count(*) AS n FROM recipe_stock_uses')).rows[0].n,0);
 const day={...input,targetStart:'2026-11-17',days:1},p=await previewPlanningCopy(f.pool,day);assert.equal(p.meals.length,2);assert.equal((await copyPlanningPeriod(f.pool,{...day,fingerprint:p.fingerprint,requestId:randomUUID()})).mealIds.length,2);
 assert.equal((await previewPlanningCopy(f.pool,day)).conflicts.length,2);
 const changed={...input,targetStart:'2027-01-04'},c=await previewPlanningCopy(f.pool,changed);await f.pool.query("UPDATE planned_meals SET notes='modification' WHERE id=$1",[b.result.id]);assert.equal((await copyPlanningPeriod(f.pool,{...changed,fingerprint:c.fingerprint,requestId:randomUUID()})).error,'copy-source-changed');
 assert.equal(validatePlanningCopy({...input,targetStart:input.sourceStart}).error,'copy-periods-overlap');assert.equal(validatePlanningCopy({...input,targetStart:'2026-11-17'}).error,'copy-week-must-start-monday');
 assert.equal((await previewPlanningCopy(f.pool,{...input,householdId:randomUUID()})).meals.length,0);
});
test('catalogue bulk reader is equivalent to individual reads and query count stays bounded',async t=>{
 const f=await fixture(t);for(let i=0;i<8;i++)await createRecipe(f.pool,validateRecipeInput({...f.input,name:'Recette '+i}).data);
 const split=await createRecipe(f.pool,validateRecipeInput({...f.input,name:'Séparé',separateStarch:true,servingMode:'three',lines:[{...f.input.lines[0],servingPart:'main'},{...f.input.lines[0],servingPart:'starch',cookingFactor:2},{...f.input.lines[0],servingPart:'vegetables'}]}).data);assert.equal(split.servingParts.length,3);
 const component=await createRecipe(f.pool,validateRecipeInput({...f.input,name:'Composition',lines:[{recipeId:f.recipe.id,quantity:1,unitId:'portion'}]}).data);assert.ok(component.id);
 let count=0;const pool={query(...args){count++;return f.pool.query(...args);}};
 const all=await listRecipes(pool,f.h);assert.ok(count<=5,'one snapshot instead of queries for each recipe');
 for(const r of all)assert.deepEqual(r,await readRecipe(f.pool,r.id));assert.ok(all.some(r=>r.id===component.id));
});
test('API shares reads, caches recipes briefly and invalidates on writes, never caches errors',async()=>{
 let calls=0,clock=0,release;const api=createApiClient(async()=>{calls++;return {ok:true,json:async()=>({recipes:[{name:'test'}]})};},()=>clock);
 const [a,b]=await Promise.all([api('/api/recipes?householdId=a'),api('/api/recipes?householdId=a')]);assert.equal(calls,1);a.recipes[0].name='edited';assert.equal(b.recipes[0].name,'test');
 await api('/api/recipes?householdId=a');assert.equal(calls,1);clock=61000;await api('/api/recipes?householdId=a');assert.equal(calls,2);
 await api('/api/planning/selection',{method:'POST'});await api('/api/recipes?householdId=a');assert.equal(calls,4);
 const flaky=createApiClient(async()=>{throw new Error('network');});await assert.rejects(flaky('/api/recipes?householdId=a'));await assert.rejects(flaky('/api/recipes?householdId=a'));
 const slow=createApiClient(async(path,options)=>{if(options.method==='POST')return {ok:true,json:async()=>({})};return new Promise(r=>release=r);});
 const pending=slow('/api/recipes?householdId=a');await slow('/write',{method:'POST'});release({ok:true,json:async()=>({old:true})});await pending;
 let resolved=false;const again=slow('/api/recipes?householdId=a').then(()=>resolved=true);await Promise.resolve();assert.equal(resolved,false);release({ok:true,json:async()=>({new:true})});await again;
});
test('a later copy error rolls back every earlier insertion; a newly occupied target aborts the whole copy',async t=>{
 const f=await fixture(t);await f.meal('2026-11-16','lunch',2);const other=randomUUID();await f.pool.query("INSERT INTO people(id,household_id,display_name) VALUES($1,$2,'Autre')",[other,f.h]);await f.meal('2026-11-16','dinner',3,{attendeeIds:[other],items:[{recipeId:f.recipe.id,role:'main',amounts:[{personId:other,quantity:3}]}]});
 const input={householdId:f.h,sourceStart:'2026-11-16',targetStart:'2026-11-23',days:1},p=await previewPlanningCopy(f.pool,input);
 await f.pool.query('UPDATE people SET active=false WHERE id=$1',[f.person]);
 assert.equal((await copyPlanningPeriod(f.pool,{...input,fingerprint:p.fingerprint,requestId:randomUUID()})).error,'attendee-not-in-household');
 assert.equal((await f.pool.query("SELECT count(*) AS n FROM planned_meals WHERE household_id=$1 AND meal_date='2026-11-23'",[f.h])).rows[0].n,0);
 await f.pool.query('UPDATE people SET active=true WHERE id=$1',[f.person]);await f.meal('2026-11-23','lunch',1);
 assert.equal((await copyPlanningPeriod(f.pool,{...input,fingerprint:p.fingerprint,requestId:randomUUID()})).error,'planning-slot-unavailable');
 assert.equal((await f.pool.query("SELECT count(*) AS n FROM planned_meals WHERE household_id=$1 AND meal_date='2026-11-23'",[f.h])).rows[0].n,1);
});
test('new planning operations require a manager and keep household boundaries through HTTP',async t=>{
 const f=await fixture(t);await f.meal('2026-11-16','lunch',2);
 async function request(method,url,body,cookie){const req=Readable.from(body?[JSON.stringify(body)]:[]);Object.assign(req,{method,url,headers:{host:'localhost',cookie},socket:{remoteAddress:randomUUID()}});const headers={},res={setHeader(k,v){headers[k]=v;},writeHead(status){this.status=status;},end(value){this.body=JSON.parse(String(value));}};await accountGateway(req,res,f.pool,'setup-password',(q,r,p)=>handleRequest(q,r,p,'setup-password'),communityRoutes);return {status:res.status,body:res.body,cookie:headers['Set-Cookie']?.split(';')[0]};}
 const owner=await request('POST','/api/accounts/bootstrap',{applicationPassword:'setup-password',login:'owner',displayName:'Owner',password:'owner-personal-password',householdId:f.h,personId:f.person});assert.equal(owner.status,201);
 await request('POST','/api/accounts/members',{login:'reader',displayName:'Reader',password:'reader-personal-password',role:'member'},owner.cookie);const reader=await request('POST','/api/login',{login:'reader',password:'reader-personal-password'});
 const input={householdId:f.h,sourceStart:'2026-11-16',targetStart:'2026-11-23',days:7};
 assert.equal((await request('POST','/api/planning/copy-preview',input)).status,401);
 for(const path of ['copy-preview','copy','selection'])assert.equal((await request('POST','/api/planning/'+path,input,reader.cookie)).status,403);
 assert.equal((await request('POST','/api/planning/copy-preview',{...input,householdId:randomUUID()},owner.cookie)).status,403);
 const preview=await request('POST','/api/planning/copy-preview',input,owner.cookie);assert.equal(preview.status,200);assert.equal(preview.body.meals.length,1);
 const payload={...input,fingerprint:preview.body.fingerprint,requestId:randomUUID()};const copied=await request('POST','/api/planning/copy',payload,owner.cookie);assert.equal(copied.status,201);assert.equal(copied.body.mealIds.length,1);assert.equal((await request('POST','/api/planning/copy',payload,owner.cookie)).body.replayed,true);
});

test('a daily selection saves distinct participants and portions once and rejects any occupied slot atomically',async t=>{
 const f=await fixture(t), other=randomUUID();
 await f.pool.query("INSERT INTO people(id,household_id,display_name) VALUES($1,$2,'Autre personne')",[other,f.h]);
 const item=(personId,quantity)=>({recipeId:f.recipe.id,role:'main',amounts:[{personId,quantity}]});
 const day={householdId:f.h,date:'2026-11-25',requestId:randomUUID(),meals:[
  {slot:'lunch',attendeeIds:[f.person],items:[item(f.person,1)]},
  {slot:'dinner',attendeeIds:[other],items:[item(other,2)]}
 ]};
 const saved=await addPlanningDay(f.pool,day);assert.equal(saved.mealIds.length,2);
 assert.equal((await addPlanningDay(f.pool,day)).replayed,true);
 const rows=(await f.pool.query('SELECT m.slot,a.person_id,a.quantity FROM planned_meals m JOIN planned_meal_items i ON i.meal_id=m.id JOIN planned_amounts a ON a.planned_item_id=i.id ORDER BY m.slot')).rows;
 assert.deepEqual(rows.map(r=>[r.slot,r.person_id,Number(r.quantity)]),[['dinner',other,2],['lunch',f.person,1]]);
 const conflict=await addPlanningDay(f.pool,{...day,requestId:randomUUID(),meals:[{...day.meals[0],slot:'breakfast'},day.meals[1]]});
 assert.equal(conflict.error,'planning-slot-unavailable');
 assert.equal((await f.pool.query("SELECT id FROM planned_meals WHERE slot='breakfast'")).rows.length,0);
});

test('real daily macros persist across requests, preserve unknown values and reject writes to another household',async t=>{
 const f=await fixture(t);
 const endpoint='/api/people/'+f.person+'/daily-macros', date='2026-11-19';
 async function request(method,url,body){
  const req=Readable.from(body?[JSON.stringify(body)]:[]);
  Object.assign(req,{method,url,headers:{}});
  const res={setHeader(){},writeHead(status){this.status=status;},end(value){this.body=JSON.parse(String(value));}};
  await handleRequest(req,res,f.pool);
  return res;
 }
 const saved=await request('POST',endpoint,{householdId:f.h,date,carbohydrateG:92.5,fatG:null});
 assert.equal(saved.status,200);
 const url=endpoint+'?'+new URLSearchParams({householdId:f.h,date});
 assert.deepEqual((await request('GET',url)).body,{intake:{carbohydrateG:92.5,fatG:null}});
 assert.equal((await request('POST',endpoint,{householdId:randomUUID(),date,carbohydrateG:1,fatG:1})).status,404);
 assert.equal((await request('POST',endpoint,{householdId:f.h,date,carbohydrateG:-1,fatG:1})).status,400);
 assert.deepEqual((await request('POST',endpoint,{householdId:f.h,date,carbohydrateG:null,fatG:null})).body,{intake:null});
});
