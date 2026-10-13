import test from 'node:test';
import assert from 'node:assert/strict';
import { shoppingPurchaseQuantity, validateProductionInput, validateRoutineSettings, validateShoppingLineState } from '../src/server/household-planning.mjs';

const householdId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const foodId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const recipeId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

test('routine settings require exactly one valid setting per routine', () => {
  const routines = [
    ['bulk_shopping','monthly'], ['fresh_shopping','weekly'], ['whey_flour_order','monthly'],
    ['pasta_pastry_production','monthly'], ['bread_production','monthly'], ['batch_cooking','weekly'],
  ].map(([routineId,frequency]) => ({routineId,frequency,nextDate:'2026-10-19'}));
  assert.equal(validateRoutineSettings(routines).data.length, 6);
  assert.equal(validateRoutineSettings(routines.slice(1)).error, 'invalid-routines');
  assert.equal(validateRoutineSettings(routines.map((r,i)=>i===1?{...r,frequency:'daily'}:r)).error, 'invalid-routine');
});

test('production lot input validates household, date, quantity and storage', () => {
  const input = {householdId,recipeId,producedOn:'2026-10-12',quantity:24,storage:'freezer',note:'Batch du lundi'};
  assert.equal(validateProductionInput(input).data.quantity, 24);
  assert.equal(validateProductionInput({...input,quantity:0}).error, 'invalid-production');
  assert.equal(validateProductionInput({...input,producedOn:'2026-02-30'}).error, 'invalid-production');
});

test('shopping line changes validate period and category', () => {
  const input = {householdId,foodId,unitId:'g',startDate:'2026-10-12',endDate:'2026-11-10',groupId:'fresh',checked:true};
  assert.equal(validateShoppingLineState(input).data.checked, true);
  assert.equal(validateShoppingLineState({...input,groupId:'unknown'}).error, 'invalid-shopping-line');
  assert.equal(validateShoppingLineState({...input,endDate:'2026-10-01'}).error, 'invalid-shopping-line');
});

test('shopping quantities sum recipe needs and round fractional pieces up for purchase', () => {
  assert.equal(shoppingPurchaseQuantity(2+1,'piece'),3);
  assert.equal(shoppingPurchaseQuantity(2.1,'piece'),3);
  assert.equal(shoppingPurchaseQuantity(3,'piece'),3);
  assert.equal(shoppingPurchaseQuantity(2.1,'g'),2.1);
});
