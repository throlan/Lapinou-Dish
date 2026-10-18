import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {purchaseEntry} from '../src/server/shopping-presentation.mjs';

const eggs={foodId:'eggs',name:'Œuf cru',unitId:'g',quantity:1268.36,neededQuantity:1268.36,purchaseRuleApplied:true,
  purchaseRule:{coveredQuantity:50,coveredUnitId:'g',singularLabel:'œuf',pluralLabel:'œufs'}};

test('26 eggs are entered as 26 purchase units covering 50 g each, rather than 1300 grams',()=>{
  const entry=purchaseEntry(eggs);assert.equal(entry.quantity,26);assert.equal(entry.label,'œufs');assert.equal(entry.multiplier,50);
  assert.equal(entry.gramsPerEntry,50);assert.equal(entry.step,'1');assert.equal(entry.unitId,'g');assert.equal(entry.detail,'1 œuf = 50 g');
  assert.equal(400/entry.gramsPerEntry,8);assert.equal(30*entry.multiplier,1500);
});
test('packs take priority over purchase rules, native pieces remain pieces and unknown equivalences are not invented',()=>{
  const pack=purchaseEntry({...eggs,packageQuantity:300,packageCount:5});assert.equal(pack.kind,'package');assert.equal(pack.label,'paquets');assert.equal(pack.multiplier,300);assert.equal(pack.quantity,5);
  const piece=purchaseEntry({unitId:'piece',quantity:3,gramsPerUnit:{piece:50}});assert.equal(piece.quantity,3);assert.equal(piece.gramsPerEntry,50);assert.equal(piece.multiplier,1);assert.equal(piece.label,'pièces');
  const grams=purchaseEntry({unitId:'g',quantity:150.5});assert.equal(grams.quantity,150.5);assert.equal(grams.step,'any');assert.equal(grams.multiplier,1);
  const unknown=purchaseEntry({unitId:'ml',quantity:200});assert.equal(unknown.gramsPerEntry,null);assert.equal(unknown.label,'ml');
  const failedRule=purchaseEntry({...eggs,purchaseRuleApplied:false});assert.equal(failedRule.label,'g');assert.equal(failedRule.multiplier,1);
});

async function editor(item){
  const source=await readFile(new URL('../web/app.js',import.meta.url),'utf8');
  const start=source.indexOf("          const inventoryActions=document.createElement('div');"),last="          });inventoryActions.append(receipt);main.append(inventoryActions);";
  const end=source.indexOf(last,start)+last.length;
  const element=()=>({children:[],listeners:{},append(...children){this.children.push(...children);},addEventListener(name,fn){this.listeners[name]=fn;},reportValidity(){return true;}});
  const calls=[],messages=[],entry=purchaseEntry(item);
  const context={item,entry,stockCount:8,existing:{quantityG:400,version:7},main:element(),document:{createElement:element},state:{household:{id:'house'}},
    formatQty:String,window:{scrollY:100,scrollTo(){}},refreshShopping:async()=>{},refreshDashboard:async()=>{},
    newProductionRequestId:()=> 'request',$:()=>({}),showMessage(_root,message){messages.push(message);},shoppingPreferenceError:()=> 'Error',
    api:async(url,options)=>{const body=JSON.parse(options.body);calls.push({url,body});return {quantityG:body.quantity};}};
  runInNewContext(source.slice(start,end)+'\nglobalThis.ui={countLabel,countQuantity,countForm,countHint,receiptLabel,receiptQuantity,receipt};',context);
  return {ui:context.ui,calls,messages};
}
test('the actual count and receipt forms show eggs and send a single conversion to the existing stock endpoints',async()=>{
  const {ui,calls,messages}=await editor(eggs);
  assert.match(ui.receiptLabel.textContent,/\(œufs\)/);assert.equal(ui.receiptQuantity.value,'26');assert.equal(ui.receiptQuantity.step,'1');
  assert.match(ui.countLabel.textContent,/\(œufs\)/);assert.equal(ui.countQuantity.step,'any');assert.match(ui.countHint.textContent,/8 œufs.*1 œuf = 50 g/);
  ui.receiptQuantity.value='30';await ui.receipt.listeners.submit({preventDefault(){}});
  assert.equal(calls[0].body.quantity,1500);assert.equal(calls[0].body.unitId,'g');assert.match(messages[0],/30 œufs.*1500/);
  ui.countQuantity.value='12';await ui.countForm.listeners.submit({preventDefault(){}});
  assert.equal(calls[1].body.quantity,600);assert.equal(calls[1].body.unitId,'g');assert.equal(calls[1].body.version,7);assert.match(messages[1],/12 œufs.*600/);
});
test('a partially used pack can be counted while purchased packs and piece quantities keep their matching input units',async()=>{
  const {ui,calls}=await editor({...eggs,packageQuantity:500,packageCount:3});
  assert.match(ui.receiptLabel.textContent,/paquets/);assert.equal(ui.receiptQuantity.value,'3');assert.equal(ui.countQuantity.step,'any');
  ui.countQuantity.value='0.5';await ui.countForm.listeners.submit({preventDefault(){}});assert.equal(calls[0].body.quantity,250);
  const native=await editor({foodId:'flour',name:'Flour',unitId:'g',quantity:350,neededQuantity:350});
  assert.equal(native.ui.receiptQuantity.value,'350');native.ui.receiptQuantity.value='400';await native.ui.receipt.listeners.submit({preventDefault(){}});assert.equal(native.calls[0].body.quantity,400);
});
