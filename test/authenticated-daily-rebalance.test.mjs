import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {Readable} from 'node:stream';
import {accountGateway} from '../src/server/accounts.mjs';
import {handleRequest} from '../src/server/app.mjs';
import {communityRoutes} from '../src/server/community.mjs';
import {createRecipe,validateRecipeInput} from '../src/server/recipes.mjs';
import {resolveRecipeChoices} from '../src/server/recipe-choices.mjs';
import {savePlannedMeal} from '../src/server/planning.mjs';

test('authenticated daily rebalance removes only Bibinette’s muffin, preserves the variant and rolls back stale/conflicting writes',async t=>{
 const db=new PGlite();t.after(()=>db.close());for(const file of (await readdir(new URL('../db/migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL('../db/migrations/'+file,import.meta.url),'utf8'));
 const errors=[];let serializationAtCommit=false;
 const pool={async query(sql,args=[]){try{
  if(serializationAtCommit&&sql==='COMMIT'){serializationAtCommit=false;throw Object.assign(new Error('simulated serialization conflict'),{code:'40001'});}
  const r=await db.query(sql,args);return {...r,rowCount:r.rows.length||r.affectedRows||0};
 }catch(e){errors.push({sql:sql.split('\n')[0],message:e.message});throw e;}},async connect(){return {...this,release(){}};}};
 const h=randomUUID(),food=randomUUID(),topping=randomUUID(),people=Array.from({length:4},()=>randomUUID()),date='2026-11-17';
 await pool.query("INSERT INTO households(id,name) VALUES($1,'Foyer fictif')",[h]);
 for(const [i,id] of people.entries()){
  await pool.query('INSERT INTO people(id,household_id,display_name,birth_date) VALUES($1,$2,$3,$4)',[id,h,['Bibinette','Lapinou','Bibou','Titus'][i],i<2?'1980-01-01':'2010-01-01']);
  await pool.query("INSERT INTO person_profile_history(id,person_id,effective_from,daily_energy_kcal,daily_energy_origin) VALUES($1,$2,'2026-01-01',$3,'manual')",[randomUUID(),id,[1300,1750,2300,1800][i]]);
 }
 for(const [id,name] of [[food,'Base fictive'],[topping,'Pépites fictives']]){await pool.query("INSERT INTO foods(id,canonical_name,source) VALUES($1,$2,'manual')",[id,name]);for(const [n,v] of [['energy_kcal',100],['protein_g',5],['carbohydrate_g',10],['fat_g',2],['fibre_g',1]])await pool.query('INSERT INTO food_nutrients(food_id,nutrient_id,value_per_100g) VALUES($1,$2,$3)',[id,n,v]);}
 const line=(foodId,quantity)=>({foodId,quantity,unitId:'g'});
 const main=await createRecipe(pool,validateRecipeInput({householdId:h,name:'Plat fictif',yield:{amount:1,unitId:'portion'},lines:[line(food,100)]}).data);
 const template=await createRecipe(pool,validateRecipeInput({householdId:h,name:'Muffins',recipeType:'dessert',productionType:'batch_cooking',yield:{amount:1,unitId:'piece'},minimumProductionAmount:6,minimumProductionUnitId:'piece',lines:[line(food,144.4),line(topping,80)],choiceGroups:[{id:'topping',label:'topping',lineIndex:1,options:[line(topping,80)]}]}).data);
 const variant=await resolveRecipeChoices(pool,template.id,h,{topping});
 const amounts=people.map((personId,i)=>({personId,quantity:[12.424,13.02,14.249,14.457][i]}));
 await savePlannedMeal(pool,null,{householdId:h,mealDate:date,slot:'lunch',notes:'Conserver',attendeeIds:people,items:[{recipeId:main.id,role:'main',amounts}]});
 const snack=await savePlannedMeal(pool,null,{householdId:h,mealDate:date,slot:'snack',notes:'Topping conservé',attendeeIds:people,items:[{recipeId:variant.id,role:'dessert',categoryId:'patisserie',amounts:people.map(personId=>({personId,quantity:1}))}]});
 async function request(method,url,body,cookie){const req=Readable.from(body?[JSON.stringify(body)]:[]);Object.assign(req,{method,url,headers:{host:'localhost',cookie},socket:{remoteAddress:randomUUID()}});const headers={},res={setHeader(k,v){headers[k]=v;},writeHead(status){this.status=status;},end(value){this.body=JSON.parse(String(value));}};await accountGateway(req,res,pool,'setup-password',(q,r,p)=>handleRequest(q,r,p,'setup-password'),communityRoutes);return {status:res.status,body:res.body,cookie:headers['Set-Cookie']?.split(';')[0]};}
 const owner=await request('POST','/api/accounts/bootstrap',{applicationPassword:'setup-password',login:'owner',displayName:'Owner',password:'owner-personal-password',householdId:h,personId:people[0]});assert.equal(owner.status,201);
 const preview=()=>request('GET','/api/planning/rebalance-preview?householdId='+h+'&date='+date,null,owner.cookie);
 const apply=token=>request('POST','/api/planning/rebalance',{householdId:h,date,token},owner.cookie);
 const initial=await preview();assert.equal(initial.status,200);assert.equal(initial.body.changes.length,1);assert.equal(initial.body.changes[0].personId,people[0]);assert.equal(initial.body.changes[0].after,0);assert.equal(initial.body.results.find(p=>p.personId===people[0]).beforeKcal,1466.8);
 const result=await apply(initial.body.token);assert.equal(result.status,200,JSON.stringify({body:result.body,errors}));assert.equal(result.body.applied,1);assert.equal(result.body.results.find(p=>p.personId===people[0]).afterKcal,1242.4);
 const saved=await pool.query('SELECT i.recipe_id,a.person_id,a.quantity FROM planned_meal_items i JOIN planned_amounts a ON a.planned_item_id=i.id WHERE i.meal_id=$1 ORDER BY a.person_id',[snack.id]);assert.equal(saved.rows.length,3);assert.ok(saved.rows.every(r=>r.recipe_id===variant.id&&r.person_id!==people[0]&&Number(r.quantity)===1));
 assert.equal((await pool.query('SELECT count(*) AS n FROM ingredient_stock_movements')).rows[0].n,0);assert.equal((await pool.query('SELECT count(*) AS n FROM recipe_stock_uses')).rows[0].n,0);
 assert.equal((await apply(initial.body.token)).body.error,'rebalance-preview-stale');
 const item=(await pool.query('SELECT id FROM planned_meal_items WHERE meal_id=$1',[snack.id])).rows[0].id;
 await pool.query('INSERT INTO planned_amounts(planned_item_id,person_id,quantity) VALUES($1,$2,1)',[item,people[0]]);
 const fresh=await preview();serializationAtCommit=true;const conflict=await apply(fresh.body.token);assert.equal(conflict.status,409);assert.equal(conflict.body.error,'rebalance-preview-stale');
 assert.equal(Number((await pool.query('SELECT quantity FROM planned_amounts WHERE planned_item_id=$1 AND person_id=$2',[item,people[0]])).rows[0].quantity),1);
 assert.equal((await apply((await preview()).body.token)).status,200);
 const unchanged=await apply((await preview()).body.token);assert.equal(unchanged.status,200);assert.equal(unchanged.body.applied,0);
 await request('POST','/api/accounts/members',{login:'reader',displayName:'Reader',password:'reader-personal-password',role:'member'},owner.cookie);const reader=await request('POST','/api/login',{login:'reader',password:'reader-personal-password'});
 assert.equal((await request('POST','/api/planning/rebalance',{householdId:h,date,token:initial.body.token},reader.cookie)).status,403);
 assert.equal((await request('POST','/api/planning/rebalance',{householdId:randomUUID(),date,token:initial.body.token},owner.cookie)).status,403);
});
