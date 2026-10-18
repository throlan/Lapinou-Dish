import {randomUUID} from 'node:crypto';
import {toGrams} from '../domain/foods.ts';

export const componentErrors = ['recipe-ingredient-cycle','recipe-ingredient-not-found','recipe-ingredient-unit-missing','recipe-output-in-use'];
const fail = code => {throw new Error(code);};

// One household snapshot shared by nutrition, cooked weights, planning and stock.
// References stay live: no copied nutrition or duplicated catalogue food.
export async function loadRecipeGraph(client,householdId) {
  const recipes=await client.query(`SELECT id,name,yield_amount,yield_unit_id,output_units,production_type,
    parent_recipe_id,separate_starch,cooking_factors FROM recipes WHERE household_id=$1`,[householdId]);
  const lines=await client.query(`SELECT l.recipe_id,l.food_id,l.ingredient_recipe_id,l.quantity,l.unit_id,l.serving_part,l.cooking_factor,
    f.canonical_name,f.grams_per_millilitre,
    COALESCE((SELECT jsonb_object_agg(c.unit_id,c.grams_per_unit) FROM food_unit_conversions c WHERE c.food_id=f.id),'{}'::jsonb) AS grams_per_unit
    FROM recipe_lines l JOIN recipes r ON r.id=l.recipe_id LEFT JOIN foods f ON f.id=l.food_id
    WHERE r.household_id=$1 ORDER BY l.sort_order,l.id`,[householdId]);
  const graph=new Map(recipes.rows.map(r=>[r.id,{id:r.id,name:r.name,yield:{amount:Number(r.yield_amount),unitId:r.yield_unit_id},
    outputUnits:r.output_units??{},productionType:r.production_type,parentRecipeId:r.parent_recipe_id,
    separateStarch:r.separate_starch,cookingFactors:r.cooking_factors??{},lines:[],parts:[]}]));
  for(const r of graph.values())if(r.parentRecipeId)graph.get(r.parentRecipeId)?.parts.push(r);
  for(const l of lines.rows)graph.get(l.recipe_id).lines.push({foodId:l.food_id,recipeId:l.ingredient_recipe_id,
    quantity:Number(l.quantity),unitId:l.unit_id,servingPart:l.serving_part??'main',cookingFactor:l.cooking_factor==null?null:Number(l.cooking_factor),
    name:l.canonical_name,gramsPerMillilitre:l.grams_per_millilitre==null?null:Number(l.grams_per_millilitre),
    gramsPerUnit:Object.fromEntries(Object.entries(l.grams_per_unit).map(([k,v])=>[k,Number(v)]))});
  return graph;
}

export function recipeWeight(graph,recipeId,path=[]) {
  if(path.includes(recipeId))return fail('recipe-ingredient-cycle');
  const recipe=graph.get(recipeId);if(!recipe)return fail('recipe-ingredient-not-found');
  if(recipe.yield.unitId==='g')return recipe.yield.amount;
  if(recipe.outputUnits.g)return Number(recipe.outputUnits.g);
  let total=0;
  for(const line of recipe.lines){
    let grams;
    if(line.recipeId){
      const fraction=recipeFraction(graph,line.recipeId,line.quantity,line.unitId,[...path,recipeId]);
      grams=recipeWeight(graph,line.recipeId,[...path,recipeId])*fraction;
    }else grams=toGrams(line.quantity,line.unitId,line);
    if(grams==null || !Number.isFinite(grams))return null;
    // Components are already prepared; never reapply a rice/pasta cooking factor.
    total+=grams*(line.recipeId?1:line.cookingFactor??(recipe.separateStarch?recipe.cookingFactors[line.servingPart]:1)??1);
  }
  return total>0?total:null;
}

export function recipeFraction(graph,recipeId,quantity,unitId,path=[]) {
  const recipe=graph.get(recipeId);if(!recipe)return fail('recipe-ingredient-not-found');
  if(path.includes(recipeId))return fail('recipe-ingredient-cycle');
  if(unitId==='kg'){quantity*=1000;unitId='g';}
  if(unitId==='l'){quantity*=1000;unitId='ml';}
  const amount=unitId===recipe.yield.unitId?recipe.yield.amount:Number(recipe.outputUnits[unitId])||
    (unitId==='g'?recipeWeight(graph,recipeId,path):null);
  if(!(amount>0))return fail('recipe-ingredient-unit-missing');
  return quantity/amount;
}

