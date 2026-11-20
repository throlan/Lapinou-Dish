import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {PGlite} from '@electric-sql/pglite';
import {scopedOperation} from '../src/server/accounts.mjs';
import {saveHomeConsumption,readHomeConsumption,listHomeConsumption,saveHomeConsumptionDay,readHomeConsumptionDay} from '../src/server/home-consumption.mjs';
import {handleRequest} from '../src/server/app.mjs';
import {createRecipe,validateRecipeInput} from '../src/server/recipes.mjs';
import {savePlannedMeal} from '../src/server/planning.mjs';
import {homeBudgetShare,consumptionParts,consumptionSelections,homeConsumptionTotals} from '../web/day-meals.js';
import {DEFAULT_MEAL_RATIOS,MEAL_LABELS} from '../web/meal-config.js';

test('home consumption confirms only the participant’s meals, snapshots macros and rejects stale or private changes',async t=>{
  const db=new PGlite();
  t.after(()=>db.close());
  const dir=new URL('../db/migrations/',import.meta.url);
  for(const file of (await readdir(dir)).filter(file=>file.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,dir),'utf8'));
  const pool={
    async query(sql,values=[]){const result=await db.query(sql,values);return {...result,rowCount:result.rows.length||result.affectedRows||0};},
    async connect(){return {...this,release(){}};}
  };
  const [h,person,other,food]=Array.from({length:4},()=>randomUUID()),date='2026-11-19';
  await pool.query("INSERT INTO households(id,name) VALUES($1,'Test')",[h]);
  await pool.query("INSERT INTO people(id,household_id,display_name) VALUES($1,$3,'A'),($2,$3,'B')",[person,other,h]);
  await pool.query("INSERT INTO foods(id,canonical_name,source) VALUES($1,'Test','manual')",[food]);
  await pool.query("INSERT INTO food_nutrients(food_id,nutrient_id,value_per_100g) VALUES($1,'carbohydrate_g',14),($1,'fat_g',6),($1,'energy_kcal',100),($1,'protein_g',10),($1,'fibre_g',2)",[food]);
  const recipe=await createRecipe(pool,validateRecipeInput({householdId:h,name:'Plat fictif',yield:{amount:1,unitId:'portion'},lines:[{foodId:food,quantity:100,unitId:'g'}]}).data);
  const dessertFood=randomUUID();
  await pool.query("INSERT INTO foods(id,canonical_name,source) VALUES($1,'Dessert fictif','manual')",[dessertFood]);
  await pool.query("INSERT INTO food_nutrients(food_id,nutrient_id,value_per_100g) VALUES($1,'carbohydrate_g',8)",[dessertFood]);
  const dessert=await createRecipe(pool,validateRecipeInput({householdId:h,name:'Dessert fictif',recipeType:'dessert',yield:{amount:1,unitId:'portion'},lines:[{foodId:dessertFood,quantity:100,unitId:'g'}]}).data);
  const meal=(slot,personId,withDessert=false)=>savePlannedMeal(pool,null,{householdId:h,mealDate:date,slot,notes:'',attendeeIds:[personId],
    items:[{recipeId:recipe.id,role:'main',amounts:[{personId,quantity:2}]},
      ...(withDessert?[{recipeId:dessert.id,role:'dessert',amounts:[{personId,quantity:1}]}]:[])]});
  const breakfast=await meal('breakfast',person), lunch=await meal('lunch',other), dinner=await meal('dinner',person,true);
  assert.equal(homeBudgetShare([breakfast,lunch,dinner],person,date,DEFAULT_MEAL_RATIOS),0.6);
  const selection=(meal,index=0)=>({mealId:meal.id,itemId:meal.items[index].id});
  const actor={householdId:h,personId:person,role:'member'};
  const save=(parts,revision)=>scopedOperation(pool,actor,scoped=>saveHomeConsumption(scoped,h,person,date,parts,revision));
  const bulk=(entries)=>scopedOperation(pool,{...actor,role:'manager'},scoped=>saveHomeConsumptionDay(scoped,h,date,entries));
  const entry=(personId,part)=>({personId,revision:null,selections:[part]});
  const invalid=await bulk([entry(person,selection(breakfast)),entry(other,selection(dinner))]);
  assert.equal(invalid.error,'part-not-confirmable');
  assert.deepEqual(await readHomeConsumptionDay(pool,h,date),{entries:[]});
  const response={setHeader(){},writeHead(status){this.status=status;},end(body){this.body=JSON.parse(body);}};
  await scopedOperation(pool,actor,scoped=>handleRequest({url:'/api/planning/home-consumption',method:'POST',headers:{},account:actor,
    async *[Symbol.asyncIterator](){yield Buffer.from(JSON.stringify({householdId:h,date,entries:[entry(other,selection(lunch))]}));}},response,scoped));
  assert.equal(response.status,403);
  assert.equal((await save([selection(lunch)],null)).error,'part-not-confirmable');
  assert.equal((await save([{mealId:dinner.id,itemId:breakfast.items[0].id}],null)).error,'part-not-confirmable');
  const confirmed=await save([selection(breakfast),selection(dinner)],null);
  assert.equal(confirmed.parts.length,2);
  assert.deepEqual(confirmed.parts[1].carbohydrate,{grams:28,incomplete:false});
  assert.deepEqual(confirmed.parts[1].fat,{grams:12,incomplete:false});
  assert.equal((await save([],null)).error,'consumption-changed');
  await pool.query("UPDATE food_nutrients SET value_per_100g=24 WHERE food_id=$1 AND nutrient_id='carbohydrate_g'",[food]);
  const revised=await save([selection(dinner),selection(dinner,1)],confirmed.revision);
  assert.deepEqual(revised.parts[0],confirmed.parts[1]);
  assert.deepEqual(revised.parts[1].fat,{grams:null,incomplete:true});
  const weekly=await scopedOperation(pool,actor,scoped=>listHomeConsumption(scoped,h,'2026-11-16'));
  assert.deepEqual(weekly,[{personId:person,date,energy:{grams:200,incomplete:true},protein:{grams:20,incomplete:true},
    carbohydrate:{grams:36,incomplete:false},fat:{grams:12,incomplete:true},fibre:{grams:4,incomplete:true}}]);
  const hidden=await scopedOperation(pool,{...actor,personId:other},scoped=>readHomeConsumption(scoped,h,person,date));
  assert.deepEqual(hidden,{parts:[],revision:null});
  assert.deepEqual(await scopedOperation(pool,{...actor,personId:other},scoped=>listHomeConsumption(scoped,h,'2026-11-16')),[]);
  const cleared=await save([],revised.revision);
  assert.deepEqual(cleared.parts,[]);
  assert.deepEqual((await scopedOperation(pool,actor,scoped=>listHomeConsumption(scoped,h,'2026-11-16')))[0].energy,
    {grams:0,incomplete:false});
  const confirmedOther=await bulk([entry(other,selection(lunch))]);
  assert.equal(confirmedOther.entries[0].parts.length,1);
  assert.equal((await scopedOperation(pool,actor,scoped=>readHomeConsumptionDay(scoped,h,date))).entries.length,1);
});

