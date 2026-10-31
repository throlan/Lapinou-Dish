import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {batchCookingWindow} from '../web/preparation-weeks.js';
import {groupPreparations} from '../web/cooking-sheet.js';
import {createRecipe,validateRecipeInput} from '../src/server/recipes.mjs';
import {savePlannedMeal} from '../src/server/planning.mjs';
import {addStockLot,listPreparationsToMake,listShoppingRequirements,listStock} from '../src/server/household-planning.mjs';

const start='2026-10-31',end='2026-11-29';
const preparations=[{productionType:'bread',firstDate:start},{productionType:'batch_cooking',firstDate:'2026-11-02'}];
test('two batch weeks start at the first planned week, not the preceding empty partial week',()=>{
  const range=batchCookingWindow(start,end,{duration:'2'},preparations);
  assert.equal(range.monday,'2026-11-02');
  assert.equal(range.start,'2026-11-02');assert.equal(range.end,'2026-11-15');assert.equal(range.weekCount,2);
  assert.deepEqual(range.weeks[0],{monday:'2026-10-26',start:'2026-10-31',end:'2026-11-01'});
  const explicit=batchCookingWindow(start,end,{monday:'2026-10-26',duration:'1'},preparations);
  assert.equal(explicit.start,start);assert.equal(explicit.end,'2026-11-01');
});
test('batch duration choices keep Monday boundaries, clip the end, and allow the entire shopping period',()=>{
  assert.equal(batchCookingWindow(start,end,{duration:'1'},preparations).end,'2026-11-08');
  assert.equal(batchCookingWindow(start,end,{duration:'3'},preparations).end,'2026-11-22');
  const clipped=batchCookingWindow(start,'2026-11-11',{monday:'2026-11-09',duration:'3'},preparations);
  assert.equal(clipped.start,'2026-11-09');assert.equal(clipped.end,'2026-11-11');assert.equal(clipped.weekCount,1);
  const all=batchCookingWindow(start,end,{monday:'2026-11-09',duration:'all'},preparations);
  assert.equal(all.start,start);assert.equal(all.end,end);
  const moved=batchCookingWindow('2026-12-01','2026-12-15',{monday:'2026-11-02',duration:'2'},[]);
  assert.equal(moved.start,'2026-12-01');assert.equal(moved.end,'2026-12-13');
  assert.equal(batchCookingWindow(end,start),null);
});
test('batch range remains selected after production even if every menu is covered',()=>{
  const chosen={monday:'2026-11-09',duration:'2'};
  const range=batchCookingWindow(start,end,chosen,[{...preparations[1],toMakeQuantity:0}]);
  assert.equal(range.start,'2026-11-09');assert.equal(range.end,'2026-11-22');
});

