import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarMealTitle} from '../web/recipe-directory.js';

test('snack pastries retain their selected topping in the calendar title independently of breakfast',()=>{
 const chocolate='Muffins protéinés — topping : pépites de chocolat',coconut='Muffins protéinés — topping : noix de coco râpée';
 const snack={items:[{role:'dessert',categoryId:'patisserie',recipe:{id:'chocolate',name:chocolate}}]},breakfast={items:[{role:'main',recipe:{id:'coconut',name:coconut}}]};
 assert.equal(calendarMealTitle(snack),chocolate);assert.equal(calendarMealTitle(breakfast),coconut);
 assert.equal(snack.items[0].recipe.id,'chocolate');
});
test('a meal made only of optional categories gets its real recipe names while a main stays the main title',()=>{
 const pastry={role:'dessert',recipe:{name:'Muffins — topping : myrtilles'}},drink={role:'beverage',recipe:{name:'Café'}},dish={role:'main',recipe:{name:'Poulet'}};
 assert.equal(calendarMealTitle({items:[pastry,drink,pastry]}),'Muffins — topping : myrtilles + Café');
 assert.equal(calendarMealTitle({items:[dish,pastry,drink]}),'Poulet');
 assert.equal(calendarMealTitle({items:[]}),'Repas');
 assert.equal(calendarMealTitle({items:[{role:'dessert',recipe:null}]}),'Recette supprimée');
 assert.equal(calendarMealTitle({isOccasion:true,occasionTitle:'Anniversaire'}),'✨ Anniversaire · hors quotas');
});
test('split recipe titles group their parts once without truncating the variant after an em dash',()=>{
 const name='Bowl — protéine : saumon',parts=['main','starch','vegetables'].map((part,i)=>({role:i?'accompaniment':'main',recipe:{parentRecipeId:'bowl',parentRecipeName:name,name:name+' — '+part}}));
 assert.equal(calendarMealTitle({items:parts}),name);
});
