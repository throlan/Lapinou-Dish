import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {runInNewContext} from 'node:vm';

const source = await readFile(new URL('../web/app.js',import.meta.url),'utf8');

test('stock filters distinguish a negative balance from a forecast shortage',()=>{
  const start=source.indexOf('function filterIngredientStock'),end=source.indexOf('function renderIngredientStock',start);
  const context={};
  runInNewContext(source.slice(start,end)+'\nglobalThis.filterStock=filterIngredientStock;',context);
  const rows=[
    {name:'Épices douces',quantityG:-20,projectedG:-40,alert:true,complete:true},
    {name:'Épices fortes',quantityG:0,projectedG:0,alert:false,complete:true},
    {name:'Levure',quantityG:12,projectedG:-5,alert:true,complete:false},
    {name:'Farine',quantityG:500,projectedG:400,alert:false,complete:true},
  ];
  const names=(mode,query='')=>Array.from(context.filterStock(rows,mode,query),row=>row.name);
  assert.deepEqual(names('negative','douces epices'),['Épices douces']);
  assert.deepEqual(names('empty'),['Épices fortes']);
  assert.deepEqual(names('shortage'),['Levure']);
  assert.deepEqual(names('positive'),['Levure','Farine']);
  assert.deepEqual(names('order'),['Épices douces','Levure']);
  assert.deepEqual(names('incomplete'),['Levure']);
});

test('catalogue search receives a grouped purchase outside the list and safely retries the same receipt',async()=>{
  const node=()=>({children:[],handlers:{},dataset:{},value:'',
    addEventListener(name,callback){this.handlers[name]=callback;},
    replaceChildren(...children){this.children=children;},
    focus(){},
  });
  const fields=names=>Object.fromEntries(names.map(name=>[name,node()]));
  const receipt={...node(),elements:fields(['quantity','unitId']),button:node(),
    reset(){this.elements.quantity.value='';},reportValidity(){return true;}};
  const count={...node(),elements:fields(['quantityG','minimumG','targetG','leadDays'])};
  const nodes=new Map([['#ingredient-receipt-form',receipt],['#ingredient-stock-form',count]]);
  const $=(selector,root)=>{
    if(root)return root.button;
    if(!nodes.has(selector))nodes.set(selector,node());
    return nodes.get(selector);
  };
  const ingredients=[{foodId:'common',name:'Coulis',quantityG:-100,version:3}];
  const requests=[];
  let runSearch, refreshes=0, requestCount=0;
  const context={$,state:{household:{id:'home'},ingredients},
    setTimeout:callback=>{runSearch=callback;},clearTimeout(){},
    Option:function(text,value){Object.assign(this,{textContent:text,value});},
    newProductionRequestId:()=>String(++requestCount),formatQty:String,
    showMessage:(target,message)=>{target.textContent=message;},shoppingPreferenceError:()=> 'Réessaie.',
    refreshShopping:async()=>{refreshes++;ingredients[0].quantityG=100;context.refreshSelected();},refreshDashboard:async()=>{},
    api:async(url,options)=>{
      if(url.startsWith('/api/foods?'))return {foods:[{id:'source',name:'Purée de tomate'}]};
      if(url.startsWith('/api/shopping-preferences?'))return {mappings:[{foodId:'source',purchaseFoodId:'common',purchaseName:'Coulis',targetUnitId:'kg'}]};
      assert.equal(url,'/api/household-planning/purchases');
      requests.push(JSON.parse(options.body));
      if(requests.length===1)throw Error('Temporary interruption');
      return {quantityG:200};
    }};
  const start=source.indexOf("const ingredientSearch ="),end=source.indexOf('function localDateValue',start);
  runInNewContext(source.slice(start,end)+'\nglobalThis.refreshSelected=renderSelectedIngredient;',context);
  const search=$('#ingredient-search'), select=$('#ingredient-food');
  search.value='purée';search.handlers.input();
  await runSearch();
  select.value='source';select.selectedOptions=[select.children[1]];
  select.handlers.change();
  await new Promise(setImmediate);
  assert.equal($('#ingredient-selected-name').textContent,'Coulis');
  assert.match($('#ingredient-selected-stock').textContent,/-100 g/);
  assert.equal(receipt.elements.unitId.value,'kg');
  receipt.elements.quantity.value='0.2';
  const event={currentTarget:receipt,preventDefault(){}};
  await receipt.handlers.submit(event);
  await receipt.handlers.submit(event);
  assert.deepEqual(requests,[{householdId:'home',foodId:'common',quantity:0.2,unitId:'kg',requestId:'1'},
    {householdId:'home',foodId:'common',quantity:0.2,unitId:'kg',requestId:'1'}]);
  assert.equal(refreshes,1);
  assert.match($('#ingredient-selected-stock').textContent,/Stock actuel : 100 g/);
  assert.equal(receipt.elements.quantity.value,'');
});
