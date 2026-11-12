import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {Readable} from 'node:stream';
import {randomUUID,createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {accountGateway} from '../src/server/accounts.mjs';
import {communityRoutes} from '../src/server/community.mjs';
import {handleRequest} from '../src/server/app.mjs';
import {ratingLabel} from '../web/recipe-reviews.js';

async function fixture(t){
 const db=new PGlite();t.after(()=>db.close());
 for(const name of (await readdir(new URL('../db/migrations/',import.meta.url))).filter(n=>n.endsWith('.sql')).sort())await db.exec(await readFile(new URL('../db/migrations/'+name,import.meta.url),'utf8'));
 const pool={async query(sql,args=[]){const result=await db.query(sql,args);return {...result,rowCount:result.affectedRows??result.rows.length};},async connect(){return {...this,release(){}};}};
 const [house,person,memberPerson]=Array.from({length:3},()=>randomUUID());
 await pool.query("INSERT INTO households(id,name) VALUES($1,'First home')",[house]);
 await pool.query("INSERT INTO people(id,household_id,display_name) VALUES($1,$3,'Owner profile'),($2,$3,'Member profile')",[person,memberPerson,house]);
 async function request(method,url,body,cookie){
  const req=Readable.from(body?[JSON.stringify(body)]:[]);Object.assign(req,{method,url,headers:{host:'localhost',cookie},socket:{remoteAddress:randomUUID()}});
  const headers={},res={setHeader(k,v){headers[k]=v;},writeHead(status){this.status=status;},end(data){this.body=JSON.parse(String(data));}};
  await accountGateway(req,res,pool,'setup-password',(req,res,scoped)=>handleRequest(req,res,scoped,'setup-password'),communityRoutes);
  return {status:res.status,body:res.body,cookie:headers['Set-Cookie']?.split(';')[0]};
 }
 const owner=await request('POST','/api/accounts/bootstrap',{applicationPassword:'setup-password',login:'owner',displayName:'Owner',password:'owner-personal-password',householdId:house,personId:person});
 assert.equal(owner.status,201,JSON.stringify(owner.body));
 const member=await request('POST','/api/accounts/members',{login:'member',displayName:'Member',password:'member-personal-password',role:'member',personId:memberPerson},owner.cookie);assert.equal(member.status,201);
 const login=await request('POST','/api/login',{login:'member',password:'member-personal-password'});
 const otherHouse=(await request('POST','/api/accounts/households',{name:'Second home'},owner.cookie)).body.household.id;
 const input={name:'Shared oats',brand:null,foodCategory:'Cereals',aliases:[],nutrientsPer100g:{energyKcal:350,proteinG:12,carbohydrateG:60,fatG:6,fibreG:5},gramsPerUnit:{},gramsPerMillilitre:null,cookingFactor:2};
 const food=await request('POST','/api/foods',input,owner.cookie);assert.equal(food.status,201,JSON.stringify(food.body));
 return {db,pool,request,house,otherHouse,person,memberPerson,owner:owner.cookie,ownerId:owner.body.account.id,member:login.cookie,memberId:member.body.id,foodId:food.body.food.id,input};
}
async function recipes(f,count){
 const result=[];for(let index=0;index<count;index++){
  const id=randomUUID();await f.pool.query("INSERT INTO recipes(id,household_id,name,yield_amount,yield_unit_id) VALUES($1,$2,$3,4,'portion')",[id,f.house,'Recipe '+String(index).padStart(3,'0')]);
  await f.pool.query("INSERT INTO recipe_lines(id,recipe_id,food_id,quantity,unit_id) VALUES($1,$2,$3,100,'g')",[randomUUID(),id,f.foodId]);result.push(id);
 }return result;
}
async function meal(f,recipeId,days=-2,attendee=f.memberPerson,house=f.house){
 const id=randomUUID(),date=new Date(Date.now()+days*86400000).toISOString().slice(0,10);
 await f.pool.query("INSERT INTO planned_meals(id,household_id,meal_date,slot) VALUES($1,$2,$3,'dinner')",[id,house,date]);
 await f.pool.query('INSERT INTO planned_meal_attendees(meal_id,person_id) VALUES($1,$2)',[id,attendee]);
 await f.pool.query('INSERT INTO planned_meal_items(id,meal_id,recipe_id,sort_order) VALUES($1,$2,$3,0)',[randomUUID(),id,recipeId]);return id;
}

test('all foods are common, proposals do not mutate data and approval is admin-only with conflict protection',async t=>{
 const f=await fixture(t),{request,owner,member,foodId,input}=f;
 await request('PUT','/api/accounts/household',{householdId:f.otherHouse},owner);
 assert.equal((await request('GET','/api/foods/'+foodId,null,owner)).status,200);
 await request('PUT','/api/accounts/household',{householdId:f.house},owner);
 const patch={...input,nutrientsPer100g:{...input.nutrientsPer100g,energyKcal:360}};
 assert.equal((await request('PATCH','/api/foods/'+foodId,patch,member)).status,403);
 const proposed=await request('POST','/api/community/food-proposals',{foodId,input:patch,reason:'Label checked'},member);assert.equal(proposed.status,201,JSON.stringify(proposed.body));
 assert.equal((await request('GET','/api/foods/'+foodId,null,member)).body.food.nutrientsPer100g.energyKcal,350);
 assert.equal((await request('PUT','/api/community/food-proposals/'+proposed.body.id,{status:'approved'},member)).status,403);
 const approved=await request('PUT','/api/community/food-proposals/'+proposed.body.id,{status:'approved'},owner);assert.equal(approved.status,200,JSON.stringify(approved.body));
 assert.equal((await request('GET','/api/foods/'+foodId,null,member)).body.food.nutrientsPer100g.energyKcal,360);
 assert.equal((await request('PUT','/api/community/food-proposals/'+proposed.body.id,{status:'approved'},owner)).status,409);
 const stale=await request('POST','/api/community/food-proposals',{foodId,input:patch},member);
 await request('PATCH','/api/foods/'+foodId,{...patch,brand:'Updated'},owner);
 assert.equal((await request('PUT','/api/community/food-proposals/'+stale.body.id,{status:'approved'},owner)).body.error,'food-proposal-stale');
 assert.equal((await request('PUT','/api/community/food-proposals/'+stale.body.id,{status:'rejected'},owner)).status,200);
 const global=await request('GET','/api/accounts/application',null,owner);const membership=global.body.memberships.find(m=>m.accountId!==f.ownerId);
 assert.ok(global.body.profiles.some(p=>p.id===f.memberPerson));
 const role=await request('PUT','/api/accounts/households/'+f.house+'/members',{accountId:membership.accountId,role:'manager',personId:f.memberPerson},owner);assert.equal(role.status,200);
 const added=await request('POST','/api/foods',{...input,name:'New shared food by manager'},member);assert.equal(added.status,201,JSON.stringify(added.body));
 assert.equal((await request('PATCH','/api/foods/'+added.body.food.id,{name:'Cannot edit directly'},member)).status,403);
 const last=await request('PUT','/api/accounts/households/'+f.otherHouse+'/members',{accountId:f.ownerId,role:'member'},owner);assert.equal(last.body.error,'last-household-manager');
 assert.equal((await request('PUT','/api/accounts/households/'+f.otherHouse+'/members',{accountId:membership.accountId,role:'member',personId:f.memberPerson},owner)).status,403);
});

test('large recipe selections publish, refresh and import without duplicate recipes or foods',async t=>{
 const f=await fixture(t),selected=await recipes(f,60);
 const initialFoodCount=(await f.pool.query('SELECT count(*)::int AS n FROM foods')).rows[0].n;
 const published=await f.request('POST','/api/community/publish-batch',{recipeIds:selected},f.owner);assert.equal(published.status,201,JSON.stringify(published.body));assert.equal(published.body.results.length,60);
 assert.equal((await f.request('POST','/api/community/publish-batch',{recipeIds:selected},f.member)).status,403);
 const repeated=await f.request('POST','/api/community/publish-batch',{recipeIds:selected},f.owner);assert.ok(repeated.body.results.every(r=>r.updated));
 assert.equal((await f.pool.query('SELECT count(*)::int AS n FROM shared_publications')).rows[0].n,60);
 assert.equal((await f.request('POST','/api/community/publish-batch',{recipeIds:[selected[0],randomUUID()]},f.owner)).status,404);
 const publicationIds=published.body.results.map(r=>r.id);
 const pack=await f.request('POST','/api/community/packages',{name:'All 60 recipes',publicationIds},f.owner);assert.equal(pack.status,201,JSON.stringify(pack.body));
 await f.request('PUT','/api/accounts/household',{householdId:f.otherHouse},f.owner);
 const imported=await f.request('POST','/api/community/import-batch',{publicationIds},f.owner);assert.equal(imported.status,201,JSON.stringify(imported.body));
 const again=await f.request('POST','/api/community/packages/import',{packageId:pack.body.id,publicationIds},f.owner);assert.equal(again.status,201,JSON.stringify(again.body));assert.ok(again.body.results.every(r=>r.replayed));
 assert.equal((await f.pool.query('SELECT count(*)::int AS n FROM foods')).rows[0].n,initialFoodCount);
 assert.equal((await f.pool.query('SELECT count(*)::int AS n FROM recipes WHERE household_id=$1',[f.otherHouse])).rows[0].n,60);
 assert.equal((await f.request('GET','/api/recipes/'+selected[0],null,f.owner)).status,404);
});

test('a participant can vote once per recipe and meal, revise a vote, and vote again at another meal',async t=>{
 const f=await fixture(t),[recipeId]=await recipes(f,1),mealId=await meal(f,recipeId);
 const [main,starch]=[randomUUID(),randomUUID()];
 await f.pool.query("INSERT INTO recipes(id,household_id,name,yield_amount,yield_unit_id,parent_recipe_id,serving_part) VALUES($1,$3,'Main part',100,'g',$4,'main'),($2,$3,'Starch part',100,'g',$4,'starch')",[main,starch,f.house,recipeId]);
 await f.pool.query('UPDATE planned_meal_items SET recipe_id=$2 WHERE meal_id=$1',[mealId,main]);
 await f.pool.query('INSERT INTO planned_meal_items(id,meal_id,recipe_id,sort_order) VALUES($1,$2,$3,1)',[randomUUID(),mealId,starch]);
 const vote=(score,meal=mealId,cookie=f.member)=>f.request('PUT','/api/community/ratings',{mealId:meal,recipeId,score},cookie);
 assert.equal((await vote(4)).status,200);assert.equal((await vote(5)).status,200);
 let data=(await f.request('GET','/api/community/ratings',null,f.member)).body;assert.equal(data.recipes[0].count,1);assert.equal(data.recipes[0].average,5);assert.equal(data.meals[0].score,5);assert.equal(data.meals.length,1);
 assert.equal((await vote(0)).status,400);assert.equal((await vote(4.5)).status,400);
 assert.equal((await vote(4,await meal(f,recipeId,3))).status,403);
 assert.equal((await vote(4,mealId,f.owner)).status,403);
 const second=await meal(f,recipeId,-1);assert.equal((await vote(3,second)).status,200);
 data=(await f.request('GET','/api/community/ratings',null,f.member)).body;assert.equal(data.recipes[0].count,2);assert.equal(data.recipes[0].average,4);
 const published=await f.request('POST','/api/community/publish-batch',{recipeIds:[recipeId]},f.owner);
 const shared=(await f.request('GET','/api/community',null,f.member)).body.publications[0];assert.equal(Number(shared.ratingAverage),4);assert.equal(shared.ratingCount,2);
 await f.request('PUT','/api/accounts/household',{householdId:f.otherHouse},f.owner);
 const imported=await f.request('POST','/api/community/import-batch',{publicationIds:[published.body.results[0].id]},f.owner);assert.equal(imported.status,201);
 const other=(await f.request('GET','/api/community/ratings',null,f.owner)).body;assert.equal(other.recipes[0].average,4);assert.equal(other.meals.length,0);
 assert.equal((await f.request('DELETE','/api/community/ratings',{mealId,recipeId},f.member)).status,200);
 assert.equal((await f.pool.query('SELECT count(*)::int AS n FROM recipe_reviews')).rows[0].n,1);
 assert.equal(ratingLabel(4.5,2),'★ 4,5 / 5 · 2 avis');assert.equal(ratingLabel(null,0),null);
});


test('migration links the review identity of existing imported and re-shared copies without rewriting recipes',async t=>{
 const db=new PGlite();t.after(()=>db.close());
 for(const name of (await readdir(new URL('../db/migrations/',import.meta.url))).filter(n=>n.endsWith('.sql')&&n<'20261111_community_catalogue_reviews.sql').sort())await db.exec(await readFile(new URL('../db/migrations/'+name,import.meta.url),'utf8'));
 const [a,b,c,ra,rb,rc,pa,pb]=Array.from({length:8},()=>randomUUID());
 await db.query("INSERT INTO households(id,name) VALUES($1,'A'),($2,'B'),($3,'C')",[a,b,c]);
 await db.query("INSERT INTO recipes(id,household_id,name,yield_amount,yield_unit_id) VALUES($1,$4,'Original',4,'portion'),($2,$5,'Private B',5,'portion'),($3,$6,'Private C',6,'portion')",[ra,rb,rc,a,b,c]);
 await db.query("INSERT INTO shared_publications(id,author_household_id,kind,name,payload) VALUES($1,$3,'recipe','Original',$5::jsonb),($2,$4,'recipe','Copy shared again',$6::jsonb)",[pa,pb,a,b,JSON.stringify({rootId:ra,recipes:[]}),JSON.stringify({rootId:rb,recipes:[]})]);
 await db.query('INSERT INTO household_publication_imports(household_id,publication_id,result_id) VALUES($1,$3,$5),($2,$4,$6)',[b,c,pa,pb,rb,rc]);
 await db.exec(await readFile(new URL('../db/migrations/20261111_community_catalogue_reviews.sql',import.meta.url),'utf8'));
 const rows=(await db.query('SELECT id,name,yield_amount,review_key FROM recipes WHERE id=ANY($1::uuid[])',[ [ra,rb,rc] ])).rows;
 assert.equal(rows.length,3);assert.ok(rows.every(r=>r.review_key===ra));
 assert.equal(rows.find(r=>r.id===rb).name,'Private B');assert.equal(Number(rows.find(r=>r.id===rc).yield_amount),6);
});


test('several historical breakfast recipes can be rated, revised and removed consecutively',async t=>{
 const f=await fixture(t);
 // Migration 0009 casts raw MD5 hashes to PostgreSQL UUIDs without RFC version/variant bits.
 const recipeIds=['breakfast-nesquik','breakfast-espresso','breakfast-cappuccino'].map(name=>{
  const hex=createHash('md5').update('11111111-1111-4111-8111-111111111111:'+name).digest('hex');
  return hex.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/,'$1-$2-$3-$4-$5');
 });
 const [first]=await recipes(f,1),mealId=await meal(f,first);
 for(const [index,id] of recipeIds.entries()){
  await f.pool.query("INSERT INTO recipes(id,household_id,name,yield_amount,yield_unit_id) VALUES($1,$2,$3,1,'piece')",[id,f.house,'Historical drink '+index]);
  await f.pool.query('INSERT INTO planned_meal_items(id,meal_id,recipe_id,sort_order) VALUES($1,$2,$3,$4)',[randomUUID(),mealId,id,index+1]);
 }
 const vote=(recipeId,score)=>f.request('PUT','/api/community/ratings',{mealId,recipeId,score},f.member);
 assert.equal((await vote(first,5)).status,200);
 for(const [index,id] of recipeIds.entries()){
  const result=await vote(id,index+2);assert.equal(result.status,200,JSON.stringify(result.body));
 }
 let overview=(await f.request('GET','/api/community/ratings',null,f.member)).body;
 assert.equal(overview.meals.filter(item=>item.mealId===mealId&&item.score!=null).length,4);
 assert.equal((await vote(recipeIds[0],5)).status,200);
 overview=(await f.request('GET','/api/community/ratings',null,f.member)).body;
 assert.equal(overview.recipes.find(item=>item.id===recipeIds[0]).count,1);
 assert.equal(overview.meals.find(item=>item.recipeId===recipeIds[0]).score,5);
 assert.equal((await f.request('DELETE','/api/community/ratings',{mealId,recipeId:recipeIds[0]},f.member)).status,200);
 assert.equal((await vote(recipeIds[1],4.5)).body.error,'invalid-rating');
 assert.equal((await vote('invalid-id',4)).body.error,'invalid-rating');
 assert.equal((await vote(recipeIds[1],6)).body.error,'invalid-rating');
 assert.equal((await f.request('PUT','/api/community/ratings',{mealId,recipeId:recipeIds[1],score:4},f.owner)).status,403);
 assert.equal((await f.pool.query('SELECT count(*)::int AS n FROM recipe_reviews WHERE meal_id=$1',[mealId])).rows[0].n,3);
});


