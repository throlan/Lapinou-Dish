import test from 'node:test';
import assert from 'node:assert/strict';
import { purchaseDescription,shoppingExportLine } from '../src/server/shopping-presentation.mjs';
import { exportToHomeAssistant } from '../src/server/home-assistant-shopping.mjs';

test('shopping presentation separates recipe needs from practical purchase units',()=>{
  assert.deepEqual(purchaseDescription({name:'Ail, cru',unitId:'piece',quantity:3,neededQuantity:2.49}),
    {text:'1 tête d’ail',detail:'3 gousses nécessaires (≈ 0,33 tête)'});
  assert.equal(purchaseDescription({name:'Basilic, frais',unitId:'piece',quantity:1,neededQuantity:1}).text,'1 bouquet de basilic');
  assert.match(purchaseDescription({name:'Basilic, frais',unitId:'g',quantity:5,neededQuantity:5}).detail,/5 g/);
  assert.deepEqual(purchaseDescription({name:'Gingembre, racine fraîche',unitId:'g',quantity:65,neededQuantity:3}),
    {text:'1 racine de gingembre',detail:'Besoin : 3 g · racine indicative 50–80 g (calcul à 65 g)'});
  assert.equal(purchaseDescription({name:'Gingembre, racine fraîche',unitId:'g',quantity:90,neededQuantity:90}).text,'2 racines de gingembre');
  assert.equal(purchaseDescription({name:'Ail, cru',unitId:'piece',quantity:9,neededQuantity:9,packageQuantity:12,packageCount:1}).text,'1 × 12 piece');
});

test('Home Assistant export writes only unchecked, non-duplicate items to the chosen list',async()=>{
  const calls=[];
  const item={name:'Ail, cru',unitId:'piece',quantity:3,neededQuantity:3,checked:false};
  const line=shoppingExportLine(item);
  const fetchImpl=async(url,options)=>{
    calls.push({url,headers:options.headers,body:JSON.parse(options.body)});
    return {ok:true,async json(){return url.includes('get_items')?{service_response:{'todo.grand_frais':{items:[{summary:line}]}}}:[];}};
  };
  const result=await exportToHomeAssistant([item,{...item,name:'Basilic',checked:true},{...item,name:'Gingembre',quantity:1}],
    'todo.grand_frais',{url:'http://localhost:8123',token:'test-secret',fetchImpl});
  assert.deepEqual(result,{added:1,skipped:1});
  assert.equal(calls.length,2);
  assert.equal(calls[0].url,'http://localhost:8123/api/services/todo/get_items?return_response=true');
  assert.deepEqual(calls[0].body,{entity_id:'todo.grand_frais',status:'needs_action'});
  assert.equal(calls[1].body.entity_id,'todo.grand_frais');
  assert.match(calls[1].body.item,/Gingembre/);
  assert.equal(calls[1].headers.Authorization,'Bearer test-secret');
  assert.deepEqual(await exportToHomeAssistant([],'todo.grand_frais',{}),{error:'home-assistant-not-configured'});
  assert.deepEqual(await exportToHomeAssistant([],'light.test',{url:'http://localhost',token:'x',fetchImpl}),{error:'home-assistant-list-not-configured'});
});