export function validateRecipeGraph(graph) {
  const done=new Set();
  function visit(recipe,path=[]){
    if(path.includes(recipe.id))return fail('recipe-ingredient-cycle');
    if(done.has(recipe.id))return;
    for(const line of recipe.lines.filter(l=>l.recipeId)){
      const child=graph.get(line.recipeId);
      if(!child || child.parentRecipeId)return fail('recipe-ingredient-not-found');
      visit(child,[...path,recipe.id]);
      recipeFraction(graph,child.id,line.quantity,line.unitId);
    }
    done.add(recipe.id);
  }
  for(const recipe of graph.values())visit(recipe);
}

export async function availableRecipeStock(client,householdId) {
  const result=await client.query(`WITH produced AS (
    SELECT recipe_id,sum(quantity) AS quantity FROM stock_lots WHERE household_id=$1 AND cancelled_at IS NULL AND NOT is_serving_bundle GROUP BY recipe_id
  ), prepared AS (
    SELECT i.recipe_id,sum(a.quantity) AS quantity FROM planned_meals m JOIN planned_meal_items i ON i.meal_id=m.id
    JOIN planned_amounts a ON a.planned_item_id=i.id JOIN recipes r ON r.id=i.recipe_id
    WHERE m.household_id=$1 AND m.prepared_at IS NOT NULL AND r.production_type<>'none' GROUP BY i.recipe_id
  ), used AS (SELECT recipe_id,sum(quantity) AS quantity FROM recipe_stock_uses WHERE household_id=$1 AND cancelled_at IS NULL GROUP BY recipe_id)
  SELECT r.id,COALESCE(p.quantity,0)-COALESCE(b.quantity,0)-COALESCE(u.quantity,0) AS quantity
  FROM recipes r LEFT JOIN produced p ON p.recipe_id=r.id LEFT JOIN prepared b ON b.recipe_id=r.id LEFT JOIN used u ON u.recipe_id=r.id
  WHERE r.household_id=$1`,[householdId]);
  return new Map(result.rows.map(r=>[r.id,Number(r.quantity)]));
}

// Expand missing quantities only, sharing the same finished-stock pool for direct
// menus and nested uses. Earlier menus reserve first, exactly as before.
export async function recipeRequirements(client,householdId,startDate,endDate) {
  const graph=await loadRecipeGraph(client,householdId),stock=await availableRecipeStock(client,householdId),initialStock=new Map(stock);
  const events=await client.query(`SELECT m.id,m.meal_date::text AS date,i.recipe_id,sum(a.quantity) AS quantity
    FROM planned_meals m JOIN planned_meal_items i ON i.meal_id=m.id JOIN planned_amounts a ON a.planned_item_id=i.id
    WHERE m.household_id=$1 AND m.prepared_at IS NULL AND m.meal_date<=$2::date
    GROUP BY m.id,m.meal_date,i.recipe_id ORDER BY m.meal_date,m.id,i.recipe_id`,[householdId,endDate]);
  const preparations=new Map(),foods=new Map(),reservations=new Map();
  function demand(recipeId,quantity,event,path=[]){
    if(!(quantity>0))return;
    if(path.includes(recipeId))return fail('recipe-ingredient-cycle');
    const r=graph.get(recipeId);if(!r)return fail('recipe-ingredient-not-found');
    if(r.separateStarch && r.parts.length){
      for(const part of r.parts)demand(part.id,quantity/r.yield.amount*part.yield.amount,event,[...path,recipeId]);
      return;
    }
    const covered=r.productionType==='none'?0:Math.min(quantity,Math.max(0,stock.get(recipeId)??0));
    const missing=quantity-covered;
    if(r.productionType!=='none'){
      stock.set(recipeId,(stock.get(recipeId)??0)-covered);
      reservations.set(recipeId,(reservations.get(recipeId)??0)+quantity);
    }
    const inRange=event.date>=startDate;
    if(inRange && r.productionType!=='none'){
      const p=preparations.get(recipeId)??{recipeId,parentRecipeId:r.parentRecipeId,name:r.name,productionType:r.productionType,
        unitId:r.yield.unitId,yieldAmount:r.yield.amount,plannedQuantity:0,coveredQuantity:0,toMakeQuantity:0,
        stockQuantity:initialStock.get(recipeId)??0,firstDate:event.date,lastDate:event.date,meals:new Set()};
      p.plannedQuantity+=quantity;p.coveredQuantity+=covered;p.toMakeQuantity+=missing;p.lastDate=event.date;p.meals.add(event.id);preparations.set(recipeId,p);
    }
    for(const line of r.lines){
      const scaled=line.quantity*missing/r.yield.amount;if(!(scaled>0))continue;
      if(line.recipeId){
        const child=graph.get(line.recipeId);
        demand(child.id,recipeFraction(graph,child.id,scaled,line.unitId)*child.yield.amount,event,[...path,recipeId]);
      }else if(inRange){
        const key=`${line.foodId}:${line.unitId}`,f=foods.get(key)??{foodId:line.foodId,name:line.name,unitId:line.unitId,quantity:0,
          gramsPerMillilitre:line.gramsPerMillilitre,gramsPerUnit:line.gramsPerUnit,sources:new Map()};
        f.quantity+=scaled;
        const source=f.sources.get(r.id)??{id:r.id,name:r.name,quantity:0,unitId:line.unitId};source.quantity+=scaled;f.sources.set(r.id,source);foods.set(key,f);
      }
    }
  }
  for(const event of events.rows)demand(event.recipe_id,Number(event.quantity),event);
  return {graph,initialStock,reservations,
    preparations:[...preparations.values()].map(({meals,...p})=>({...p,plannedQuantity:clean(p.plannedQuantity),coveredQuantity:clean(p.coveredQuantity),toMakeQuantity:clean(p.toMakeQuantity),mealCount:meals.size})).sort((a,b)=>a.firstDate.localeCompare(b.firstDate)||a.name.localeCompare(b.name,'fr')),
    foods:[...foods.values()].map(({sources,...f})=>({...f,quantity:clean(f.quantity),recipes:[...sources.values()].map(r=>({...r,quantity:clean(r.quantity)})).sort((a,b)=>a.name.localeCompare(b.name,'fr'))})).sort((a,b)=>a.name.localeCompare(b.name,'fr')||a.unitId.localeCompare(b.unitId))};
}

