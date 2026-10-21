import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createRecipe,readRecipe,updateRecipeSettings,validateRecipeInput,validateRecipeSettings,updateRecipe} from '../src/server/recipes.mjs';
import {ingredientCookingFactor,cookingFactorChoices,recipeServiceMode,filterRecipeDirectory,recipeDisplayPreferences} from '../web/recipe-directory.js';
import {handleRequest} from '../src/server/app.mjs';

test('service filter combines with existing filters and distinguishes all four saved modes',()=>{
  const recipes=[{name:'Cake',recipeType:'dessert'},
    {name:'Soupe',separateStarch:true,servingParts:[{servingPart:'main'}]},
    {name:'Riz poulet',separateStarch:true,servingParts:[{servingPart:'main'},{servingPart:'starch'}]},
    {name:'Assiette',separateStarch:true,servingParts:[{servingPart:'vegetables'},{servingPart:'starch'}]}];
  for(const [index,service] of ['original','whole','separate','three'].entries()){
    assert.equal(recipeServiceMode(recipes[index]),service);
    assert.deepEqual(filterRecipeDirectory(recipes,{service}),[recipes[index]]);
  }
  assert.deepEqual(filterRecipeDirectory(recipes,{service:'original',type:'dish'}),[]);
});

test('display preferences restore only bounded supported values, including corrupt saved values',()=>{
  assert.deepEqual(recipeDisplayPreferences({view:'list',columns:4,perPage:96}),{view:'list',columns:4,perPage:96});
  for(const input of [null,{},'bad',{view:'anything',columns:999,perPage:-1}])assert.deepEqual(recipeDisplayPreferences(input),{view:'grid',columns:2,perPage:12});
});

test('ingredient coefficients preserve inherited and custom values, never recook components, and include semolina',()=>{
  const recipe={separateStarch:true,cookingFactors:{main:0.8,starch:2.7,vegetables:1}};
  assert.equal(ingredientCookingFactor(recipe,{servingPart:'main'}),0.8);
  assert.equal(ingredientCookingFactor(recipe,{servingPart:'starch'}),2.7);
  assert.equal(ingredientCookingFactor(recipe,{servingPart:'starch',cookingFactor:1}),1);
  assert.equal(ingredientCookingFactor(recipe,{recipeId:'bread',servingPart:'starch',cookingFactor:3}),1);
  assert.equal(ingredientCookingFactor({separateStarch:false,cookingFactors:{main:0.8}},{servingPart:'main'}),1);
  assert.ok(cookingFactorChoices.some(([value,label])=>value==='2'&&label.includes('Semoule')));
});

test('quick configuration rejects invalid yields, assignments, modes and coefficients before writing',()=>{
  const input={householdId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',version:1,productionType:'none',mealMoments:[],
    configuration:{servingMode:'whole',yield:{amount:4,unitId:'portion'},lineParts:['main'],cookingFactors:{main:1,starch:3}}};
  assert.ok(validateRecipeSettings(input).data);
  assert.ok(validateRecipeSettings({...input,configuration:{...input.configuration,cookingFactors:undefined,lineCookingFactors:[2]}}).data);
  for(const factors of [[0],[-1],[11],[],[1,2],['2']])assert.equal(validateRecipeSettings({...input,configuration:{...input.configuration,lineCookingFactors:factors}}).error,'invalid-cooking-factor');
  for(const patch of [{yield:{amount:0,unitId:'g'}},{yield:{amount:4,unitId:'unknown'}},{servingMode:'bad'},{lineParts:['bad']},{cookingFactors:{main:-1,starch:3}}])assert.ok(validateRecipeSettings({...input,configuration:{...input.configuration,...patch}}).error);
});

