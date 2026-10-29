import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const app=await readFile(new URL('../web/app.js',import.meta.url),'utf8');
const html=await readFile(new URL('../web/index.html',import.meta.url),'utf8');

test('opening administration loads and renders production categories before editing them',async()=>{
  const start=app.indexOf('async function refreshMealSettings()');
  const end=app.indexOf("\n$('#meal-ratios-form').addEventListener",start);
  assert.ok(start>=0&&end>start);
  const slots=['breakfast','lunch','snack','dinner','evening_snack'];
  const ratios=Object.fromEntries(slots.map(slot=>[slot,.2]));
  const form={elements:Object.fromEntries(slots.map(slot=>[slot,{value:''}]))};
  const message={},state={household:{id:'household'}};let loadedTypes=0,renderedRows=[];
  const context={
    state,MEAL_ORDER:slots,
    $:selector=>selector==='#meal-ratios-form'?form:selector==='button[type="submit"]'?{disabled:false}:message,
    api:async path=>path.startsWith('/api/meal-settings')?{ratios}:({productionTypes:[]}),
    refreshPeople:async()=>{},refreshProductionTypes:async()=>{loadedTypes++;state.productionTypes=[{id:'bread',label:'Pain'},{id:'pasta',label:'Pâtes'}];context.renderProductionTypeRows();},
    refreshProteinSettings:async()=>{},updateMealRatiosPreview(){},refreshPlateSettings:async()=>{},refreshFoodYieldConversions:async()=>{},refreshMealAdditions:async()=>{},
    renderProductionTypeRows(){renderedRows=context.state.productionTypes;},showMessage(){},
  };
  runInNewContext(app.slice(start,end)+'\nglobalThis.refresh=refreshMealSettings;',context);
  await context.refresh();
  assert.equal(loadedTypes,1);
  assert.deepEqual(Array.from(renderedRows,item=>item.label),['Pain','Pâtes']);
});

test('administration presents compact accessible tabs and recipe-specific minimum controls',()=>{
  const tabs=[...html.matchAll(/data-admin-tab="([^"]+)"/g)].map(match=>match[1]);
  const panels=[...html.matchAll(/data-admin-panel="([^"]+)"/g)].map(match=>match[1]);
  assert.deepEqual(tabs,panels);
  assert.equal(tabs.length,7);
  assert.match(html,/name="minimumProductionAmount"/);
  assert.match(html,/name="minimumProductionUnitId"/);
});
