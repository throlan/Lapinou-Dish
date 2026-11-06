import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogueCurrent,catalogueSelectionIssue,filterCatalogueReview,catalogueReviewCsv} from '../web/catalogue-review.js';
import {validateCatalogueReviewExclusions} from '../src/server/catalogue-review-exclusions.mjs';

const foods=[
  {id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',name:'Riz cru',code:'123',foodCategory:'Féculents',cookingFactor:2.5,estimates:{cookingFactor:{value:2.5,source:'source'}}},
  {id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',name:'Herbes',foodCategory:'Épices',cookingFactor:null,estimates:{cookingFactor:{value:0.8,source:'source'}}},
  {id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',name:'Poulet cru',foodCategory:'Viandes',cookingFactor:1,estimates:{cookingFactor:{value:0.75,source:'source'}}},
  {id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',name:'Fromage',foodCategory:'Fromages',cookingFactor:1,estimates:{}},
];
const exclusions={categories:['Épices'],foodIds:['cccccccc-cccc-4ccc-8ccc-cccccccccccc']};

test('catalogue filters exclude cooking-only categories and foods, hide identical values, and expose current-only rows',()=>{
  assert.deepEqual(filterCatalogueReview(foods,{field:'cookingFactor',exclusions}).map(food=>food.name),[]);
  assert.deepEqual(filterCatalogueReview(foods,{field:'cookingFactor',exclusions,hideSame:false,filter:'current-no-proposal'}).map(food=>food.name),['Fromage']);
  assert.deepEqual(filterCatalogueReview(foods,{field:'cookingFactor',category:'Fromages',exclusions,hideSame:false,filter:'current-no-proposal'}).map(food=>food.name),['Fromage']);
  assert.deepEqual(filterCatalogueReview(foods,{field:'cookingFactor',category:'Féculents',exclusions,hideSame:false,filter:'current-no-proposal'}),[]);
  assert.deepEqual(filterCatalogueReview(foods,{field:'cookingFactor',exclusions,filter:'excluded'}).map(food=>food.name),['Herbes','Poulet cru']);
  assert.deepEqual(filterCatalogueReview(foods,{field:'cookingFactor',exclusions,hideSame:false}).map(food=>food.name),['Riz cru','Fromage']);
  assert.equal(catalogueCurrent(foods[3],'cookingFactor'),1);
  assert.equal(filterCatalogueReview(foods,{field:'gramsPerMillilitre',exclusions}).length,4);
});

test('catalogue CSV exports current values even without estimates and quotes spreadsheet formulas',()=>{
  const csv=catalogueReviewCsv([{...foods[3],name:'=DANGER'}],{field:'cookingFactor',exclusions});
  assert.match(csv,/"1";"";""/);
  assert.match(csv,/"'=DANGER"/);
});

test('catalogue exclusion payload accepts scoped categories and food ids, rejects malformed entries',()=>{
  assert.deepEqual(validateCatalogueReviewExclusions(exclusions).data,exclusions);
  assert.equal(validateCatalogueReviewExclusions({categories:['Épices','Épices'],foodIds:[]}).error,'invalid-catalogue-exclusions');
  assert.equal(validateCatalogueReviewExclusions({categories:[],foodIds:['bad']}).error,'invalid-catalogue-exclusions');
});

test('a prefilled current value is not a proposal and a real change can be selected without provenance',()=>{
  assert.equal(catalogueSelectionIssue(foods[3],'cookingFactor','1',''),'unchanged');
  assert.equal(catalogueSelectionIssue({...foods[3],cookingFactor:null},'cookingFactor','1',''),null);
  assert.equal(catalogueSelectionIssue({...foods[3],cookingFactor:null},'cookingFactor','1','Pesée du foyer'),null);
  assert.equal(catalogueSelectionIssue(foods[3],'cookingFactor','','Pesée du foyer'),'invalid-value');
});
