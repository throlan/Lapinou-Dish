import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source=await readFile(new URL('../web/app.js',import.meta.url),'utf8');
const start=source.indexOf('async function openRecipeEditor(');
const end=source.indexOf('async function refreshRecipes(',start);
assert.ok(start>=0 && end>start);

function editor() {
  const boxes=['breakfast','lunch','dinner','snack'].map(value=>({value,checked:false}));
  const fields=['name','description','recipeType','productionType','sourceUrl','instructions','yieldAmount','yieldUnit','servingMode','mainCookingFactor','starchCookingFactor'];
  const form={elements:Object.fromEntries(fields.map(name=>[name,{value:''}])),
    reset(){this.elements.recipeType.value='dish';this.elements.productionType.value='none';boxes.forEach(box=>box.checked=false);},
    querySelectorAll(){return boxes;},classList:{remove(){}},scrollIntoView(){}};
  const remove={hidden:true,classList:{add(){remove.hidden=true;},remove(){remove.hidden=false;}}};
  const elements={'#recipe-form':form,'#recipe-lines':{replaceChildren(){}},'#recipe-message':{},'#recipe-result':{classList:{add(){}}},'#recipe-form-title':{},'#delete-current-recipe':remove};
  let recipe;
  const copiedLines=[];
  const context={ $:selector=>elements[selector],state:{},api:async()=>({recipe}),addRecipeLine(line){copiedLines.push(line);},updateServingConfiguration(){},showMessage(target,text){target.textContent=text;} };
  runInNewContext(source.slice(start,end)+'\nglobalThis.openEditor=openRecipeEditor;',context);
  return {form,boxes,copiedLines,context,remove,async open(value){recipe={name:'Synthetic recipe',yield:{amount:24,unitId:'piece'},nutrition:{lineIssues:[]},lines:[],...value};await context.openEditor('test-id');},async duplicate(value){recipe={name:'Synthetic recipe',yield:{amount:24,unitId:'piece'},nutrition:{lineIssues:[]},lines:[],...value};await context.openEditor('test-id',true);},async create(){await context.openEditor();}};
}

test('recipe editor exposes deletion only for an existing loaded recipe, never for a new copy',async()=>{
  const ui=editor();await ui.open({id:'test-id',version:9});
  assert.equal(ui.remove.hidden,false);assert.equal(ui.remove.disabled,false);
  assert.equal(ui.context.state.editingRecipeForDeletion.version,9);
  await ui.duplicate({id:'test-id',version:9});assert.equal(ui.remove.hidden,true);assert.equal(ui.context.state.editingRecipeForDeletion,null);
  await ui.create();assert.equal(ui.remove.hidden,true);assert.equal(ui.context.state.editingRecipeForDeletion,null);
});

test('recipe editor restores saved preparation type, meal tags and production mode on each opening',async()=>{
  const ui=editor();
  await ui.open({recipeType:'accompaniment',mealMoments:['lunch','dinner'],productionType:'batch_cooking'});
  assert.equal(ui.form.elements.recipeType.value,'accompaniment');
  assert.deepEqual(ui.boxes.filter(box=>box.checked).map(box=>box.value),['lunch','dinner']);
  assert.equal(ui.form.elements.productionType.value,'batch_cooking');
  await ui.open({recipeType:'beverage',mealMoments:['breakfast']});
  assert.equal(ui.form.elements.recipeType.value,'beverage');
  assert.deepEqual(ui.boxes.filter(box=>box.checked).map(box=>box.value),['breakfast']);
});

test('legacy and new recipes reset tags without retaining the preceding recipe choices',async()=>{
  const ui=editor();
  await ui.open({recipeType:'dessert',mealMoments:['snack'],productionType:'pastry'});
  await ui.open({});
  assert.equal(ui.form.elements.recipeType.value,'dish');
  assert.equal(ui.form.elements.productionType.value,'none');
  assert.deepEqual(ui.boxes.filter(box=>box.checked),[]);
  await ui.open({recipeType:'beverage',mealMoments:['breakfast']});
  await ui.create();
  assert.equal(ui.form.elements.recipeType.value,'dish');
  assert.deepEqual(ui.boxes.filter(box=>box.checked),[]);
});

test('duplicating a recipe prefills an independent new recipe with its variations and ingredients',async()=>{
  const ui=editor();
  await ui.duplicate({name:'Crème protéinée',description:'Base skyr et œufs',recipeType:'dessert',mealMoments:['breakfast','snack'],productionType:'batch_cooking',sourceUrl:'https://example.test/recipe',instructions:'Cuire puis mixer.',yield:{amount:3,unitId:'piece'},separateStarch:false,lines:[{foodId:'food-1',foodName:'Skyr',quantity:150,unitId:'g'}]});
  assert.equal(ui.form.elements.name.value,'Crème protéinée (variante)');
  assert.equal(ui.form.elements.description.value,'Base skyr et œufs');
  assert.equal(ui.form.elements.recipeType.value,'dessert');
  assert.equal(ui.form.elements.productionType.value,'batch_cooking');
  assert.deepEqual(ui.boxes.filter(box=>box.checked).map(box=>box.value),['breakfast','snack']);
  assert.equal(ui.form.elements.sourceUrl.value,'https://example.test/recipe');
  assert.equal(ui.form.elements.instructions.value,'Cuire puis mixer.');
  assert.equal(ui.form.elements.yieldAmount.value,3);
  assert.equal(ui.form.elements.yieldUnit.value,'piece');
  assert.equal(ui.context.state.editingRecipeId,null);
  assert.equal(ui.copiedLines.length,1);
  assert.equal(ui.copiedLines[0].foodId,'food-1');
  assert.equal(ui.copiedLines[0].quantity,150);
});

test('duplicating a split dish keeps its serving mode, cooking factors and ingredient groups',async()=>{
  const ui=editor();
  await ui.duplicate({name:'Plat complet',recipeType:'dish',separateStarch:true,servingParts:[{servingPart:'main'},{servingPart:'starch'}],cookingFactors:{main:1,starch:2.5},lines:[{foodId:'food-1',quantity:150,unitId:'g',servingPart:'main'},{foodId:'food-2',quantity:80,unitId:'g',servingPart:'starch',cookingFactor:2.5}]});
  assert.equal(ui.form.elements.servingMode.value,'separate');
  assert.equal(ui.form.elements.mainCookingFactor.value,1);
  assert.equal(ui.form.elements.starchCookingFactor.value,2.5);
  assert.deepEqual(ui.copiedLines.map(line=>line.servingPart),['main','starch']);
  assert.equal(ui.copiedLines[1].cookingFactor,2.5);
});
