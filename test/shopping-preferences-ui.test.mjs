import test from 'node:test';
import assert from 'node:assert/strict';
import {shoppingPreferenceControls,shoppingPreferencesPanel,shoppingPreferenceError} from '../web/shopping-preferences.js';

function fakeDom(t){
  const oldDocument=globalThis.document,oldOption=globalThis.Option;
  const create=tag=>({tag,children:[],options:[],listeners:{},value:'',append(...nodes){this.children.push(...nodes);},
    setAttribute(name,value){this[name]=value;},add(option){this.options.push(option);this.children.push(option);},
    replaceChildren(...nodes){this.children=nodes;this.options=nodes;},addEventListener(name,fn){this.listeners[name]=fn;},reportValidity(){return true;},
    get selectedIndex(){return this.options.findIndex(o=>o.value===this.value);}});
  globalThis.document={createElement:create};globalThis.Option=function(text,value){return {tag:'option',textContent:text,value};};
  t.after(()=>{globalThis.document=oldDocument;globalThis.Option=oldOption;});
  return {find(root,predicate){if(predicate(root))return root;for(const child of root.children??[]){if(typeof child==='object'){const found=this.find(child,predicate);if(found)return found;}}},
    texts(root){return [root.textContent??'',...(root.children??[]).filter(c=>typeof c==='object').map(c=>this.texts(c))].join(' ');}};
}
test('actual settings controls search a catalogue product and submit an explicit conversion without auto-mapping whites',async t=>{
  const dom=fakeDom(t),saved=[],searches=[],preferences={mappings:[],exclusions:[]};
  const actions={startDate:'2026-10-19',endDate:'2026-10-25',save:async data=>{saved.push(data);},searchFoods:async query=>{searches.push(query);return [{id:'raw',name:'Raw eggs'},{id:'white',name:'White'}];}};
  const root=shoppingPreferenceControls({foodId:'white',name:'White',unitId:'piece'},preferences,actions);
  assert.equal(saved.length,0);assert.match(dom.texts(root),/blancs.*explicitement/);assert.match(dom.texts(root),/250 g.*200 g.*0,8/);
  const search=dom.find(root,e=>e.type==='search');search.value='egg';await search.listeners.input();assert.deepEqual(searches,['egg']);
  const target=dom.find(root,e=>e['aria-label']==='Produit à acheter pour White');assert.equal(target.options.some(o=>o.value==='white'),false);target.value='raw';
  const form=dom.find(root,e=>e.tag==='form');form.listeners.submit({preventDefault(){}});
  assert.equal(saved[0].kind,'product');assert.equal(saved[0].foodId,'white');assert.equal(saved[0].purchaseFoodId,'raw');assert.equal(saved[0].sourceUnitId,'piece');assert.equal(saved[0].targetUnitId,'piece');assert.equal(saved[0].factor,1);
  const exclude=dom.find(root,e=>e.textContent==='Toujours exclure des courses');await exclude.listeners.click();assert.equal(saved[1].scope,'always');assert.equal(saved[1].excluded,true);
});
test('excluded products remain visible in the management panel and can be restored even when the shopping list is empty',async t=>{
  const dom=fakeDom(t),saved=[];
  const root=shoppingPreferencesPanel({mappings:[],exclusions:[{foodId:'water',name:'Tap water',scope:'always'},{foodId:'salt',name:'Salt',scope:'2026-10-19/2026-10-25'},{foodId:'old',name:'Old exclusion',scope:'2026-09-01/2026-09-02'}]},
    {startDate:'2026-10-19',endDate:'2026-10-25',save:async data=>{saved.push(data);}});
  assert.match(dom.texts(root),/Tap water.*Réafficher/);assert.match(dom.texts(root),/Salt.*masqué pour ces courses/);assert.equal(dom.texts(root).includes('Old exclusion'),false);
  await dom.find(root,e=>e.textContent==='Réafficher').listeners.click();assert.deepEqual(saved[0],{kind:'exclusion',foodId:'water',scope:'always',startDate:'2026-10-19',endDate:'2026-10-25',excluded:false});
});
test('saved mappings can be inspected, edited or removed and conversion errors keep the form available',async t=>{
  const dom=fakeDom(t),saved=[];
  const preferences={exclusions:[],mappings:[{foodId:'hard',name:'Hard eggs',purchaseFoodId:'raw',purchaseName:'Raw eggs',sourceUnitId:'piece',targetUnitId:'piece',factor:1}]};
  const panel=shoppingPreferencesPanel(preferences,{startDate:'2026-10-19',endDate:'2026-10-25',save:async data=>{saved.push(data);}});
  assert.match(dom.texts(panel),/Hard eggs → Raw eggs/);
  await dom.find(panel,e=>e.textContent==='Retirer ce regroupement').listeners.click();assert.deepEqual(saved[0],{foodId:'hard',kind:'product',purchaseFoodId:null});
  const root=shoppingPreferenceControls({foodId:'hard',name:'Hard',unitId:'piece'},preferences,{save:async()=>{throw {body:{error:'ingredient-conversion-missing'}};}});
  const remove=dom.find(root,e=>e.textContent==='Retirer ce regroupement');await remove.listeners.click();assert.equal(remove.disabled,false);assert.match(dom.texts(root),/équivalences en grammes/);
  assert.match(shoppingPreferenceError({message:'purchase-source-stock-present'}),/stock.*zéro/);
});

test('an incomplete product choice always reports why no request was sent',async t=>{
 const dom=fakeDom(t);let calls=0;
 const root=shoppingPreferenceControls({foodId:'tomato',name:'Purée',unitId:'g'},{mappings:[],exclusions:[]},{save:async()=>{calls++;}});
 const form=dom.find(root,e=>e.tag==='form');assert.equal(form.noValidate,true);
 form.reportValidity=()=>false;form.listeners.submit({preventDefault(){}});
 assert.equal(calls,0);assert.match(dom.texts(root),/Regroupement non enregistré.*choisis le produit/);
});
