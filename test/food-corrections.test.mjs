import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {foodCorrectionField,foodMeasurePayload,foodMeasureComparisons,foodPurchaseMode,deriveFoodMeasures,foodMeasureVolumes} from '../web/food-corrections.js';
import {createRecipe,validateRecipeInput} from '../src/server/recipes.mjs';
import {loadRecipeGraph,recipeWeight} from '../src/server/recipe-ingredients.mjs';
import {addStockLot} from '../src/server/household-planning.mjs';
import {saveIngredientStock,productionDeductions,ingredientProjection} from '../src/server/ingredient-stock.mjs';
import {rawShoppingRequirements} from '../src/server/shopping-requirements.mjs';
import {savePlannedMeal} from '../src/server/planning.mjs';
import {toGrams} from '../src/domain/foods.ts';

test('correction targets the exact food measure or missing nutrient without requiring unused fields',()=>{
  for(const [unit,field] of [['piece','pieceGrams'],['tsp','tspGrams'],['tbsp','tbspGrams'],['scoop','scoopGrams'],['ml','gramsPerMillilitre'],['cup','cupGrams']])
    assert.equal(foodCorrectionField({unitId:unit},{reason:'unit-conversion-missing'}),field);
  assert.equal(foodCorrectionField({}, {reason:'nutrient-data-missing',missingNutrients:['proteinG']}),'proteinG');
  assert.deepEqual(foodMeasurePayload({pinch:0.3,legacy:120,tsp:5},{tspGrams:null,tbspGrams:10,scoopGrams:null,pieceGrams:60}),{pinch:0.3,legacy:120,tbsp:10,piece:60});
});

test('each known container or density derives all the others using 5/15/60/240 ml; a piece never defines density',()=>{
  for(const source of Object.keys(foodMeasureVolumes)){
    const derived=deriveFoodMeasures({[source]:foodMeasureVolumes[source]*0.5});
    assert.equal(derived.gramsPerMillilitre.value,0.5);
    for(const [field,ml] of Object.entries(foodMeasureVolumes)){
      assert.equal(derived[field].value,ml*0.5);assert.equal(derived[field].derived,field!==source);
    }
  }
  assert.equal(deriveFoodMeasures({gramsPerMillilitre:0.8}).cupGrams.value,192);
  assert.equal(deriveFoodMeasures({pieceGrams:60}).scoopGrams.value,null);
  const explicit={cupGrams:130,scoopGrams:35,tspGrams:2.5};
  const derived=deriveFoodMeasures(explicit);assert.equal(derived.cupGrams.value,130);assert.equal(derived.scoopGrams.value,35);
  // UI and server use the same stable reference when explicit measurements disagree.
  const food={gramsPerMillilitre:null,gramsPerUnit:{cup:130,scoop:35,tsp:2.5}};
  assert.equal(toGrams(1,'ml',food),derived.gramsPerMillilitre.value);
  assert.equal(toGrams(1,'tbsp',food),derived.tbspGrams.value);
  assert.equal(toGrams(1,'cup',food),130);
});

test('live measurements recalculate without saving derived values as manual ones or overwriting user edits',async()=>{
  const source=await readFile(new URL('../web/app.js',import.meta.url),'utf8');
  const a=source.indexOf('const foodMeasureNames='),b=source.indexOf("$('#food-form').elements.purchaseMode",a);
  const fields=Object.fromEntries(['gramsPerMillilitre',...Object.keys(foodMeasureVolumes)].map(name=>{
    const parent={hint:null,querySelector(){return this.hint;},append(hint){this.hint=hint;}};
    return [name,{value:name==='tbspGrams'?'7.5':'',dataset:{},parentElement:parent,handlers:{},addEventListener(name,fn){this.handlers[name]=fn;}}];
  }));
  const form={elements:fields,dataset:{}};for(const field of Object.values(fields))field.form=form;
  const message={};const context={$:id=>id==='#food-form'?form:message,document:{createElement:()=>({dataset:{}})},foodMeasureVolumes,foodMeasureLabels:{},deriveFoodMeasures,foodMeasureComparisons,format:String};
  runInNewContext(source.slice(a,b)+'\nglobalThis.render=updateFoodMeasureComparisons;globalThis.explicit=foodMeasuredValues;',context);
  context.render();assert.equal(fields.scoopGrams.value,'30');assert.equal(fields.cupGrams.value,'120');
  fields.scoopGrams.value='36';fields.scoopGrams.handlers.input({currentTarget:fields.scoopGrams});
  assert.equal(fields.scoopGrams.value,'36');assert.equal(fields.scoopGrams.dataset.derived,'false');
  fields.tbspGrams.value='9';fields.tbspGrams.handlers.input({currentTarget:fields.tbspGrams});
  assert.equal(fields.tspGrams.value,'3');assert.equal(fields.cupGrams.value,'144');assert.equal(fields.scoopGrams.value,'36');
  const saved=context.explicit(form);assert.equal(saved.gramsPerMillilitre,null);assert.equal(saved.tspGrams,null);assert.equal(saved.cupGrams,null);
  assert.equal(saved.tbspGrams,9);assert.equal(saved.scoopGrams,36);
  fields.tbspGrams.value='';fields.tbspGrams.handlers.input({currentTarget:fields.tbspGrams});assert.equal(fields.tbspGrams.value,'');
});

