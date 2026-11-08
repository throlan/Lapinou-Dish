import test from 'node:test';
import assert from 'node:assert/strict';
import {cappedMealPortions} from '../web/portion-planner.js';
import {servingIngredientLoad} from '../src/server/serving-limits.mjs';

const rows=(parts,loads,densities,steps=[])=>parts.map((servingPart,i)=>({parentRecipeId:'plate',plateParts:parts,servingPart,
  recipeUnit:'g',role:i?'accompaniment':'main',budgetFraction:1/parts.length,servingLoad:loads[i],
  recipeKcal:densities[i],countStep:steps[i]}));
const quantities=result=>result.proposals.map(row=>row.quantity);
const close=(a,b)=>assert.ok(Math.abs(a-b)<0.00005,a+' vs '+b);

test('two-part plate adjusts the mixed main and prioritizes starch while respecting the raw meat cap',()=>{
  const plate=rows(['main','starch'],[{meat:.5},{starch:1}],[1,1]);
  const ratios={whole:{main:1},separate:{main:.66,starch:.34},three:{main:.25,starch:.25,vegetables:.5}};
  assert.deepEqual(quantities(cappedMealPortions(plate,300,ratios)),[200,100]);
  assert.deepEqual(quantities(cappedMealPortions(plate,430)),[250,180]);
  assert.deepEqual(quantities(cappedMealPortions(plate,900)),[250,200]);
});

test('three-part plate reallocates to starch and vegetables, then leaves unused calories at the starch cap',()=>{
  const plate=rows(['main','starch','vegetables'],[{fish:1.25},{starch:1},{}],[1,1,1]);
  let q=quantities(cappedMealPortions(plate,500));
  close(q[0],120);close(q[1],130);close(q[2],260);
  q=quantities(cappedMealPortions(plate,900));
  close(q[0],120);close(q[1],200);close(q[2],400);
});

test('only the actual calories of extras are reserved before sizing a plate',()=>{
  const plate=rows(['main','starch','vegetables'],[{meat:1},{starch:1},{vegetables:1}],[1,1,.5]);
  plate.forEach(row=>row.budgetFraction=.25);
  const extra={role:'sauce',assignment:{},quantity:1,recipeUnit:'portion',recipeKcal:15};
  const result=cappedMealPortions([...plate,extra],300);
  assert.deepEqual(quantities(result),[125,80,160,1]);
  const limited=cappedMealPortions(plate,300,undefined,{starch:60});
  assert.deepEqual(quantities(limited),[125,60,120]);
  assert.match(limited.warnings.join(' '),/80 g/);
});

test('keeps the 80 g minimum and the vegetable ratio even when the target is exceeded',()=>{
  const plate=rows(['main','starch','vegetables'],[{meat:1},{starch:1},{vegetables:1}],[2,1,.5]);
  const result=cappedMealPortions(plate,300);
  assert.deepEqual(quantities(result),[125,80,160]);
  assert.equal(result.estimatedKcal,410);
  assert.equal(result.withinBudget,false);
});

test('a mixed gram dish adapts to the meal and uses the configured served-weight cap',()=>{
  const plate=rows(['main'],[{meat:.1,vegetables:.8}],[.5]);
  assert.deepEqual(quantities(cappedMealPortions(plate,172)),[350]);
  assert.deepEqual(quantities(cappedMealPortions(plate,500)),[750]);
  assert.deepEqual(quantities(cappedMealPortions(plate,500,undefined,{mixed:550})),[550]);
});

test('mixed pieces use each meal target and account for explicit additions',()=>{
  const dish={recipeUnit:'piece',role:'main',recipeKcal:200,budgetFraction:1,quantity:3};
  const sauce={recipeUnit:'portion',role:'sauce',recipeKcal:100,quantity:1,assignment:{}};
  assert.deepEqual(quantities(cappedMealPortions([dish,sauce],390)),[1,1]);
  assert.deepEqual(quantities(cappedMealPortions([dish,sauce],690)),[2,1]);
});

test('the two-part soup does not scale its entire mixed main up to the meat cap',()=>{
  const plate=rows(['main','starch'],[{meat:125/1162.88437,vegetables:.8},{starch:1}],[.486,1.51]);
  const [soup,starch]=quantities(cappedMealPortions(plate,390));
  assert.ok(soup>=300&&soup<500);
  assert.ok(starch>=80);
  assert.equal(soup%10,0);
  assert.equal(starch%10,0);
});

test('fish and eggs in a single protein component share the same serving ceiling',()=>{
  const plate=rows(['main','starch','vegetables'],
    [{fish:150/396.8,eggs:3/396.8},{starch:1},{vegetables:1}],[1.5,1,.5]);
  const small=cappedMealPortions(plate,390);
  const large=cappedMealPortions(plate,650);
  assert.deepEqual(quantities(small),[198.4,80,160]);
  assert.equal(large.proposals[0].quantity,198.4);
  const personalized=cappedMealPortions(plate,390,undefined,{fish:100,eggs:2});
  assert.ok(Math.abs(personalized.proposals[0].quantity-396.8/3)<.00001);
  assert.equal(cappedMealPortions(plate,390,undefined,{fish:150,eggs:3}).proposals[0].quantity,198.4);
});

test('counted eggs cannot exceed three and bread rounds down if the next slice exceeds 200 g',()=>{
  const plate=rows(['main','starch','vegetables'],[{eggs:1/50},{starch:1},{}],[1.5,2,.5],[50,45]);
  const [egg,bread,veg]=quantities(cappedMealPortions(plate,1200));
  assert.equal(egg,150);assert.equal(bread,180);assert.equal(veg,360);
});

test('mixed recipes keep their composition and competing recipes share caps',()=>{
  const plate=rows(['main'],[{meat:.5,starch:.5}],[1]);
  assert.deepEqual(quantities(cappedMealPortions(plate,900)),[250]);
  const mixed={role:'main',recipeUnit:'portion',quantity:4,recipeKcal:100,servingLoad:{meat:100,starch:75}};
  const other={role:'main',recipeUnit:'g',quantity:300,recipeKcal:1,servingLoad:{meat:.5,starch:1}};
  assert.deepEqual(quantities(cappedMealPortions([mixed,other],900)),[1,50]);
});

test('the ingredient load separates raw protein, cooked starch and counted eggs',()=>{
  const food=(category,name)=>({category,name,gramsPerUnit:{}});
  const line={quantity:100,unitId:'g',cookingState:'cooked_from_raw',foodCookingFactor:.75};
  assert.deepEqual(servingIngredientLoad(line,food('Viandes','Poulet cru'),{},'main'),{meat:100});
  assert.deepEqual(servingIngredientLoad({...line,cookingState:'already_cooked'},food('Poissons','Cabillaud cuit'),{},'main'),{fish:100/.75});
  assert.deepEqual(servingIngredientLoad({...line,foodCookingFactor:3},food('Féculents','Riz cru'),{},'starch'),{starch:300});
  assert.deepEqual(servingIngredientLoad({...line,foodCookingFactor:3,cookingState:'already_cooked'},food('Féculents','Riz cuit'),{},'starch'),{starch:100});
  assert.deepEqual(servingIngredientLoad({quantity:4,unitId:'piece'},food('Œufs','Oeuf cru'),{},'main'),{eggs:4});
  const missing={role:'main',recipeUnit:'g',quantity:100,recipeKcal:1,servingLoad:{fish:null}};
  const result=cappedMealPortions([missing],500);assert.equal(result.proposals[0].quantity,null);assert.ok(result.warnings.length);
});

