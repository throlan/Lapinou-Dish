import test from 'node:test';
import assert from 'node:assert/strict';
import { filterRecipeDirectory, recipeMissingData } from '../web/recipe-directory.js';

const recipes=[
  {name:'Soupe',recipeType:'dish',mealMoments:['dinner'],instructions:'Mixer.',imageAvailable:true,nutrition:{complete:true}},
  {name:'Skyr vanille',recipeType:'dessert',mealMoments:['breakfast'],instructions:'',imageAvailable:false,nutrition:{complete:false}},
];

test('recipe directory filters by normalized query, type, moment and missing data',()=>{
  assert.deepEqual(filterRecipeDirectory(recipes,{query:'soupe',type:'dish'}).map(r=>r.name),['Soupe']);
  assert.deepEqual(filterRecipeDirectory(recipes,{moment:'breakfast'}).map(r=>r.name),['Skyr vanille']);
  assert.deepEqual(filterRecipeDirectory(recipes,{missing:'any'}).map(r=>r.name),['Skyr vanille']);
  assert.deepEqual(filterRecipeDirectory(recipes,{missing:'image'}).map(r=>r.name),['Skyr vanille']);
  assert.deepEqual(recipeMissingData(recipes[0]),[]);
});
