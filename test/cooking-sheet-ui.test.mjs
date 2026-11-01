import {mountCookingInstagram} from '../web/cooking-instagram.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { productionRecipe, scaledIngredients, scaledSourceIngredients, cookingYield, suggestedServingQuantities } from '../web/cooking-sheet.js';

const source=await readFile(new URL('../web/app.js',import.meta.url),'utf8');
const start=source.indexOf('let cookingRecipeId=null,cookingRequest=null');
const end=source.indexOf("\ntry{\n  const saved=JSON.parse(localStorage.getItem('lapinou-recipe-filters')",start);
assert.ok(start>=0 && end>start);

function cookingUI(){
  const element=()=>({value:'',hidden:false,children:[],handlers:{},options:[{},{}],classList:{toggle(){}},
    append(...items){this.children.push(...items);},replaceChildren(...items){this.children=items;},
    addEventListener(name,fn){this.handlers[name]=fn;},setAttribute(){},showModal(){this.open=true;},close(){this.open=false;}});
  const form=element();form.elements=Object.fromEntries(['quantity','producedOn','storage','note'].map(k=>[k,element()]));
  form.reset=()=>{for(const field of Object.values(form.elements))field.value='';form.elements.storage.value='freezer';};
  form.reportValidity=()=>form.elements.quantity.disabled||Number(form.elements.quantity.value)>0;
  const elements=new Map([['#cook-form',form]]),requests=[];
  const recipe={id:'parent',name:'Fictitious bowl',productionType:'batch_cooking',yield:{amount:4,unitId:'portion'},
    servingParts:[{id:'whole',yield:{amount:2760,unitId:'g'}}],lines:[{foodName:'Ingredient',quantity:2760,unitId:'g'}]};
  const $=selector=>{if(!elements.has(selector))elements.set(selector,element());return elements.get(selector);};
  const context={$,document:{createElement:element,createTextNode:text=>({textContent:text})},state:{household:{id:'household'},recipes:[recipe]},
    mountCookingInstagram,productionRecipe,scaledIngredients,scaledSourceIngredients,cookingYield,suggestedServingQuantities,formatQty:q=>String(q),localDateValue:()=> '2026-10-19',
    showMessage:(target,text)=>{target.textContent=text;},newProductionRequestId:()=> 'request',
    api:async(path,options)=>{requests.push({path,payload:JSON.parse(options.body)});return {};},
    refreshShopping:async()=>{},refreshDashboard:async()=>{},refreshCalendar:async()=>{}};
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
  assert.equal(ui.form.elements.quantity.value,'0');
  assert.match(ui.$('#cook-planned').textContent,/aucune quantité de recette complète/);
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

test('separate services display and submit only their own menu quantities including zeros',async()=>{
  const ui=cookingUI();
  ui.recipe.servingParts=[
    {id:'main',servingPart:'main',yield:{amount:400,unitId:'g'}},
    {id:'vegetables',servingPart:'vegetables',yield:{amount:800,unitId:'g'}},
    {id:'starch',servingPart:'starch',yield:{amount:400,unitId:'g'}}];
  ui.recipe.lines=[{quantity:400,unitId:'g',servingPart:'main'},{quantity:800,unitId:'g',servingPart:'vegetables'},{quantity:100,unitId:'g',servingPart:'starch'}];
  const group={parts:[{recipeId:'main',toMakeQuantity:600},{recipeId:'vegetables',toMakeQuantity:800},{recipeId:'starch',toMakeQuantity:300}]};
  ui.open(1700,'2026-10-19',group);
  assert.equal(ui.$('#cook-total-quantity').hidden,true);
  assert.equal(ui.form.elements.quantity.disabled,true);
  const inputs=ui.$('#cook-part-quantities').children.map(label=>label.children[1]);
  assert.deepEqual(inputs.map(input=>input.value),['600','800','300']);
  const text=entry=>[entry.textContent??'',...(entry.children??[]).map(text)].join('');
  assert.match(text(ui.$('#cook-ingredients')),/600 g/);
  assert.match(text(ui.$('#cook-ingredients')),/800 g/);
  assert.match(text(ui.$('#cook-ingredients')),/75 g/);
  // Editing one part must not change the other two services.
  inputs[1].value='0';inputs[1].handlers.input();
  await ui.submit();
  assert.equal(ui.requests[0].payload.recipeId,'parent');
  assert.deepEqual(ui.requests[0].payload.servingQuantities,[{recipeId:'main',quantity:600},{recipeId:'vegetables',quantity:0},{recipeId:'starch',quantity:300}]);
  assert.equal(ui.requests[0].payload.quantity,undefined);
  ui.open(0,undefined,{parts:[]});
  await ui.submit();
  assert.equal(ui.requests.length,1);
  assert.match(ui.$('#cook-message').textContent,/Aucune quantité à fabriquer/);
});

test('cooking from the directory reloads menus and offers explicit free cooking when no menu is available',async()=>{
  const a=source.indexOf("cook.addEventListener('click',async()=>"),b=source.indexOf('\n  const removalMessage=',a);
  assert.ok(a>=0 && b>a);
  const cook={disabled:false,addEventListener(_,handler){this.click=handler;}},opened=[],requests=[];
  const recipe={id:'parent',yield:{amount:4,unitId:'portion'},servingParts:[{id:'whole',yield:{amount:2760,unitId:'g'}}]};
  let preparations=[{recipeId:'whole',parentRecipeId:'parent',yieldAmount:2760,toMakeQuantity:5340}],failure=false;
  const context={cook,recipe,state:{household:{id:'household'},preparations:[]},$:selector=>({value:selector==='#shopping-start'?'2026-10-19':'2026-10-25'}),
    encodeURIComponent,localDateValue:()=> '2026-10-19',addDays:()=> '2026-11-17',
    api:async path=>{requests.push(path);if(failure)throw Error('unavailable');return {preparations};},
    groupPreparations:(items)=>items.length?[{recipeId:'parent',parts:items}]:[],
    suggestedProductionQuantity:(group)=>group.parts[0]?.toMakeQuantity??0,
    showMessage:(element,text)=>{element.textContent=text;},openCookingSheet:(...args)=>opened.push(args)};
  runInNewContext(source.slice(a,b),context);
  await cook.click();assert.equal(opened[0][1],5340);
  assert.match(requests[0],/startDate=2026-10-19&endDate=2026-10-25/);
  preparations=[];await cook.click();assert.equal(opened[1][1],0);assert.equal(opened[1][4],'free');
  failure=true;await cook.click();assert.equal(opened.length,3);
  assert.equal(opened[2][4],'free');assert.equal(opened[2][3].unavailable,true);
  assert.equal(cook.disabled,false);
});

test('free cooking uses source portions and keeps the precise menu grams when switching back',async()=>{
  const ui=cookingUI();ui.recipe.servingParts[0].yield.amount=3327;
  ui.recipe.lines=[{foodName:'Beef',quantity:800,unitId:'g'},{foodName:'Vegetables',quantity:900,unitId:'g'}];
  const before=JSON.stringify(ui.recipe),group={parts:[{plannedQuantity:2270,coveredQuantity:0,toMakeQuantity:2270,unitId:'g'}]};
  ui.open(2270,'2026-10-19',group);
  assert.equal(ui.form.elements.quantity.value,'2270');
  ui.$('#cook-mode').value='free';ui.$('#cook-mode').handlers.change();
  assert.equal(ui.form.elements.quantity.value,'4');
  assert.equal(ui.$('#cook-unit').textContent,'portion');
  assert.match(ui.$('#cook-quantity-label').textContent,/Nombre de portions/);
  ui.form.elements.quantity.value='6';ui.form.elements.quantity.handlers.input();
  const text=entry=>[entry.textContent??'',...(entry.children??[]).map(text)].join('');
  assert.match(text(ui.$('#cook-ingredients')),/1200 g/);
  assert.match(text(ui.$('#cook-ingredients')),/1350 g/);
  assert.match(ui.$('#cook-equivalent').textContent,/4990.5 g pour 6 portion/);
  assert.match(ui.$('#cook-planned').textContent,/sans ajustement aux objectifs nutritionnels/);
  ui.$('#cook-mode').value='menus';ui.$('#cook-mode').handlers.change();
  assert.equal(ui.form.elements.quantity.value,'2270');
  assert.equal(ui.$('#cook-unit').textContent,'g');
  ui.$('#cook-mode').value='free';ui.$('#cook-mode').handlers.change();
  assert.equal(ui.form.elements.quantity.value,'6');
  await ui.submit();
  assert.equal(ui.requests[0].payload.recipeId,'parent');assert.equal(ui.requests[0].payload.quantity,6);
  assert.equal(ui.requests[0].payload.servingQuantities,undefined);
  assert.equal(JSON.stringify(ui.recipe),before);
});

test('free portions scale every source service and restore independent menu quantities including zero',async()=>{
  const ui=cookingUI();ui.recipe.servingParts=[
    {id:'main',servingPart:'main',yield:{amount:400,unitId:'g'}},
    {id:'vegetables',servingPart:'vegetables',yield:{amount:800,unitId:'g'}},
    {id:'starch',servingPart:'starch',yield:{amount:400,unitId:'g'}}];
  ui.recipe.lines=[{quantity:400,unitId:'g',servingPart:'main'},{quantity:800,unitId:'g',servingPart:'vegetables'},{quantity:100,unitId:'g',servingPart:'starch'}];
  ui.open(900,'2026-10-19',{parts:[{recipeId:'main',toMakeQuantity:600},{recipeId:'starch',toMakeQuantity:300}]});
  ui.$('#cook-mode').value='free';ui.$('#cook-mode').handlers.change();
  assert.equal(ui.$('#cook-part-quantities').hidden,true);assert.equal(ui.form.elements.quantity.disabled,false);
  ui.form.elements.quantity.value='8';ui.form.elements.quantity.handlers.input();
  const text=entry=>[entry.textContent??'',...(entry.children??[]).map(text)].join('');
  assert.match(text(ui.$('#cook-ingredients')),/800 g/);assert.match(text(ui.$('#cook-ingredients')),/1600 g/);assert.match(text(ui.$('#cook-ingredients')),/200 g/);
  assert.match(ui.$('#cook-equivalent').textContent,/3200 g/);
  ui.$('#cook-mode').value='menus';ui.$('#cook-mode').handlers.change();
  assert.deepEqual(ui.$('#cook-part-quantities').children.map(label=>label.children[1].value),['600','0','300']);
  ui.$('#cook-mode').value='free';ui.$('#cook-mode').handlers.change();
  await ui.submit();assert.equal(ui.requests[0].payload.recipeId,'parent');assert.equal(ui.requests[0].payload.quantity,8);
  assert.equal(ui.requests[0].payload.servingQuantities,undefined);
});

test('free cooking is available without menus and for original units without inventing a portion weight',()=>{
  const ui=cookingUI();
  ui.open(0,undefined,{parts:[],unavailable:true},'free');
  assert.equal(ui.form.elements.quantity.value,'4');assert.equal(ui.$('#cook-mode').options[0].disabled,true);
  ui.recipe.servingParts=[];ui.recipe.yield={amount:24,unitId:'piece'};
  ui.open(0,undefined,{parts:[]},'free');
  assert.equal(ui.$('#cook-mode').options[0].disabled,false);
  assert.equal(ui.form.elements.quantity.value,'24');assert.equal(ui.$('#cook-unit').textContent,'piece');
  assert.equal(ui.$('#cook-equivalent').hidden,true);
  ui.recipe.yield={amount:1000,unitId:'g'};ui.open(0,undefined,{parts:[]},'free');
  assert.equal(ui.form.elements.quantity.value,'1000');assert.equal(ui.$('#cook-unit').textContent,'g');
  assert.equal(ui.$('#cook-quantity-label').textContent,'Quantité à fabriquer');
});
