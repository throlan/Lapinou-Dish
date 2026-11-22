import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {homeBudgetShare,plannedMacro,itemMacro,fitsDayExtra,expandDayMealPortions,findDayRecipes,preparationStockLabel} from '../web/day-meals.js';
import {MEAL_ORDER,MEAL_LABELS,DEFAULT_MEAL_RATIOS} from '../web/meal-config.js';

test('the four day selectors recalculate totals and serve dessert to the people with room in their own budgets',async()=>{
  const source=await readFile(new URL('../web/app.js',import.meta.url),'utf8');
  const start=source.indexOf('function openDayMeals('),end=source.indexOf('const dailyConsumptionEndpoint',start);
  const node=tag=>({tag,value:'',children:[],handlers:{},append(...children){for(const child of children)child.parentElement=this;this.children.push(...children);},
    replaceChildren(){this.children=[];},setAttribute(){},add(option){this.append(option);},
    addEventListener(type,handler){this.handlers[type]=handler;},showModal(){this.open=true;},close(){this.open=false;},focus(){},
    get elements(){return this.children.flatMap(group=>group.children.flatMap(item=>item.tag==='select'?[item]:item.children.filter(c=>c.tag==='input')));},
    querySelectorAll(tag){return this.children.flatMap(item=>item.children.filter(c=>c.tag===tag));}
  });
  const nodes=Object.fromEntries(['dialog','choices','message','title'].map(key=>['#day-meals-'+key,node(key)]));
  const recipe=(id,recipeType,slot,kcal)=>({id,name:id,recipeType,slot,yield:{unitId:'piece'},nutrition:{perYieldUnit:{energyKcal:kcal}}});
  const recipes=[recipe('Pancakes','dish','breakfast',200),recipe('Fruit','dessert','snack',150),recipe('Salade','salad','lunch',300),recipe('Dîner','dish','dinner',300),
    recipe('Sauce','sauce','lunch',25),recipe('Thé','beverage','breakfast',0),recipe('Cappuccino','beverage','breakfast',75),recipe('Expresso','beverage','breakfast',15),
    recipe('Biscuit','dessert','breakfast',35),recipe('Skyr','custom-dairy','breakfast',43),
    recipe('Crème','dessert','dinner',50),recipe('Yaourt','dessert','dinner',100),recipe('Gâteau','dessert','dinner',350)];
  const variant={...recipe('Bowl à composer','dish','lunch',40),choiceGroups:[{id:'proteine'}]};
  recipes.push(variant,recipe('Compote','dessert','snack',65));
  let payload, paintedStock, finishComposition, chosenSelection;
  const variantResult={...recipe('Bowl saumon','dish','lunch',410),choiceInstance:true,
    choiceOrigin:{templateId:variant.id,selection:{proteine:'saumon'}}};
  const context={loadPlanningStock:async()=>new Map([['Pancakes',{quantity:3,unitId:'piece'}]]),
    createDayRecipePicker:(_slot,_label,_recipes,onChange)=>{
      const element=node('input');
      element.pick=recipe=>{element.value=recipe?.id??'';onChange(recipe);};
      return {element,get value(){return element.value;},setSelection(recipe){element.value=recipe?.id??'';},setStock(){}};
    },
    annotatePlanningStock:(root,stock)=>{paintedStock={root,stock};},MEAL_ORDER,homeBudgetShare,plannedMacro,itemMacro,fitsDayExtra,expandDayMealPortions,$:selector=>nodes[selector],document:{createElement:node,createTextNode:text=>({text})},
    Option:function(label,value){Object.assign(this,{label,value});},
    state:{household:{id:'h'},people:[{id:'a',displayName:'Adulte',breakfastDrinkRecipeId:'Cappuccino'},{id:'b',displayName:'Enfant',breakfastDrinkRecipeId:'Thé'}],recipes,
      mealAdditions:[{id:'pastry',role:'dessert',recipeType:'dessert',slots:['breakfast']},{id:'dairy',role:'dessert',recipeType:'custom-dairy',slots:['breakfast']}],
      mealRatios:DEFAULT_MEAL_RATIOS},
    slotLabels:MEAL_LABELS,displayDate:x=>x,latestProfile:()=>({dailyEnergyKcal:1000}),format:String,formatQty:String,
    displayServingQuantity:(_,q)=>q,servingUnitLabel:x=>x,servingUnit:()=> 'pièce',allPlanningRecipes:()=>recipes,
    recipesForPlanning:(slot,role,_,type)=>recipes.filter(r=>r.slot===slot&&!r.choiceInstance&&(role==='main'||r.recipeType===(type??role))),
    chooseRecipeCombination:(_,initial)=>{
      chosenSelection=initial;
      return new Promise(resolve=>{finishComposition=chosen=>{
        if(chosen&&!recipes.includes(chosen))recipes.push(chosen);
        resolve(chosen);
      };});
    },
    applyAutomaticPortions:(items,ids,options)=>{
      for(const item of items)item.amounts=Object.fromEntries(ids.map(id=>{
        const kcal=recipes.find(recipe=>recipe.id===item.recipeId).nutrition.perYieldUnit.energyKcal;
        if(options.slot==='snack'&&options.energyBudget!=null)return [id,Math.min(1,Math.floor(Math.min(100,options.energyBudget)/kcal))];
        return [id,options.energyBudget&&item.recipeId==='Dîner'&&id==='a'?1.1:1];
      }));
      return [];
    },
    individualDefaultQuantity:()=>1,calculateDailyEnergy:()=>({kcal:0}),newProductionRequestId:()=> 'request',
    api:async(_,options)=>{payload=JSON.parse(options.body);},refreshCalendar:async()=>{},refreshDashboard:async()=>{}};
  runInNewContext(source.slice(start,end)+'\nopenDayMeals("2026-11-25",[]);',context);
  await Promise.resolve();
  assert.deepEqual(paintedStock.stock.get('Pancakes'),{quantity:3,unitId:'piece'});
  const [form,review]=nodes['#day-meals-choices'].children;
  assert.equal(form.children.length,4);
  const [breakfast,lunch,snack,dinner]=form.children;
  breakfast.children[1].value='Pancakes';lunch.children[1].value='Salade';dinner.children[1].value='Dîner';
  lunch.children[3].children[0].checked=false;
  form.handlers.change();
  const totals=()=>review.children.find(child=>child.className==='day-meal-totals').children.slice(1)
    .map(row=>row.children.map(child=>child.textContent).join(' · '));
  assert.match(totals()[1],/Enfant · 500 \/ 600 kcal/);
  const beverage=personIndex=>breakfast.children.at(-1).children[0].children[personIndex+1].children[1];
  const change=select=>select.handlers.change({stopPropagation(){}});
  assert.deepEqual(beverage(0).children.map(option=>option.value),['','Thé','Cappuccino','Expresso']);
  assert.equal(beverage(0).value,'Cappuccino');assert.equal(beverage(1).value,'Thé');
  assert.match(totals()[0],/Adulte · 875 \/ 1000 kcal/);
  beverage(0).value='';change(beverage(0));
  const dessert=()=>dinner.children.at(-1).children[0].children[1];
  assert.deepEqual(dessert().children.map(option=>option.value),['','Crème','Yaourt']);
  dessert().value='Yaourt';dessert().handlers.change({stopPropagation(){}});
  assert.match(totals()[1],/Enfant · 600 \/ 600 kcal/);
  assert.equal(beverage(0).value,'');
  snack.children[1].value='Fruit';snack.children[3].children[0].checked=false;
  form.handlers.change();
  assert.match(totals()[0],/Adulte · 980 \/ 1000 kcal/);
  assert.deepEqual(dessert().children.map(option=>option.value),['','Crème','Yaourt']);
  assert.equal(dinner.children.at(-1).children[1].textContent,'Pour Enfant');
  assert.match(dessert().children.find(option=>option.value==='Crème').label,/1\/2 convives/);
  assert.ok(!beverage(0).children.some(option=>option.value==='Cappuccino'));
  beverage(0).value='Expresso';change(beverage(0));
  assert.match(totals()[0],/Adulte · 995 \/ 1000 kcal/);
  await review.children.at(-1).handlers.click();
  assert.deepEqual(payload.meals.find(meal=>meal.slot==='breakfast').attendeeIds,['a','b']);
  assert.deepEqual(payload.meals.find(meal=>meal.slot==='lunch').attendeeIds,['a']);
  const drinks=payload.meals.find(meal=>meal.slot==='breakfast').items.filter(item=>item.role==='beverage');
  assert.deepEqual(drinks.map(item=>[item.recipeId,item.amounts[0].personId]),[['Expresso','a'],['Thé','b']]);
  assert.deepEqual(payload.meals.find(meal=>meal.slot==='dinner').items[1].amounts,[{personId:'b',quantity:1}]);
  recipes[0].nutrition.perYieldUnit.energyKcal=150;
  context.openDayMeals('2026-11-26',[]);
  const [newForm,newReview]=nodes['#day-meals-choices'].children;
  const morning=newForm.children[0];
  morning.children[1].value='Pancakes';newForm.handlers.change();
  const extra=personIndex=>morning.children.at(-1).children[1].children[personIndex+1].children[1];
  assert.deepEqual(extra(0).children.map(option=>option.value),['','Biscuit','Skyr']);
  assert.deepEqual(extra(1).children.map(option=>option.value),['','Biscuit','Skyr']);
  extra(1).value='Biscuit';change(extra(1));
  assert.deepEqual(extra(1).children.map(option=>option.value),['','Biscuit','Skyr']);
  const suggestions=reviewNode=>reviewNode.children.find(child=>child.className==='day-meal-suggestions');
  const suggestion=(reviewNode,label)=>suggestions(reviewNode)?.children.find(row=>row.children[0]?.textContent?.startsWith(label));
  assert.match(suggestion(newReview,'Petit-déjeuner · Adulte').children[0].textContent,/Skyr/);
  const snackSuggestion=suggestion(newReview,'Collation');
  assert.match(snackSuggestion.children[0].textContent,/Compote/);
  assert.match(snackSuggestion.children[1].textContent,/65 kcal/);
  snackSuggestion.children[2].handlers.click();
  extra(1).value='Skyr';change(extra(1));
  await newReview.children.at(-1).handlers.click();
  assert.deepEqual(payload.meals[0].items.find(item=>item.recipeId==='Skyr'),{
    recipeId:'Skyr',role:'dessert',categoryId:'dairy',amounts:[{personId:'b',quantity:1}],
  });
  assert.deepEqual(payload.meals.find(meal=>meal.slot==='snack').items.map(item=>[item.recipeId,item.amounts.map(amount=>amount.quantity)]),[['Compote',[1,1]]]);
  context.openDayMeals('2026-11-27',[]);
  const [variantForm,variantReview]=nodes['#day-meals-choices'].children;
  const [,variantLunch,,variantDinner]=variantForm.children;
  variantDinner.children[1].pick(recipes.find(recipe=>recipe.id==='Dîner'));
  variantLunch.children[1].pick(variant);
  assert.equal(variantLunch.children[1].value,'');
  assert.equal(variantReview.children.at(-1).disabled,true);
  finishComposition(null);
  await new Promise(setImmediate);
  assert.equal(variantLunch.children[1].value,'');
  variantLunch.children[1].pick(variant);
  finishComposition(variantResult);
  await new Promise(setImmediate);
  assert.equal(variantLunch.children[1].value,'Bowl saumon');
  assert.match(variantReview.children[0].children[1].children[1].textContent,/710 \/ 1000/);
  const proposedDessert=suggestion(variantReview,'Dîner · Dessert');
  assert.match(proposedDessert.children[0].textContent,/Yaourt/);
  proposedDessert.children[2].handlers.click();
  variantLunch.children.at(-1).children[0].handlers.click();
  assert.deepEqual(chosenSelection,{proteine:'saumon'});
  finishComposition(null);
  await new Promise(setImmediate);
  await variantReview.children.at(-1).handlers.click();
  assert.equal(payload.meals.find(meal=>meal.slot==='lunch').items[0].recipeId,'Bowl saumon');
  assert.equal(payload.meals.find(meal=>meal.slot==='dinner').items[1].recipeId,'Yaourt');
});

