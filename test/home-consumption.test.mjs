import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {PGlite} from '@electric-sql/pglite';
import {scopedOperation} from '../src/server/accounts.mjs';
import {saveHomeConsumption,readHomeConsumption,listHomeConsumption} from '../src/server/home-consumption.mjs';
import {createRecipe,validateRecipeInput} from '../src/server/recipes.mjs';
import {savePlannedMeal} from '../src/server/planning.mjs';
import {homeBudgetShare,plannedMacro,consumptionParts,confirmedMacro} from '../web/day-meals.js';
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
  await pool.query("INSERT INTO food_nutrients(food_id,nutrient_id,value_per_100g) VALUES($1,'carbohydrate_g',14),($1,'fat_g',6)",[food]);
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
  assert.deepEqual(weekly,[{personId:person,date,carbohydrate:{grams:36,incomplete:false},fat:{grams:12,incomplete:true}}]);
  const hidden=await scopedOperation(pool,{...actor,personId:other},scoped=>readHomeConsumption(scoped,h,person,date));
  assert.deepEqual(hidden,{parts:[],revision:null});
  assert.deepEqual(await scopedOperation(pool,{...actor,personId:other},scoped=>listHomeConsumption(scoped,h,'2026-11-16')),[]);
  const cleared=await save([],revised.revision);
  assert.deepEqual(cleared.parts,[]);
});

test('the calendar confirmation sends only checked parts and shows the personal home budget',async()=>{
  const source=await readFile(new URL('../web/app.js',import.meta.url),'utf8');
  const start=source.indexOf('let macroView ='),end=source.indexOf('function renderDailyEnergySummary',start);
  const node=tag=>({tag,children:[],append(...children){this.children.push(...children);},
    replaceChildren(){this.children=[];},showModal(){this.open=true;}});
  const button=node('button'),form=node('form');
  form.querySelector=()=>button;
  const nodes={'#daily-macros-dialog':node('dialog'),'#daily-macros-form':form,'#daily-macros-message':node('p'),
    '#daily-consumed-meals':node('div'),'#daily-macros-comparison':node('div'),'#daily-macros-title':node('h2')};
  const date='2026-11-19',person={id:'a',displayName:'Profil fictif'};
  const item=(id,name,carbohydrateG,fatG)=>({id,amounts:[{personId:'a',quantity:1}],
    recipe:{name,yield:{unitId:'portion'},nutrition:{perYieldUnit:{carbohydrateG,fatG}}}});
  const main=item('main','Plat',18,7),dessert=item('dessert','Dessert',12,null);
  const meals=[{id:'breakfast',mealDate:date,slot:'breakfast',attendees:[person],items:[item('toast','Tartine',10,2)]},
    {id:'lunch',mealDate:date,slot:'lunch',attendees:[{id:'b'}],items:[]},
    {id:'dinner',mealDate:date,slot:'dinner',attendees:[person],items:[main,dessert]}];
  let sent;
  const context={homeBudgetShare,plannedMacro,consumptionParts,confirmedMacro,slotLabels:MEAL_LABELS,
    $:selector=>nodes[selector],document:{createElement:node,createTextNode:text=>({text})},URLSearchParams,
    state:{household:{id:'h'},mealRatios:DEFAULT_MEAL_RATIOS},latestProfile:()=>({dailyCarbohydrateG:100,dailyFatG:50}),
    displayDate:String,formatQty:String,format:String,servingUnitLabel:String,refreshCalendar:async()=>{},
    api:async(_,options)=>{
      if(!options)return {parts:[],revision:null};
      sent=JSON.parse(options.body);
      const {item,...part}=consumptionParts(meals,person.id,date).find(part=>part.itemId==='main');
      return {parts:[{...part,carbohydrate:{grams:18,incomplete:false},fat:{grams:7,incomplete:false}}],revision:'saved'};
    }};
  runInNewContext(source.slice(start,end)+'\nglobalThis.open=openDailyMacros;',context);
  await context.open(person,date,meals);
  const groups=nodes['#daily-consumed-meals'].children;
  assert.equal(groups.length,2);
  assert.equal(groups[0].children[0].textContent,'Petit-déjeuner');
  assert.equal(groups[1].children.length,3);
  groups[1].children[1].children[0].checked=true;
  await form.onsubmit({preventDefault(){}});
  assert.deepEqual(sent,{householdId:'h',date,selections:[{mealId:'dinner',itemId:'main'}],revision:null});
  const comparison=nodes['#daily-macros-comparison'].children.map(entry=>entry.textContent);
  assert.match(comparison[0],/prévus 40 g · confirmés 18 g · repère personnalisé à la maison 60 g/);
  assert.match(comparison[1],/prévus au moins 9 g \(incomplet\) · confirmés 7 g/);
  assert.match(comparison[2],/Graisses saturées · donnée non disponible/);
});
