import test from 'node:test';
import assert from 'node:assert/strict';
import { filterRecipeDirectory, recipeCardForSource, recipeMissingData, recipePlanningLabel } from '../web/recipe-directory.js';

const recipes=[
  {name:'Soupe',recipeType:'dish',mealMoments:['dinner'],instructions:'Mixer.',imageAvailable:true,nutrition:{complete:true}},
  {name:'Skyr vanille',recipeType:'dessert',mealMoments:['breakfast'],instructions:'',imageAvailable:false,nutrition:{complete:false}},
];

test('planning choices show calories per serving rather than for the whole batch',()=>{
  const recipe={name:'Muffins',yield:{amount:12,unitId:'piece'},nutrition:{complete:true,batch:{energyKcal:2160},perYieldUnit:{energyKcal:180}}};
  assert.equal(recipePlanningLabel(recipe),'Muffins · 180 kcal/pièce · 12 pièces');
  assert.equal(recipePlanningLabel({...recipe,name:'Plat complet',yield:{amount:4,unitId:'portion'},servingParts:[{id:'rice'}]}),'Plat complet · 180 kcal/portion · portions en grammes estimés');
});

test('linked recipe parts are labeled as components of their parent, including retired history',()=>{
  const part={name:'Poulet tikka — Légumes',parentRecipeId:'parent',parentRecipeName:'Poulet tikka',servingPart:'vegetables',yield:{amount:1200,unitId:'g'},nutrition:{complete:true,perYieldUnit:{energyKcal:0.3}}};
  assert.match(recipePlanningLabel(part),/^Poulet tikka · Légumes · 30 kcal\/100 g · 1200 g$/);
  assert.match(recipePlanningLabel({...part,servingPartActive:false}),/ancienne composition/);
});

test('planning choices express weight and volume recipes per 100 units',()=>{
  const recipe={name:'Skyr',yield:{amount:1000,unitId:'g'},nutrition:{complete:true,perYieldUnit:{energyKcal:0.63}}};
  assert.equal(recipePlanningLabel(recipe),'Skyr · 63 kcal/100 g · 1000 g');
  assert.match(recipePlanningLabel({...recipe,yield:{amount:250,unitId:'ml'}}),/63 kcal\/100 ml/);
});

test('planning choices distinguish missing calories, partial calculations and genuine zero',()=>{
  const recipe={name:'Café',yield:{amount:1,unitId:'portion'},nutrition:{complete:true,perYieldUnit:{energyKcal:0}}};
  assert.match(recipePlanningLabel(recipe),/0 kcal\/portion/);
  assert.match(recipePlanningLabel({...recipe,nutrition:{perYieldUnit:{energyKcal:null}}}),/kcal à compléter/);
  assert.match(recipePlanningLabel({...recipe,nutrition:{complete:false,perYieldUnit:{energyKcal:120}}}),/120 kcal\/portion \(calcul incomplet\)/);
});

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