// Used inside the caller's inventory transaction. Tracked components must be
// cooked first; untracked sauces are made as part of the dish from raw foods.
export async function preparationInputs(client,householdId,targets) {
  const graph=await loadRecipeGraph(client,householdId),stock=await availableRecipeStock(client,householdId);
  const uses=new Map(),foods=[];
  function ingredients(recipeId,factor,path=[]){
    if(path.includes(recipeId))return fail('recipe-ingredient-cycle');
    const r=graph.get(recipeId);if(!r)return fail('recipe-ingredient-not-found');
    for(const line of r.lines){
      if(!line.recipeId){foods.push({...line,quantity:line.quantity*factor});continue;}
      const child=graph.get(line.recipeId),fraction=recipeFraction(graph,child.id,line.quantity*factor,line.unitId);
      if(child.productionType==='none')ingredients(child.id,fraction,[...path,recipeId]);
      else for(const target of child.separateStarch&&child.parts.length?child.parts:[child]){
        uses.set(target.id,(uses.get(target.id)??0)+fraction*target.yield.amount);
      }
    }
  }
  for(const target of targets)ingredients(target.id,target.factor);
  for(const [recipeId,quantity] of uses){
    if(quantity>(stock.get(recipeId)??0)+0.00000001)return {error:'prepared-component-insufficient',recipeId,name:graph.get(recipeId).name,
      requiredQuantity:quantity,availableQuantity:Math.max(0,stock.get(recipeId)??0),unitId:graph.get(recipeId).yield.unitId};
  }
  const tracked=await client.query('SELECT food_id,quantity_g FROM household_ingredient_stock WHERE household_id=$1 ORDER BY food_id FOR UPDATE',[householdId]);
  const byFood=new Map(tracked.rows.map(r=>[r.food_id,Number(r.quantity_g)]));
  return {uses,lines:foods.filter(l=>byFood.has(l.foodId)).map(l=>({...l,quantityG:byFood.get(l.foodId)}))};
}

export async function recordRecipeUses(client,householdId,uses,{lotId=null,mealId=null}) {
  for(const [recipeId,quantity] of uses)await client.query(`INSERT INTO recipe_stock_uses(id,household_id,recipe_id,quantity,stock_lot_id,meal_id)
    VALUES($1,$2,$3,$4,$5,$6)`,[randomUUID(),householdId,recipeId,quantity,lotId,mealId]);
}

const clean=value=>Math.round(value*1e10)/1e10;
