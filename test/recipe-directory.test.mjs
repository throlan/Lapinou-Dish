import test from 'node:test';
import assert from 'node:assert/strict';
import { filterRecipeDirectory, recipeCardForSource, recipeMissingData } from '../web/recipe-directory.js';

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

test('shopping sources for split preparations open their parent recipe card',()=>{
  const parent={id:'parent',name:'Bœuf, riz et légumes',servingParts:[{id:'meat'},{id:'rice'},{id:'vegetables'}]};
  assert.equal(recipeCardForSource([parent],'rice'),parent);
  assert.equal(recipeCardForSource([parent],'parent'),parent);
  assert.equal(recipeCardForSource([parent],'missing'),null);
});


test('nutrition planned filter shows only incomplete recipes planned this month or later',()=>{
  const planned=[
    {...recipes[1],id:'planned-incomplete'},
    {...recipes[0],id:'planned-complete'},
    {...recipes[1],id:'not-planned'},
  ];
  assert.deepEqual(filterRecipeDirectory(planned,{missing:'nutrition-planned',plannedRecipeIds:['planned-incomplete','planned-complete']}).map(r=>r.id),['planned-incomplete']);
});

test('nutrition planned filter recognizes a scheduled serving part as its parent recipe',()=>{
  const parent={...recipes[0],id:'parent',servingParts:[{id:'planned-part'}]};
  const incomplete={...recipes[1],id:'another',servingParts:[{id:'incomplete-part'}]};
  assert.deepEqual(filterRecipeDirectory([parent,incomplete],{missing:'nutrition-planned',plannedRecipeIds:['planned-part','incomplete-part']}).map(r=>r.id),['another']);
});
