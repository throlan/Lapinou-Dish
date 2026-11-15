import test from 'node:test';
import assert from 'node:assert/strict';
import {filterPreparationStock} from '../web/preparation-stock-filters.js';
const row=(id,physicalQuantity,plannedQuantity)=>({id,physicalQuantity,plannedQuantity,availableQuantity:physicalQuantity-plannedQuantity,producedQuantity:20,lots:[{id:'historical-'+id}]});
const stock=[row('empty',0,0),row('remaining',14,0),row('missing',0,4),row('partial',2,4),row('reserved',4,4),row('negative',-2,0)];
const ids=items=>items.map(i=>i.id);
test('default hides exhausted unreserved history while retaining reservations and negative corrections',()=>{
 assert.deepEqual(ids(filterPreparationStock(stock)),['remaining','missing','partial','reserved','negative']);
 assert.deepEqual(ids(filterPreparationStock(stock,'all')),ids(stock));assert.equal(stock[0].lots.length,1);
});
test('remaining is physical stock, including reserved portions; to redo includes shortages and deficits',()=>{
 assert.deepEqual(ids(filterPreparationStock(stock,'remaining')),['remaining','partial','reserved']);
 assert.deepEqual(ids(filterPreparationStock(stock,'needed')),['missing','partial','negative']);
 assert.equal(filterPreparationStock([row('rounded',1e-10,0)]).length,0);
 assert.equal(filterPreparationStock([row('small',0.01,0)]).length,1);
});
test('stock corrections and new reservations change filter membership without altering lots',()=>{
 const item=row('counted',10,0),items=[item];assert.equal(filterPreparationStock(items).length,1);
 item.physicalQuantity=0;item.availableQuantity=0;assert.equal(filterPreparationStock(items).length,0);
 item.plannedQuantity=4;item.availableQuantity=-4;assert.equal(filterPreparationStock(items).length,1);assert.equal(filterPreparationStock(items,'needed').length,1);
 assert.equal(item.producedQuantity,20);assert.deepEqual(item.lots,[{id:'historical-counted'}]);
});
