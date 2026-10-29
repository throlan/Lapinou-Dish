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
  {id:'everything-seasoning',name:'Assaisonnement Everything Bagel',recipeType:'custom-assaisonnement',mealMoments:['lunch','dinner']},
];
const categories=[
  {id:'accompaniment',label:'Accompagnement',recipeType:'accompaniment',slots:['lunch','dinner']},
  {id:'beverage',label:'Boisson',recipeType:'beverage',slots:['breakfast','lunch','snack','dinner','evening_snack']},
  {id:'dessert',label:'Dessert',recipeType:'dessert',slots:['lunch','dinner']},
  {id:'patisserie',label:'Pâtisserie',recipeType:'custom-patisserie',role:'dessert',slots:['breakfast','snack']},
  {id:'sauce',label:'Sauce',recipeType:'sauce',slots:['lunch','dinner']},
  {id:'assaisonnement',label:'Assaisonnement',recipeType:'custom-assaisonnement',role:'sauce',slots:['breakfast','lunch','snack','dinner','evening_snack']},
];
const context={state:{mealAdditions:categories},mealAdditionById:id=>categories.find(item=>item.id===id)??null,mealAdditionLabel:id=>categories.find(item=>item.id===id)?.label??id,roleForRecipeType:type=>type==='salad'?'accompaniment':type,allPlanningRecipes:()=>recipes,isIndividualRole:role=>role!=='main'};
runInNewContext(source.slice(start,end)+'\nglobalThis.selectRecipes=recipesForPlanning;globalThis.options=plannedItemRoleOptions;',context);
const quantityStart=source.indexOf('function isIndividualRole(');
const quantityEnd=source.indexOf('\nfunction currentFormAmounts(',quantityStart);
assert.ok(quantityStart>=0&&quantityEnd>quantityStart,'individual serving defaults are present');
context.sauceDefaultQuantity=recipe=>['g','ml'].includes(recipe?.yield?.unitId)?30:1;
runInNewContext(source.slice(quantityStart,quantityEnd)+'\nglobalThis.defaultQuantity=individualDefaultQuantity;globalThis.sauceDefault=sauceDefaultQuantity;',context);

test('the configured pastry category makes breakfast desserts selectable as individual choices',()=>{
  assert.deepEqual(Array.from(context.selectRecipes('breakfast','dessert',[],'dessert'),recipe=>recipe.id),['breakfast-dessert']);
  assert.deepEqual(Array.from(context.selectRecipes('breakfast','dessert',[],'custom-patisserie'),recipe=>recipe.id),['custom-pastry']);
  assert.deepEqual(Array.from(context.selectRecipes('lunch','dessert',[],'dessert'),recipe=>recipe.id),['lunch-dessert']);
  assert.deepEqual(Array.from(context.options('patisserie','breakfast'),([id])=>id),['main','beverage','patisserie','assaisonnement']);
});

test('all configured additions are optional per-person categories while the main remains shared',()=>{
  assert.equal(context.isIndividualRole('main'),false);
  for(const role of ['accompaniment','beverage','dessert','sauce'])assert.equal(context.isIndividualRole(role),true);
  assert.deepEqual(Array.from(context.options('main','dinner'),([id])=>id),['main','accompaniment','beverage','dessert','sauce','assaisonnement']);
});

test('calendar refresh loads the household addition categories before opening meal editors',()=>{
  const calendarStart=source.indexOf('async function refreshCalendar()');
  const calendarEnd=source.indexOf('\nfunction renderCalendarDay(',calendarStart);
  assert.ok(calendarStart>=0&&calendarEnd>calendarStart,'calendar refresh function is present');
  const calendarSource=source.slice(calendarStart,calendarEnd);
  assert.ok(calendarSource.includes('api(`/api/meal-additions?householdId=${encodeURIComponent(state.household.id)}`)'));
  assert.ok(calendarSource.includes('state.mealAdditions=mealAdditionsResult.additions??[]'));
});

test('recipe moment tags filter each configurable category and salad can be its own category',()=>{
  assert.deepEqual(Array.from(context.selectRecipes('dinner','accompaniment',[],'salad'),recipe=>recipe.id),['salad']);
  assert.deepEqual(Array.from(context.selectRecipes('breakfast','sauce',[],'sauce'),recipe=>recipe.id),[]);
  assert.deepEqual(Array.from(context.selectRecipes('breakfast','main'),recipe=>recipe.id),['breakfast-dessert','breakfast-dish','custom-pastry']);
  assert.deepEqual(Array.from(context.selectRecipes('lunch','main'),recipe=>recipe.id),['salad']);
});

test('custom recipe types appear in the configured role even when the type differs from that role',()=>{
  assert.deepEqual(Array.from(context.selectRecipes('dinner','sauce',[],'custom-assaisonnement'),recipe=>recipe.id),['everything-seasoning']);
});

test('custom category roles do not impose built-in sauce or dessert batch quantities',()=>{
  assert.equal(context.defaultQuantity({recipeType:'custom-assaisonnement',yield:{amount:160,unitId:'g'}},'sauce'),1);
  assert.equal(context.defaultQuantity({recipeType:'sauce',yield:{amount:160,unitId:'g'}},'sauce'),30);
  assert.equal(context.defaultQuantity({recipeType:'custom-patisserie',yield:{amount:12,unitId:'piece'}},'dessert'),1);
});
