import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source=await readFile(new URL('../web/app.js',import.meta.url),'utf8');
const start=source.indexOf('function plannedItemRoleOptions(');
const end=source.indexOf('\nfunction renderPlannedItems(',start);
assert.ok(start>=0&&end>start,'meal addition selector helpers are present');
const recipes=[
  {id:'breakfast-dessert',name:'Dessert du matin',recipeType:'dessert',mealMoments:['breakfast','snack']},
  {id:'lunch-dessert',name:'Dessert du déjeuner',recipeType:'dessert',mealMoments:['lunch']},
  {id:'breakfast-dish',name:'Plat du matin',recipeType:'dish',mealMoments:['breakfast']},
  {id:'breakfast-drink',name:'Boisson du matin',recipeType:'beverage',mealMoments:['breakfast']},
  {id:'salad',name:'Salade',recipeType:'salad',mealMoments:['lunch','dinner']},
  {id:'sauce',name:'Sauce',recipeType:'sauce',mealMoments:['lunch','dinner']},
  {id:'custom-pastry',name:'Pâtisserie maison',recipeType:'custom-patisserie',mealMoments:['breakfast']},
];
const categories=[
  {id:'accompaniment',label:'Accompagnement',recipeType:'accompaniment',slots:['lunch','dinner']},
  {id:'beverage',label:'Boisson',recipeType:'beverage',slots:['breakfast','lunch','snack','dinner','evening_snack']},
  {id:'dessert',label:'Dessert',recipeType:'dessert',slots:['lunch','dinner']},
  {id:'patisserie',label:'Pâtisserie',recipeType:'custom-patisserie',role:'dessert',slots:['breakfast','snack']},
  {id:'sauce',label:'Sauce',recipeType:'sauce',slots:['lunch','dinner']},
];
const context={state:{mealAdditions:categories},mealAdditionById:id=>categories.find(item=>item.id===id)??null,mealAdditionLabel:id=>categories.find(item=>item.id===id)?.label??id,roleForRecipeType:type=>type==='salad'?'accompaniment':type,allPlanningRecipes:()=>recipes,isIndividualRole:role=>role!=='main'};
runInNewContext(source.slice(start,end)+'\nglobalThis.selectRecipes=recipesForPlanning;globalThis.options=plannedItemRoleOptions;',context);

test('the configured pastry category makes breakfast desserts selectable as individual choices',()=>{
  assert.deepEqual(Array.from(context.selectRecipes('breakfast','dessert',[],'dessert'),recipe=>recipe.id),['breakfast-dessert']);
  assert.deepEqual(Array.from(context.selectRecipes('breakfast','dessert',[],'custom-patisserie'),recipe=>recipe.id),['custom-pastry']);
  assert.deepEqual(Array.from(context.selectRecipes('lunch','dessert',[],'dessert'),recipe=>recipe.id),['lunch-dessert']);
  assert.deepEqual(Array.from(context.options('patisserie','breakfast'),([id])=>id),['main','beverage','patisserie']);
});

test('all configured additions are optional per-person categories while the main remains shared',()=>{
  assert.equal(context.isIndividualRole('main'),false);
  for(const role of ['accompaniment','beverage','dessert','sauce'])assert.equal(context.isIndividualRole(role),true);
  assert.deepEqual(Array.from(context.options('main','dinner'),([id])=>id),['main','accompaniment','beverage','dessert','sauce']);
});

test('recipe moment tags filter each configurable category and salad can be its own category',()=>{
  assert.deepEqual(Array.from(context.selectRecipes('dinner','accompaniment',[],'salad'),recipe=>recipe.id),['salad']);
  assert.deepEqual(Array.from(context.selectRecipes('breakfast','sauce',[],'sauce'),recipe=>recipe.id),[]);
  assert.deepEqual(Array.from(context.selectRecipes('breakfast','main'),recipe=>recipe.id),['breakfast-dessert','breakfast-dish','custom-pastry']);
  assert.deepEqual(Array.from(context.selectRecipes('lunch','main'),recipe=>recipe.id),['salad']);
});