test('recipe ratings can be disabled locally without losing votes, and re-enabled with existing permissions',async t=>{
 const f=await fixture(t),[coffee,cake]=await recipes(f,2),mealId=await meal(f,coffee);
 await f.pool.query('INSERT INTO planned_meal_items(id,meal_id,recipe_id,sort_order) VALUES($1,$2,$3,1)',[randomUUID(),mealId,cake]);
 const vote=(recipeId,score)=>f.request('PUT','/api/community/ratings',{mealId,recipeId,score},f.member);
 assert.equal((await vote(coffee,5)).status,200);assert.equal((await vote(cake,4)).status,200);
 const current=(await f.request('GET','/api/recipes/'+coffee,null,f.owner)).body.recipe;
 assert.equal(current.ratingEnabled,true);
 const input={...current,householdId:f.house,ratingEnabled:false};
 assert.equal((await f.request('PUT','/api/recipes/'+coffee,input,f.member)).status,403);
 let changed=await f.request('PUT','/api/recipes/'+coffee,input,f.owner);assert.equal(changed.status,200,JSON.stringify(changed.body));assert.equal(changed.body.recipe.ratingEnabled,false);
 let overview=(await f.request('GET','/api/community/ratings',null,f.member)).body;
 assert.ok(!overview.recipes.some(item=>item.id===coffee));assert.ok(!overview.meals.some(item=>item.recipeId===coffee));
 assert.ok(overview.recipes.some(item=>item.id===cake));assert.equal((await vote(cake,3)).status,200);
 assert.equal((await vote(coffee,4)).body.error,'recipe-rating-disabled');
 assert.equal((await f.pool.query('SELECT score FROM recipe_reviews WHERE recipe_id=$1',[coffee])).rows[0].score,5);
 const legacy={...input,name:'Coffee edited by an old client'};delete legacy.ratingEnabled;
 changed=await f.request('PUT','/api/recipes/'+coffee,legacy,f.owner);assert.equal(changed.status,200,JSON.stringify(changed.body));assert.equal(changed.body.recipe.ratingEnabled,false);
 assert.equal((await f.request('PUT','/api/recipes/'+coffee,{...input,ratingEnabled:'false'},f.owner)).status,400);
 // A creator has the same editing permission as in the existing recipe editor.
 await f.pool.query('UPDATE recipes SET created_by_account_id=$2 WHERE id=$1',[coffee,f.memberId]);
 changed=await f.request('PUT','/api/recipes/'+coffee,{...input,ratingEnabled:true},f.member);assert.equal(changed.status,200,JSON.stringify(changed.body));
 overview=(await f.request('GET','/api/community/ratings',null,f.member)).body;
 assert.equal(overview.recipes.find(item=>item.id===coffee).count,1);assert.equal(overview.meals.find(item=>item.recipeId===coffee).score,5);
 await f.request('PUT','/api/recipes/'+coffee,input,f.member);
 const published=await f.request('POST','/api/community/publish-batch',{recipeIds:[coffee]},f.owner);assert.equal(published.status,201);
 const publication=(await f.pool.query('SELECT payload FROM shared_publications WHERE id=$1',[published.body.results[0].id])).rows[0].payload;
 assert.equal(publication.recipes.at(-1).ratingEnabled,undefined,'local rating choice must not be published');
 await f.request('PUT','/api/accounts/household',{householdId:f.otherHouse},f.owner);
 const imported=await f.request('POST','/api/community/import-batch',{publicationIds:[published.body.results[0].id]},f.owner);assert.equal(imported.status,201,JSON.stringify(imported.body));
 const copy=(await f.request('GET','/api/recipes/'+imported.body.results[0].id,null,f.owner)).body.recipe;
 assert.equal(copy.ratingEnabled,true,'the other household keeps its own rating preference');
 assert.equal((await f.request('PUT','/api/recipes/'+coffee,{...input,householdId:f.otherHouse},f.owner)).status,404);
});