test('a combined batch shares initial stock and recipe minima across duplicated weeks, then refreshes after production',async()=>{
  const db=new PGlite();
  try{
    const dir=new URL('../db/migrations/',import.meta.url);
    for(const file of (await readdir(dir)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,dir),'utf8'));
    const pool={async query(sql,args=[]){const r=await db.query(sql,args);return {...r,rowCount:r.rows.length||r.affectedRows||0};},async connect(){return {...this,release(){}};}};
    const householdId=randomUUID(),personId=randomUUID(),foodId=randomUUID();
    await pool.query("INSERT INTO households(id,name) VALUES($1,'Synthetic multiweek')",[householdId]);
    await pool.query("INSERT INTO people(id,household_id,display_name) VALUES($1,$2,'Synthetic')",[personId,householdId]);
    await pool.query("INSERT INTO foods(id,canonical_name,source) VALUES($1,'Synthetic flour','manual')",[foodId]);
    const make=async(name,type,yieldAmount,minimumAmount,lines)=>{
      const checked=validateRecipeInput({householdId,name,recipeType:'dish',productionType:type,yield:{amount:yieldAmount,unitId:'portion'},minimumProductionAmount:minimumAmount,minimumProductionUnitId:'portion',lines});
      assert.equal(checked.error,undefined);return createRecipe(pool,checked.data);
    };
    const batch=await make('Batch duplicated','batch_cooking',4,12,[{foodId,quantity:400,unitId:'g'}]);
    const exact=await make('Exact duplicated','batch_cooking',4,0,[{foodId,quantity:400,unitId:'g'}]);
    const bread=await make('Bread later','bread',4,0,[{foodId,quantity:400,unitId:'g'}]);
    const meal=async(date,recipeId,quantity)=>savePlannedMeal(pool,null,{householdId,mealDate:date,slot:'lunch',notes:'Preserve menu',attendeeIds:[personId],items:[{recipeId,role:'main',amounts:[{personId,quantity}]}]});
    // Earlier menus reserve stock first; the first partial week itself is empty.
    await meal('2026-10-30',batch.id,1);
    for(const date of ['2026-11-02','2026-11-09']){
      await meal(date,batch.id,8);
      await savePlannedMeal(pool,null,{householdId,mealDate:date,slot:'dinner',notes:'Duplicate week',attendeeIds:[personId],items:[{recipeId:exact.id,role:'main',amounts:[{personId,quantity:4}]}]});
    }
    await meal('2026-11-23',bread.id,2);
    const menusBefore=(await pool.query('SELECT * FROM planned_amounts ORDER BY planned_item_id,person_id')).rows;
    const read=(from,to)=>listPreparationsToMake(pool,householdId,from,to);
    assert.deepEqual(await read(start,'2026-11-01'),[]);
    const noStock=await read('2026-11-02','2026-11-15');
    assert.equal(noStock.find(p=>p.recipeId===exact.id).toMakeQuantity,8);
    assert.equal(groupPreparations(noStock).filter(p=>p.recipeId===exact.id).length,1);
    await addStockLot(pool,{householdId,recipeId:batch.id,quantity:6,producedOn:start,storage:'freezer',note:'Initial stock'});
    await addStockLot(pool,{householdId,recipeId:exact.id,quantity:3,producedOn:start,storage:'freezer',note:'Initial stock'});
    const whole=await read(start,end);
    const range=batchCookingWindow(start,end,{duration:'2'},whole);
    assert.equal(range.start,'2026-11-02');assert.equal(range.end,'2026-11-15');
    const combined=await read(range.start,range.end),needed=combined.find(p=>p.recipeId===batch.id);
    assert.equal(combined.length,2);assert.equal(groupPreparations(combined).length,2);
    assert.equal(needed.plannedQuantity,16);assert.equal(needed.stockQuantity,6);
    assert.equal(needed.toMakeQuantity,12); // only one minimum lot; surplus covers week two
    assert.equal(needed.firstDate,'2026-11-02');assert.equal(needed.lastDate,'2026-11-09');assert.equal(needed.mealCount,2);
    assert.equal(combined.find(p=>p.recipeId===exact.id).toMakeQuantity,5); // 8 minus 3 once
    const weekly1=await read('2026-11-02','2026-11-08'),weekly2=await read('2026-11-09','2026-11-15');
    assert.equal(weekly1.find(p=>p.recipeId===batch.id).toMakeQuantity+weekly2.find(p=>p.recipeId===batch.id).toMakeQuantity,24);
    const shoppingBefore=await listShoppingRequirements(pool,householdId,start,end);
    assert.equal(shoppingBefore.find(p=>p.foodId===foodId).neededQuantity,1900); // 12 batch + 5 exact + 2 bread
    assert.equal(whole.find(p=>p.recipeId===bread.id).toMakeQuantity,2);
    // Selecting a display range must not change shopping or any menu.
    assert.deepEqual(await listShoppingRequirements(pool,householdId,start,end),shoppingBefore);
    const production=await addStockLot(pool,{householdId,recipeId:batch.id,quantity:needed.toMakeQuantity,producedOn:range.start,storage:'freezer',note:'Two weeks'});
    assert.equal(production.error,undefined);
    const refreshed=await read(range.start,range.end);
    assert.equal(refreshed.find(p=>p.recipeId===batch.id).toMakeQuantity,0);
    assert.equal((await listStock(pool,householdId)).find(p=>p.recipeId===batch.id).availableQuantity,1);
    assert.equal((await listShoppingRequirements(pool,householdId,start,end)).find(p=>p.foodId===foodId).neededQuantity,700);
    assert.deepEqual((await pool.query('SELECT * FROM planned_amounts ORDER BY planned_item_id,person_id')).rows,menusBefore);
  }finally{await db.close();}
});

