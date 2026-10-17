import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { productionRecipe, scaledIngredients } from '../web/cooking-sheet.js';

const source=await readFile(new URL('../web/app.js',import.meta.url),'utf8');
const start=source.indexOf('let cookingRecipeId=null,cookingRequest=null;');
const end=source.indexOf("\ntry{\n  const saved=JSON.parse(localStorage.getItem('lapinou-recipe-filters')",start);
assert.ok(start>=0 && end>start);

function cookingUI(){
  const element=()=>({value:'',hidden:false,children:[],handlers:{},classList:{toggle(){}},
    append(...items){this.children.push(...items);},replaceChildren(...items){this.children=items;},
    addEventListener(name,fn){this.handlers[name]=fn;},showModal(){this.open=true;},close(){this.open=false;}});
  const form=element();form.elements=Object.fromEntries(['quantity','producedOn','storage','note'].map(k=>[k,element()]));
  form.reset=()=>{for(const field of Object.values(form.elements))field.value='';form.elements.storage.value='freezer';};
  form.reportValidity=()=>Number(form.elements.quantity.value)>0;
  const elements=new Map([['#cook-form',form]]),requests=[];
  const recipe={id:'parent',name:'Fictitious bowl',productionType:'batch_cooking',yield:{amount:4,unitId:'portion'},
    servingParts:[{id:'whole',yield:{amount:2760,unitId:'g'}}],lines:[{foodName:'Ingredient',quantity:2760,unitId:'g'}]};
  const $=selector=>{if(!elements.has(selector))elements.set(selector,element());return elements.get(selector);};
  const context={$,document:{createElement:element,createTextNode:text=>({textContent:text})},state:{household:{id:'household'},recipes:[recipe]},
    productionRecipe,scaledIngredients,formatQty:q=>String(q),localDateValue:()=> '2026-10-19',
    showMessage:(target,text)=>{target.textContent=text;},newProductionRequestId:()=> 'request',
    api:async(path,options)=>{requests.push({path,payload:JSON.parse(options.body)});return {};},
    refreshShopping:async()=>{},refreshDashboard:async()=>{}};
  runInNewContext(source.slice(start,end)+'\nglobalThis.openSheet=openCookingSheet;',context);
  return {form,$,recipe,requests,open:(...args)=>context.openSheet(recipe.id,...args),submit:()=>form.handlers.submit({currentTarget:form,preventDefault(){}})};
}

test('cooking sheet displays planned grams and posts those grams to the served preparation',async()=>{
  const ui=cookingUI();
  const group={parts:[{plannedQuantity:5340,coveredQuantity:440,toMakeQuantity:4900,unitId:'g'}]};
  ui.open(4900,'2026-10-19',group);
  assert.equal(ui.form.elements.quantity.value,'4900');
  assert.equal(ui.$('#cook-unit').textContent,'g');
  assert.match(ui.$('#cook-base-yield').textContent,/4 portion, soit 2760 g/);
  assert.match(ui.$('#cook-planned').textContent,/5340 g prévus − 440 g couverts par le stock = 4900 g/);
  await ui.submit();
  assert.equal(ui.requests[0].payload.recipeId,'whole');
  assert.equal(ui.requests[0].payload.quantity,4900);
  assert.match(ui.$('#cook-message').textContent,/Production ajoutée/);
});

test('manual quantities and fully covered plans are not replaced by the source recipe yield',async()=>{
  const ui=cookingUI();
  ui.open();
  assert.equal(ui.form.elements.quantity.value,'2760');
  assert.equal(ui.$('#cook-planned').hidden,true);
  ui.form.elements.quantity.value='5400';
  ui.form.elements.quantity.handlers.input();
  const text=entry=>[entry.textContent??'',...(entry.children??[]).map(text)].join('');
  assert.match(text(ui.$('#cook-ingredients')),/5400 g/);
  await ui.submit();
  assert.equal(ui.requests[0].payload.quantity,5400);
  ui.open(0,undefined,{parts:[{plannedQuantity:5340,coveredQuantity:5340,toMakeQuantity:0,unitId:'g'}]});
  assert.equal(ui.form.elements.quantity.value,'0');
  await ui.submit();
  assert.equal(ui.requests.length,1);
  // Recipes manufactured as pieces still submit their original unit and id.
  ui.recipe.servingParts=[];ui.recipe.yield={amount:12,unitId:'piece'};
  ui.open(8);
  assert.equal(ui.$('#cook-unit').textContent,'piece');
  await ui.submit();
  assert.equal(ui.requests[1].payload.recipeId,'parent');
  assert.equal(ui.requests[1].payload.quantity,8);
});
