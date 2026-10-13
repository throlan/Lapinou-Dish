import test from 'node:test';
import assert from 'node:assert/strict';
import { ingredientProjection, productionDeductions, validateIngredientStock } from '../src/server/ingredient-stock.mjs';

const householdId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',foodId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
test('inventory validates nonnegative counts, target above minimum and bounded lead time',()=>{
  const input={householdId,foodId,quantityG:1000,minimumG:200,targetG:2000,leadDays:7,version:0};
  assert.ok(validateIngredientStock(input).data);
  for(const invalid of [{quantityG:-1},{minimumG:3000},{leadDays:61},{version:null},{foodId:'unknown'}])assert.equal(validateIngredientStock({...input,...invalid}).error,'invalid-ingredient-stock');
});
test('duplicate recipe lines are consolidated before checking ingredient availability',()=>{
  const line={foodId,name:'Whey',quantity:60,unitId:'g',quantityG:100};
  assert.equal(productionDeductions([line,line],12,12).error,'ingredient-stock-insufficient');
  const result=productionDeductions([{...line,quantityG:200},{...line,quantityG:200}],12,12);
  assert.equal(result.items.length,1);assert.equal(result.items[0].usedG,120);
});
test('the shown 24-muffin recipe deducts its own quantities, not generic muffin values',()=>{
  const lines=[['whey',80],['flour-t65',160],['flour-t110',160]].map(([foodId,quantity])=>({foodId,name:foodId,quantity,unitId:'g',quantityG:1000}));
  const result=productionDeductions(lines,24,24);
  assert.deepEqual(result.items.map(item=>item.usedG),[80,160,160]);
  assert.deepEqual(productionDeductions(lines,48,24).items.map(item=>item.usedG),[160,320,320]);
});
test('volumes and pieces only deduct inventory with documented food conversions',()=>{
  const line={foodId,name:'Ingredient',quantity:2,unitId:'piece',quantityG:1000,gramsPerUnit:{piece:'30'}};
  assert.equal(productionDeductions([line],24,12).items[0].usedG,120);
  assert.equal(productionDeductions([{...line,unitId:'ml',gramsPerMillilitre:'0.8'}],24,12).items[0].usedG,3.2);
  assert.equal(productionDeductions([{...line,unitId:'ml'}],24,12).error,'ingredient-conversion-missing');
});
test('order quantities preserve the safety minimum after planned use',()=>{
  const stock={foodId,quantityG:500,minimumG:100,targetG:1000};
  const result=ingredientProjection(stock,[{foodId,quantity:2000,unitId:'g'}]);
  assert.equal(result.orderG,1600);assert.equal(result.projectedG,-1500);
  assert.equal(ingredientProjection(stock,[]).orderG,0);
});