// Exercise the real browser coordinator: changing the batch range must issue
// one range calculation, while other productions retain the full-period data.
test('batch selectors request one combined range and leave other production periods intact',async()=>{
  const {runInNewContext}=await import('node:vm');
  const source=await readFile(new URL('../web/app.js',import.meta.url),'utf8');
  const a=source.indexOf('async function refreshPreparations(start,end)'),b=source.indexOf('async function refreshShoppingList()',a);
  const elements=new Map();
  const element=()=>({value:'',textContent:'',disabled:false,children:[],handlers:{},querySelectorAll(){return [];},replaceChildren(...children){this.children=children;},addEventListener(type,handler){this.handlers[type]=handler;}});
  const $=selector=>{if(!elements.has(selector))elements.set(selector,element());return elements.get(selector);};
  $('#shopping-start').value=start;$('#shopping-end').value=end;
  const batch={recipeId:'batch',productionType:'batch_cooking',firstDate:'2026-11-02',toMakeQuantity:12};
  const bread={recipeId:'bread',productionType:'bread',firstDate:'2026-11-23',toMakeQuantity:2};
  const full=[batch,bread],calls=[];
  const context={$,state:{household:{id:'synthetic'},productionTypes:[{id:'batch_cooking',label:'Batch cooking'},{id:'bread',label:'Pain'}]},
    preparationsRequest:0,batchCookingSelection:{},batchCookingHouseholdId:null,batchCookingRendered:false,
    batchCookingWindow,groupPreparations,displayDate:d=>d,encodeURIComponent,
    Option:function(text,value){this.textContent=text;this.value=value;},
    refreshProductionTypes:async()=>{},renderProductionOptions(){},productionTypeLabel:()=> 'Batch cooking',emptyMessage:t=>({textContent:t}),
    preparationGroup:(label,key,items,openKeys,emptyText,date)=>({label,key,items,date}),
    api:async path=>{const url=new URL(path,'http://synthetic.test');calls.push([url.searchParams.get('startDate'),url.searchParams.get('endDate')]);return {preparations:url.searchParams.get('startDate')===start?full:[batch]};}};
  runInNewContext(source.slice(a,b)+'\nglobalThis.refresh=refreshPreparations;',context);
  await context.refresh(start,end);
  assert.deepEqual(calls,[[start,end],['2026-11-02','2026-11-08']]);
  assert.equal($('#batch-cooking-start').value,'2026-11-02');
  $('#batch-cooking-duration').value='2';$('#batch-cooking-duration').handlers.change();
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(calls.slice(2),[[start,end],['2026-11-02','2026-11-15']]);
  const rendered=$('#preparations-list').children;
  assert.equal(rendered.find(g=>g.key==='bread').items[0],bread);
  assert.equal(rendered.find(g=>g.key==='batch').items.length,1);
  assert.equal(rendered.find(g=>g.key==='batch').date,'2026-11-02');
  assert.equal(context.state.preparations.length,2);
  $('#batch-cooking-duration').value='all';$('#batch-cooking-duration').handlers.change();
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(calls.slice(4),[[start,end]]); // full-period result reused, no weekly sums
  assert.equal($('#batch-cooking-start').disabled,true);
  assert.equal($('#shopping-start').value,start);assert.equal($('#shopping-end').value,end);
});