test('density disagreement is informative; measured quantities are neither replaced nor required',()=>{
  const values={gramsPerMillilitre:0.5,tspGrams:2.5,tbspGrams:7.5,scoopGrams:40};
  assert.deepEqual(foodMeasureComparisons(values),[{field:'scoopGrams',label:'scoop de 60 ml',measured:40,fromDensity:30}]);
  assert.equal(values.scoopGrams,40);
  assert.deepEqual(foodMeasureComparisons({tspGrams:8}),[]);
});

test('the purchase form exposes exactly one package format and preserves hidden values when switching',()=>{
  const fields=Object.fromEntries(['shoppingPackageQuantity','shoppingUnitId'].map(name=>{const label={hidden:false};return [name,{value:'500',closest:()=>label}];}));
  fields.purchaseMode={value:'named'};const named={hidden:true};
  const form={elements:fields,querySelector:()=>named};
  assert.equal(foodPurchaseMode(form),true);assert.equal(named.hidden,false);
  assert.equal(fields.shoppingPackageQuantity.closest().hidden,true);
  fields.purchaseMode.value='simple';assert.equal(foodPurchaseMode(form),false);assert.equal(named.hidden,true);
  assert.equal(fields.shoppingPackageQuantity.closest().hidden,false);assert.equal(fields.shoppingPackageQuantity.value,'500');
});

test('nutrition issue action opens the food at its missing conversion with the originating recipe',async()=>{
  const source=await readFile(new URL('../web/app.js',import.meta.url),'utf8');
  const a=source.indexOf('function nutritionIssues('),b=source.indexOf('\nfunction mealRatiosFromForm',a);
  const element=()=>({children:[],handlers:{},append(...items){this.children.push(...items);},addEventListener(name,fn){this.handlers[name]=fn;},get childElementCount(){return this.children.length;}});
  const opened=[];const context={document:{createElement:element},format:String,foodCorrectionField,openFoodEditor:(...args)=>opened.push(args)};
  runInNewContext(source.slice(a,b)+'\nglobalThis.render=nutritionIssues;',context);
  const recipe={id:'recipe',name:'Synthetic',lines:[{foodId:'food',foodName:'Cacao',quantity:1,unitId:'tbsp'}],nutrition:{lineIssues:[{lineIndex:0,reason:'unit-conversion-missing',missingNutrients:[]}]}};
  const list=context.render(recipe),button=list.children[0].children.find(child=>child?.handlers?.click);
  button.handlers.click();assert.equal(opened[0][0],'food');assert.equal(opened[0][1].focusField,'tbspGrams');assert.equal(opened[0][1].correctionRecipe,recipe);
});

async function foodSubmission({mode='simple',existingRule=false}={}) {
  const source=await readFile(new URL('../web/app.js',import.meta.url),'utf8');
  const a=source.indexOf("$('#food-form').addEventListener('submit'"),b=source.indexOf('\nasync function loadHouseholds',a);
  const values={id:'food',name:'Cacao',brand:'',foodCategory:'',aliases:'',energyKcal:'300',proteinG:'10',carbohydrateG:'',fatG:'5',fibreG:'',gramsPerMillilitre:'0.5',cookingFactor:'',tspGrams:'',tbspGrams:'8',scoopGrams:'40',cupGrams:'120',pieceGrams:'',purchaseMode:mode,purchaseSingularLabel:'sachet',purchasePluralLabel:'sachets',purchaseCoveredQuantity:'500',purchaseCoveredUnitId:'g',purchaseEstimateNote:'',shoppingUnitId:'g',shoppingGroupId:'bulk',shoppingPackageQuantity:'750',shoppingOrderLinkId:''};
  const elements=Object.fromEntries(Object.entries(values).map(([key,value])=>[key,{value}]));
  const calls=[];let handler,closed=false;
  const form={elements,dataset:{purchaseUnitReady:'true',purchaseUnitExists:String(existingRule),shoppingSettingsReady:'true',shoppingSettingsDirty:'true',otherUnitConversions:'{"pinch":0.2,"cup":120}'},addEventListener(name,fn){handler=fn;}};
  const context={$:selector=>selector==='#food-form'?form:selector==='#food-dialog'?{close(){closed=true;}}:selector==='#admin-panel-catalogue'?{hidden:true}:{},
    foodMeasurePayload,foodMeasuredValues:form=>Object.fromEntries(['gramsPerMillilitre',...Object.keys(foodMeasureVolumes)].map(name=>[name,form.elements[name].value===''?null:Number(form.elements[name].value)])),state:{household:{id:'household'},account:{role:'manager'}},
    api:async(path,options)=>{calls.push({path,method:options.method,body:options.body?JSON.parse(options.body):null});return {food:{id:'food'}};},
    refreshFoods:async()=>{},refreshFoodCategories:async()=>{},refreshFoodCookingConflicts:async()=>{},refreshFoodStores:async()=>{}};
  runInNewContext(source.slice(a,b),context);
  await handler({preventDefault(){},currentTarget:form,submitter:{value:'default'}});
  return {calls,closed,handler,form};
}