test('the searchable selector matches any word in the title and retains stock and keyboard selection',async()=>{
  const source=await readFile(new URL('../web/day-meals.js',import.meta.url),'utf8');
  const start=source.indexOf('export function createDayRecipePicker'),end=source.indexOf('export function fitsDayExtra',start);
  const node=()=>({children:[],attrs:{},handlers:{},value:'',classList:{toggle(){}},
    append(...nodes){this.children.push(...nodes);},replaceChildren(...nodes){this.children=nodes;},prepend(value){this.children.unshift(value);},
    setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];},
    addEventListener(k,fn){this.handlers[k]=fn;},scrollIntoView(){},
  });
  const context={document:{createElement:node},findDayRecipes,preparationStockLabel};
  runInNewContext(source.slice(start,end).replace(/^export /,'')+'\nglobalThis.create=createDayRecipePicker;',context);
  const recipes=[{id:'b',name:'Bowl aux légumineuses saumon',productionType:'batch_cooking'},{id:'c',name:'Tarte aux pommes'}];
  let changes=0;
  const picker=context.create('lunch','Déjeuner',recipes,()=>changes++, (quantity,unit)=>quantity+' '+unit);
  const [input,list]=picker.element.children;
  picker.setStock(new Map([['b',{quantity:2,unitId:'portions'}]]));
  input.handlers.focus();input.value='LEGUMINEUSES sau';input.handlers.input();
  assert.equal(list.children.length,1);
  assert.match(list.children[0].children[0].textContent,/2 portions/);
  const press=key=>input.handlers.keydown({key,preventDefault(){}});
  press('ArrowDown');press('Enter');
  assert.equal(picker.value,'b');assert.equal(input.value,'Bowl aux légumineuses saumon');assert.equal(changes,1);
  input.handlers.focus();input.value='aucun résultat';input.handlers.input();press('Enter');
  assert.equal(picker.value,'b');assert.equal(changes,1);
  press('Escape');assert.equal(input.value,'Bowl aux légumineuses saumon');
});
