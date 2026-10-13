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
  const fields=['name','description','recipeType','productionType','sourceUrl','instructions','yieldAmount','yieldUnit'];
  const form={elements:Object.fromEntries(fields.map(name=>[name,{value:''}])),
    reset(){this.elements.recipeType.value='dish';this.elements.productionType.value='none';boxes.forEach(box=>box.checked=false);},
    querySelectorAll(){return boxes;},classList:{remove(){}},scrollIntoView(){}};
  const elements={'#recipe-form':form,'#recipe-lines':{replaceChildren(){}},'#recipe-message':{},'#recipe-result':{classList:{add(){}}},'#recipe-form-title':{}};
  let recipe;
  const context={ $:selector=>elements[selector],state:{},api:async()=>({recipe}),addRecipeLine(){},showMessage(target,text){target.textContent=text;} };
  runInNewContext(source.slice(start,end)+'\nglobalThis.openEditor=openRecipeEditor;',context);
  return {form,boxes,async open(value){recipe={name:'Synthetic recipe',yield:{amount:24,unitId:'piece'},nutrition:{lineIssues:[]},lines:[],...value};await context.openEditor('test-id');},async create(){await context.openEditor();}};
}

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
  await ui.open({recipeType:'snack',mealMoments:['snack'],productionType:'pastry'});
  await ui.open({});
  assert.equal(ui.form.elements.recipeType.value,'dish');
  assert.equal(ui.form.elements.productionType.value,'none');
  assert.deepEqual(ui.boxes.filter(box=>box.checked),[]);
  await ui.open({recipeType:'beverage',mealMoments:['breakfast']});
  await ui.create();
  assert.equal(ui.form.elements.recipeType.value,'dish');
  assert.deepEqual(ui.boxes.filter(box=>box.checked),[]);
});