test('saving simple versus named packaging retains missing nutrients and hidden conversions and writes only the chosen format',async()=>{
  const simple=await foodSubmission({existingRule:true});assert.equal(simple.closed,true);
  assert.deepEqual(simple.calls[0].body.gramsPerUnit,{pinch:0.2,cup:120,tbsp:8,scoop:40});
  assert.equal(simple.calls[0].body.nutrientsPer100g.carbohydrateG,null);
  assert.equal(simple.calls[1].method,'DELETE');assert.equal(simple.calls[2].body.packageQuantity,750);
  const named=await foodSubmission({mode:'named'});assert.equal(named.closed,true);
  assert.equal(named.calls[1].body.coveredQuantity,500);assert.equal(named.calls[1].body.singularLabel,'sachet');
  assert.equal(named.calls[2].body.packageQuantity,null);
  const count=named.calls.length;await named.handler({preventDefault(){},currentTarget:named.form,submitter:{value:'cancel'}});assert.equal(named.calls.length,count);
});

test('unweighed pinches do not block split recipe saving, component weights or production; shopping retains pinches',async()=>{
  const db=new PGlite();
  try{
    const dir=new URL('../db/migrations/',import.meta.url);
    for(const file of (await readdir(dir)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,dir),'utf8'));
    const pool={async query(sql,args=[]){const r=await db.query(sql,args);return {...r,rowCount:r.rows.length||r.affectedRows||0};},async connect(){return {...this,release(){}};}};
    const h=randomUUID(),person=randomUUID(),food=randomUUID(),spice=randomUUID();
    await pool.query("INSERT INTO households(id,name) VALUES($1,'Synthetic')",[h]);
    await pool.query("INSERT INTO people(id,household_id,display_name) VALUES($1,$2,'Test')",[person,h]);
    for(const [id,name] of [[food,'Base'],[spice,'Poivre']])await pool.query("INSERT INTO foods(id,canonical_name,source) VALUES($1,$2,'manual')",[id,name]);
    for(const [nutrient,value] of [['energy_kcal',100],['protein_g',10],['carbohydrate_g',10],['fat_g',2]])await pool.query('INSERT INTO food_nutrients(food_id,nutrient_id,value_per_100g) VALUES($1,$2,$3)',[food,nutrient,value]);
    await saveIngredientStock(pool,{householdId:h,foodId:spice,quantityG:100,minimumG:0,targetG:100,leadDays:7,version:0});
    const lines=[{foodId:food,quantity:100,unitId:'g',servingPart:'main'},{foodId:food,quantity:50,unitId:'g',servingPart:'starch'},{foodId:spice,quantity:1,unitId:'pinch',servingPart:'main',cookingState:'cooked_from_raw'}];
    const input=validateRecipeInput({householdId:h,name:'Synthetic pinch recipe',recipeType:'dish',productionType:'batch_cooking',yield:{amount:1,unitId:'portion'},separateStarch:true,servingMode:'separate',cookingFactors:{main:1,starch:1},lines});
    assert.equal(input.error,undefined);const recipe=await createRecipe(pool,input.data);assert.equal(recipe.error,undefined);
    assert.equal(recipe.nutrition.complete,true);assert.deepEqual(recipe.servingWeights,{main:100,starch:50});
    assert.equal(recipeWeight(await loadRecipeGraph(pool,h),recipe.id),150);
    await savePlannedMeal(pool,null,{householdId:h,mealDate:'2026-11-16',slot:'lunch',notes:'',attendeeIds:[person],items:[{recipeId:recipe.id,role:'main',amounts:[{personId:person,quantity:1}]}]});
    const needs=await rawShoppingRequirements(pool,h,'2026-11-16','2026-11-16');assert.ok(needs.some(row=>row.foodId===spice&&row.unitId==='pinch'&&row.quantity===1));
    const lot=await addStockLot(pool,{householdId:h,recipeId:recipe.id,producedOn:'2026-11-16',quantity:1,storage:'fridge',note:'',requestId:null});assert.equal(lot.error,undefined);
    assert.equal(Number((await pool.query('SELECT quantity_g FROM household_ingredient_stock WHERE food_id=$1',[spice])).rows[0].quantity_g),100);
    assert.equal(productionDeductions([{foodId:spice,name:'Poivre',quantity:1,unitId:'pinch',quantityG:100}],1,1).items.length,0);
    assert.equal(productionDeductions([{foodId:spice,name:'Poivre',quantity:1,unitId:'piece',quantityG:100}],1,1).error,'ingredient-conversion-missing');
    assert.equal(ingredientProjection({foodId:spice,quantityG:100,minimumG:0,targetG:100},needs).complete,true);
  }finally{await db.close();}
});