test('one button confirms pending people and the editor saves only unchecked changes',async()=>{
  const source=await readFile(new URL('../web/app.js',import.meta.url),'utf8');
  const start=source.indexOf('const dailyConsumptionEndpoint'), end=source.indexOf('const dailySummaryFields',start);
  const node=tag=>({tag,children:[],handlers:{},append(...children){this.children.push(...children);},
    replaceChildren(){this.children=[];},setAttribute(){},addEventListener(name,fn){this.handlers[name]=fn;},
    showModal(){this.open=true;},close(){this.open=false;}});
  const button=node('button'),form=node('form');form.querySelector=()=>button;
  const nodes={'#daily-macros-dialog':node('dialog'),'#daily-macros-form':form,'#daily-macros-message':node('p'),
    '#daily-consumed-meals':node('div'),'#daily-macros-title':node('h2'),'#calendar-grid':{querySelector:()=>null}};
  const date='2026-11-19',a={id:'a',displayName:'Profil A'},b={id:'b',displayName:'Profil B'};
  const item=(person,id)=>({id,amounts:[{personId:person.id,quantity:1}],recipe:{name:id,yield:{unitId:'portion'}}});
  const meals=[{id:'breakfast',mealDate:date,slot:'breakfast',attendees:[a],items:[item(a,'Tartine'),item(a,'Boisson')]},
    {id:'lunch',mealDate:date,slot:'lunch',attendees:[b],items:[item(b,'Plat')]}];
  const parts=consumptionParts(meals,a.id,date).map(({item,...part})=>part);
  const entries=[{personId:a.id,parts,revision:'rev-a'}];
  const sent=[];
  const context={consumptionParts,consumptionSelections,homeConsumptionTotals,slotLabels:MEAL_LABELS,
    $:selector=>nodes[selector],document:{createElement:node,createTextNode:text=>({text})},URLSearchParams,
    state:{account:{role:'manager'},household:{id:'h'},people:[a,b],calendarConsumption:new Map([[date+':a',{}]])},
    displayDate:String,formatQty:String,servingUnitLabel:String,
    api:async(_,options)=>{
      if(!options)return {entries};
      const payload=JSON.parse(options.body);sent.push(payload);
      return {entries:payload.entries.map(entry=>({...entry,parts:[]}))};
    }};
  runInNewContext(source.slice(start,end)+'\nglobalThis.open=openDailyConsumption;globalThis.actions=renderDailyConsumptionActions;',context);
  const actions=context.actions(date,meals);
  await actions.children[0].handlers.click();
  assert.deepEqual(sent[0],{householdId:'h',date,entries:[{personId:'b',revision:null,selections:[{mealId:'lunch',itemId:'Plat'}]}]});
  assert.equal(context.actions(date,meals).children[0].disabled,true);
  entries.push({personId:'b',parts:consumptionParts(meals,b.id,date),revision:'rev-b'});
  await context.open(date,meals);
  const profiles=nodes['#daily-consumed-meals'].children;
  assert.equal(profiles.length,2);
  const group=profiles[0].children[1];assert.equal(group.children[0].textContent,'Petit-déjeuner');
  group.children[2].children[0].checked=false;
  await form.onsubmit({preventDefault(){}});
  assert.deepEqual(sent[1],{householdId:'h',date,entries:[{personId:'a',revision:'rev-a',selections:[{mealId:'breakfast',itemId:'Tartine'}]}]});
  const legacy=homeConsumptionTotals([{carbohydrate:{grams:20,incomplete:false}}]);
  assert.deepEqual(legacy.energy,{grams:null,incomplete:true});
  assert.deepEqual(legacy.carbohydrate,{grams:20,incomplete:false});
});
