import test from 'node:test';
import assert from 'node:assert/strict';
import { purchaseDescription,shoppingExportDescription,shoppingExportLine } from '../src/server/shopping-presentation.mjs';
import { exportToHomeAssistant } from '../src/server/home-assistant-shopping.mjs';

test('shopping presentation separates recipe needs from practical purchase units',()=>{
  assert.deepEqual(purchaseDescription({name:'Ail, cru',unitId:'piece',quantity:3,neededQuantity:2.49}),
    {text:'1 tête d’ail',detail:'3 gousses nécessaires (≈ 0,33 tête)'});
  assert.equal(purchaseDescription({name:'Basilic, frais',unitId:'piece',quantity:1,neededQuantity:1}).text,'1 bouquet de basilic');
  assert.deepEqual(purchaseDescription({name:'Basilic, frais',unitId:'g',quantity:5,neededQuantity:5}),
    {text:'1 bouquet de basilic (minimum)',detail:'Besoin : 5 g ; vérifier que le bouquet suffit'});
  assert.deepEqual(purchaseDescription({name:'Gingembre, racine fraîche',unitId:'g',quantity:65,neededQuantity:3}),
    {text:'1 racine de gingembre',detail:'Besoin : 3 g · racine indicative 50–80 g (calcul à 65 g)'});
  assert.equal(purchaseDescription({name:'Gingembre, racine fraîche',unitId:'g',quantity:90,neededQuantity:90}).text,'2 racines de gingembre');
  assert.equal(purchaseDescription({name:'Ail, cru',unitId:'piece',quantity:9,neededQuantity:9,packageQuantity:12,packageCount:1}).text,'1 × 12 piece');
  const peanutButter={name:'Beurre de cacahuète',unitId:'g',quantity:500,neededQuantity:400};
  assert.equal(shoppingExportLine(peanutButter),'Beurre de cacahuète — 500 g');
  assert.equal(shoppingExportDescription(peanutButter),'Besoin : 400 g');
});

test('Home Assistant export adds current items and removes stale Lapinou lines only',async()=>{
  const calls=[];
  const item={name:'Ail, cru',unitId:'piece',quantity:3,neededQuantity:3,checked:false};
  const line=shoppingExportLine(item);
  const stale='Beurre de cacahuète — 1 × 500 g (Besoin : 400 g)';
  const fetchImpl=async(url,options)=>{
    calls.push({url,headers:options.headers,body:JSON.parse(options.body)});
    return {ok:true,async json(){return url.includes('get_items')?{service_response:{'todo.grand_frais':{items:[{summary:line},{summary:stale,uid:'old-item'},
      {summary:'Ancien produit suivi',description:'Lapinou Dish · Besoin : 1 pièce',uid:'managed-old'},{summary:'Rappel personnel'}]}}}:[];}};
  };
  const result=await exportToHomeAssistant([item,{...item,name:'Basilic',checked:true},{...item,name:'Gingembre',quantity:1}],
    'todo.grand_frais',{url:'http://localhost:8123',token:'test-secret',fetchImpl});
  assert.deepEqual(result,{added:1,skipped:1,removed:2});
  assert.equal(calls.length,4);
  assert.equal(calls[0].url,'http://localhost:8123/api/services/todo/get_items?return_response=true');
  assert.deepEqual(calls[0].body,{entity_id:'todo.grand_frais',status:'needs_action'});
  assert.equal(calls[1].body.entity_id,'todo.grand_frais');
  assert.match(calls[1].body.item,/Gingembre/);
  assert.match(calls[1].body.description,/Lapinou Dish ·/);
  assert.equal(calls[1].headers.Authorization,'Bearer test-secret');
  assert.equal(calls[2].url,'http://localhost:8123/api/services/todo/remove_item');
  assert.deepEqual(calls[2].body,{entity_id:'todo.grand_frais',item:'old-item'});
  assert.deepEqual(calls[3].body,{entity_id:'todo.grand_frais',item:'managed-old'});
  assert.deepEqual(await exportToHomeAssistant([],'todo.grand_frais',{}),{error:'home-assistant-not-configured'});
  assert.deepEqual(await exportToHomeAssistant([],'light.test',{url:'http://localhost',token:'x',fetchImpl}),{error:'home-assistant-list-not-configured'});
});
