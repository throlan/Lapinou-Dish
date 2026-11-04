import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {listCookingFactorConflicts,updateFood,validateFoodInput} from '../src/server/foods.mjs';
import {createRecipe,readRecipe,validateRecipeInput} from '../src/server/recipes.mjs';
import {savePlannedMeal,listPlannedMeals} from '../src/server/planning.mjs';

test('a food cooking factor resolves conflicting recipes without changing saved cooked menu grams',async()=>{
  const db=new PGlite();
  try{
    const dir=new URL('../db/migrations/',import.meta.url);
    for(const file of (await readdir(dir)).filter(file=>file.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,dir),'utf8'));
    const pool={async query(sql,args=[]){const result=await db.query(sql,args);return {...result,rowCount:result.rows.length||result.affectedRows||0};},async connect(){return {...this,release(){}};}};
    const household='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',person='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const rice='cccccccc-cccc-4ccc-8ccc-cccccccccccc',chicken='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    await pool.query('INSERT INTO households(id,name) VALUES($1,$2)',[household,'Test']);
    await pool.query('INSERT INTO people(id,household_id,display_name) VALUES($1,$2,$3)',[person,household,'Personne']);
    for(const [id,name] of [[rice,'Riz basmati cru'],[chicken,'Poulet cru']]){
      await pool.query("INSERT INTO foods(id,canonical_name,source) VALUES($1,$2,'manual')",[id,name]);
      for(const [nutrient,value] of [['energy_kcal',100],['protein_g',10],['carbohydrate_g',12],['fat_g',2],['fibre_g',1]])await pool.query('INSERT INTO food_nutrients(food_id,nutrient_id,value_per_100g) VALUES($1,$2,$3)',[id,nutrient,value]);
    }
    const make=async(name,factor)=>createRecipe(pool,validateRecipeInput({householdId:household,name,recipeType:'dish',yield:{amount:4,unitId:'portion'},servingMode:'separate',separateStarch:true,cookingFactors:{main:1,starch:1},lines:[{foodId:chicken,quantity:400,unitId:'g',servingPart:'main',cookingFactor:1},{foodId:rice,quantity:200,unitId:'g',servingPart:'starch',cookingFactor:factor}]}).data);
    const first=await make('Poulet riz A',3),second=await make('Poulet riz B',2.5);
    const conflicts=await listCookingFactorConflicts(pool,household);
    assert.equal(conflicts.length,1);assert.equal(conflicts[0].foodId,rice);assert.deepEqual(conflicts[0].factors,[2.5,3]);
    const main=first.servingParts.find(part=>part.servingPart==='main'),starch=first.servingParts.find(part=>part.servingPart==='starch');
    await savePlannedMeal(pool,null,{householdId:household,mealDate:'2026-11-05',slot:'lunch',notes:'',attendeeIds:[person],items:[{recipeId:main.id,role:'main',amounts:[{personId:person,quantity:100}]},{recipeId:starch.id,role:'accompaniment',amounts:[{personId:person,quantity:120}]}]});
    const updated=await updateFood(pool,rice,validateFoodInput({cookingFactor:0.586667}).data);
    assert.equal(updated.cookingFactor,0.586667);
    assert.equal((await listCookingFactorConflicts(pool,household)).length,0);
    for(const recipe of [first,second])assert.equal((await readRecipe(pool,recipe.id)).servingParts.find(part=>part.servingPart==='starch').yield.amount,117.3334);
    const meal=(await listPlannedMeals(pool,household,'2026-11-02'))[0];
    assert.deepEqual(meal.items.map(item=>item.amounts[0].quantity),[100,120]);
  }finally{await db.close();}
});
