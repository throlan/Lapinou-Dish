import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateReserveBalance, isAdultOn, validateSavingPlan } from '../src/server/energy-reserve.mjs';

const householdId='11111111-1111-4111-8111-111111111111';
const personId='33333333-3333-4333-8333-333333333333';

test('reserve balance rolls over the latest 30 days of known planned deltas',()=>{
  const result=calculateReserveBalance([
    {date:'2026-08-10',deltaKcal:300},
    {date:'2026-10-01',deltaKcal:90},
    {date:'2026-10-02',deltaKcal:-20},
    {date:'2026-10-02',deltaKcal:null},
  ]);
  assert.equal(result.balanceKcal,70);assert.equal(result.startsOn,'2026-09-03');assert.equal(result.endsOn,'2026-10-02');
});

test('reserve spending consumes the oldest credit before that credit expires',()=>{
  const beforeExpiry=calculateReserveBalance([{date:'2026-09-01',deltaKcal:100},{date:'2026-09-30',deltaKcal:-20}]);
  assert.equal(beforeExpiry.balanceKcal,80);
  const afterExpiry=calculateReserveBalance([{date:'2026-09-01',deltaKcal:100},{date:'2026-09-30',deltaKcal:-20},{date:'2026-10-01',deltaKcal:null}]);
  assert.equal(afterExpiry.balanceKcal,0);
});

test('saving plans accept adult date ranges up to 30 days and reasonable daily amounts',()=>{
  assert.equal(isAdultOn('2000-10-13','2026-10-13'),true);
  assert.equal(isAdultOn('2010-10-13','2026-10-13'),false);
  const input={householdId,personId,startsOn:'2026-10-13',endsOn:'2026-10-26',dailyKcal:100};
  assert.equal(validateSavingPlan(input).data.dailyKcal,100);
  assert.equal(validateSavingPlan({...input,endsOn:'2026-11-12'}).error,'invalid-saving-plan');
  assert.equal(validateSavingPlan({...input,dailyKcal:0}).error,'invalid-saving-plan');
});