test('quick service and yield PATCH reuse editor transactions, conversions and history protections',async t=>{
  const db=new PGlite();t.after(()=>db.close());
  const pool={async query(sql,args=[]){const r=await db.query(sql,args);return {...r,rowCount:r.rows.length||r.affectedRows||0};},async connect(){return {...this,release(){}};}};
  const dir=new URL('../db/migrations/',import.meta.url);
  for(const f of (await readdir(dir)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(f,dir),'utf8'));
  const h='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',food='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  await db.exec(`INSERT INTO households(id,name) VALUES('${h}','Synthetic'),('${other}','Other');
    INSERT INTO foods(id,canonical_name,source) VALUES('${food}','Test ingredient','manual');
    INSERT INTO food_nutrients(food_id,nutrient_id,value_per_100g) VALUES('${food}','energy_kcal',100);`);
  const original={householdId:h,name:'Synthetic dish',yield:{amount:4,unitId:'portion'},productionType:'none',mealMoments:['lunch'],
    lines:[{foodId:food,quantity:100,unitId:'g'},{foodId:food,quantity:200,unitId:'g'},{foodId:food,quantity:300,unitId:'g'}]};
  let recipe=await createRecipe(pool,validateRecipeInput(original).data);
  const config={servingMode:'three',yield:{amount:6,unitId:'piece'},lineParts:['main','starch','vegetables'],cookingFactors:{main:1,starch:2}};
  const request={householdId:h,version:recipe.version,productionType:'batch_cooking',mealMoments:['dinner'],configuration:config};
  async function patch(body){
    const response={setHeader(){},writeHead(code){this.code=code;},end(body){this.body=JSON.parse(body);}};
    await handleRequest({method:'PATCH',url:`/api/recipes/${recipe.id}`,headers:{},async *[Symbol.asyncIterator](){yield JSON.stringify(body);}},response,pool);
    return response;
  }
  assert.equal((await patch({...request,householdId:other})).code,404);
  const saved=await patch(request);assert.equal(saved.code,200,JSON.stringify(saved.body));recipe=saved.body.recipe;
  assert.deepEqual(recipe.yield,{amount:6,unitId:'piece'});
  assert.equal(recipe.nutrition.batch.energyKcal,600);assert.equal(recipe.nutrition.perYieldUnit.energyKcal,100);
  assert.equal(recipeServiceMode(recipe),'three');assert.deepEqual(recipe.servingWeights,{main:100,starch:400,vegetables:300});
  assert.deepEqual(recipe.lines.map(l=>l.quantity),[100,200,300]);
  assert.ok(recipe.servingParts.every(p=>p.productionType==='batch_cooking'&&p.mealMoments[0]==='dinner'));
  assert.equal((await patch(request)).body.error,'recipe-version-conflict');
  const invalid=await patch({...request,version:recipe.version,configuration:{...config,lineParts:['main','main','main']}});
  assert.equal(invalid.body.error,'starch-ingredients-required');
  assert.equal((await readRecipe(pool,recipe.id)).version,recipe.version);
  const removed=await patch({...request,version:recipe.version,configuration:{...config,servingMode:'original'}});
  assert.equal(removed.body.error,'serving-parts-cannot-be-disabled');
  assert.equal(recipeServiceMode(await readRecipe(pool,recipe.id)),'three');
  // Changing the native yield recomputes dependent recipes, without copying nutrients.
  const component=await createRecipe(pool,validateRecipeInput({...original,name:'Synthetic bread',yield:{amount:10,unitId:'slice'},outputUnits:{slice:10},lines:[{foodId:food,quantity:500,unitId:'g'}]}).data);
  const parent=await createRecipe(pool,validateRecipeInput({...original,name:'Synthetic sandwich',lines:[{recipeId:component.id,quantity:2,unitId:'slice'}]}).data);
  const changed=await updateRecipeSettings(pool,component.id,{householdId:h,version:component.version,productionType:'none',mealMoments:[],configuration:{...config,servingMode:'original',yield:{amount:20,unitId:'slice'},lineParts:['main']}});
  assert.equal(changed.outputUnits.slice,20);assert.equal(changed.nutrition.perYieldUnit.energyKcal,25);
  const refreshedParent=await readRecipe(pool,parent.id);assert.equal(refreshedParent.nutrition.batch.energyKcal,50);assert.ok(refreshedParent.version>parent.version);
  // Stock histories keep the existing native-unit protection of the complete editor.
  await db.exec(`INSERT INTO stock_lots(id,household_id,recipe_id,produced_on,quantity,storage) VALUES('ffffffff-ffff-4fff-8fff-ffffffffffff','${h}','${component.id}','2026-10-21',3,'freezer');`);
  const blocked=await updateRecipeSettings(pool,component.id,{householdId:h,version:changed.version,productionType:'none',mealMoments:[],configuration:{...config,servingMode:'original',yield:{amount:1,unitId:'piece'},lineParts:['main']}});
  assert.equal(blocked.error,'recipe-output-in-use');assert.equal((await readRecipe(pool,component.id)).yield.unitId,'slice');
  // Legacy defaults are materialized per line with identical weights and nutrition.
  const oldWeights={...recipe.servingWeights},oldNutrition=recipe.nutrition.batch;
  const explicitFactors=recipe.lines.map(line=>ingredientCookingFactor(recipe,line));
  recipe=await updateRecipeSettings(pool,recipe.id,{...request,version:recipe.version,configuration:{...config,cookingFactors:undefined,lineCookingFactors:explicitFactors}});
  assert.deepEqual(recipe.servingWeights,oldWeights);assert.deepEqual(recipe.nutrition.batch,oldNutrition);
  assert.deepEqual(recipe.lines.map(line=>line.cookingFactor),[1,2,1]);
  // Two starches in the same recipe retain independent coefficients.
  const mixed=await createRecipe(pool,validateRecipeInput({...original,name:'Mixed rice and beans',lines:[...original.lines,{foodId:food,quantity:50,unitId:'g'}]}).data);
  const mixedRequest={householdId:h,version:mixed.version,productionType:'none',mealMoments:[],configuration:{servingMode:'three',yield:mixed.yield,lineParts:['main','starch','starch','vegetables'],lineCookingFactors:[0.8,3,1,1]}};
  const splitMixed=await updateRecipeSettings(pool,mixed.id,mixedRequest);
  assert.deepEqual(splitMixed.servingWeights,{main:80,starch:900,vegetables:50});
  assert.equal(splitMixed.nutrition.batch.energyKcal,650);
  const semolina=await updateRecipeSettings(pool,mixed.id,{...mixedRequest,version:splitMixed.version,configuration:{...mixedRequest.configuration,lineCookingFactors:[0.8,2,1,1]}});
  assert.equal(semolina.servingWeights.starch,700);assert.equal(semolina.nutrition.batch.energyKcal,650);
  // A concurrent change is checked again under the transaction lock.
  const checked=validateRecipeInput({...original,yield:{amount:8,unitId:'portion'}}).data;
  assert.deepEqual(await updateRecipe(pool,recipe.id,checked,1),{error:'recipe-version-conflict'});
  await db.exec(`INSERT INTO planned_meals(id,household_id,meal_date,slot,prepared_at) VALUES('dddddddd-dddd-4ddd-8ddd-dddddddddddd','${h}','2026-10-21','dinner',now());
    INSERT INTO planned_meal_items(id,meal_id,recipe_id) VALUES('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','dddddddd-dddd-4ddd-8ddd-dddddddddddd','${recipe.servingParts[0].id}');`);
  assert.equal((await patch({...request,version:recipe.version,configuration:{...config,yield:{amount:8,unitId:'piece'}}})).body.error,'recipe-used-in-prepared-meal');
  assert.deepEqual((await readRecipe(pool,recipe.id)).yield,recipe.yield);
  // Tag-only edits still remain possible on prepared recipes, as before.
  assert.ok((await updateRecipeSettings(pool,recipe.id,{householdId:h,version:recipe.version,productionType:recipe.productionType,mealMoments:['snack']})).id);
});
