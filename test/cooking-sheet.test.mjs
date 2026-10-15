import test from 'node:test';
import assert from 'node:assert/strict';
import { groupPreparations, suggestedProductionQuantity, scaledIngredients } from '../web/cooking-sheet.js';

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
