import test from 'node:test';
import assert from 'node:assert/strict';
import { groupPreparations, suggestedProductionQuantity, scaledIngredients, productionRecipe } from '../web/cooking-sheet.js';

test('three served parts become one cooking task with enough whole portions for every part', () => {
  const recipe={id:'parent',yield:{amount:4,unitId:'portion'},lines:[
    {foodName:'Bœuf',quantity:400,unitId:'g',servingPart:'main'},
    {foodName:'Riz',quantity:200,unitId:'g',servingPart:'starch'},
  ]};
  const groups=groupPreparations([
    {recipeId:'starch',parentRecipeId:'parent',yieldAmount:800,toMakeQuantity:440},
    {recipeId:'vegetables',parentRecipeId:'parent',yieldAmount:1200,toMakeQuantity:880},
    {recipeId:'main',parentRecipeId:'parent',yieldAmount:600,toMakeQuantity:440},
  ]);
  assert.equal(groups.length,1);
  assert.equal(groups[0].parts.length,3);
  assert.equal(suggestedProductionQuantity(groups[0],recipe),3);
  assert.deepEqual(scaledIngredients(recipe,3).map(line=>line.scaledQuantity),[300,150]);
});

test('one covered part does not reduce another part’s production need', () => {
  const group=groupPreparations([
    {recipeId:'main',parentRecipeId:'parent',yieldAmount:500,toMakeQuantity:0},
    {recipeId:'starch',parentRecipeId:'parent',yieldAmount:500,toMakeQuantity:250},
  ])[0];
  assert.equal(suggestedProductionQuantity(group,{yield:{amount:10,unitId:'portion'}}),5);
});

test('whole preparations use the served grams rather than rounding the source portions up', () => {
  const recipe={id:'parent',yield:{amount:4,unitId:'portion'},
    servingParts:[{id:'whole',yield:{amount:2760,unitId:'g'}}],
    lines:[{quantity:600,unitId:'g'},{quantity:480,unitId:'g'}]};
  const group=groupPreparations([{recipeId:'whole',parentRecipeId:'parent',yieldAmount:2760,toMakeQuantity:5340}])[0];
  assert.equal(productionRecipe(recipe).id,'whole');
  assert.equal(suggestedProductionQuantity(group,recipe),5340);
  const lines=scaledIngredients(recipe,5340);
  assert.ok(Math.abs(lines[0].scaledQuantity-600*5340/2760)<1e-9);
  assert.ok(Math.abs(lines[1].scaledQuantity-480*5340/2760)<1e-9);
  assert.equal(suggestedProductionQuantity({...group,parts:[{...group.parts[0],toMakeQuantity:0}]},recipe),0);
});

test('pieces keep whole manufacturing units and mass or volume yields keep their units', () => {
  const group={parts:[{yieldAmount:24,toMakeQuantity:7}]};
  const pieces={id:'muffins',yield:{amount:24,unitId:'piece'},lines:[{quantity:240,unitId:'g'}]};
  assert.equal(productionRecipe(pieces),pieces);
  assert.equal(suggestedProductionQuantity(group,pieces),7);
  assert.equal(scaledIngredients(pieces,7)[0].scaledQuantity,70);
  assert.equal(suggestedProductionQuantity({parts:[{yieldAmount:24,toMakeQuantity:7.2}]},pieces),8);
  for(const unitId of ['g','ml']){
    assert.equal(suggestedProductionQuantity({parts:[{yieldAmount:100,toMakeQuantity:173.456}]},{yield:{amount:100,unitId}}),173.456);
  }
});
