import {cookingPeriod,freePlanningSlots,validPlanningDate} from '../../web/planning-periods.js';
import {readRecipe} from './recipes.mjs';
import {recipeRequirements} from './recipe-ingredients.mjs';
import {sendAccount,accountError} from './accounts.mjs';
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);

export async function cookingForMeal(pool,householdId,mealId,recipeId,scope){
 const meal=(await pool.query('SELECT id,meal_date::text AS date FROM planned_meals WHERE id=$1 AND household_id=$2',[mealId,householdId])).rows[0];
 if(!meal)throw accountError('planned-meal-not-found',404);
 const used=await pool.query('SELECT 1 FROM planned_meal_items i JOIN recipes r ON r.id=i.recipe_id WHERE i.meal_id=$1 AND COALESCE(r.parent_recipe_id,r.id)=$2',[mealId,recipeId]);
 if(!used.rows.length)throw accountError('recipe-not-in-meal',404);
 const recipe=await readRecipe(pool,recipeId);if(!recipe)throw accountError('recipe-not-found',404);
 const period=cookingPeriod(meal.date,scope);
 const requirements=await recipeRequirements(pool,householdId,period.start,period.end,{mealId:scope==='meal'?mealId:null,includeUntracked:true,includeMealIds:true});
 const ids=new Set([recipe.id,...recipe.servingParts.map(p=>p.id)]),preparations=requirements.preparations.filter(p=>ids.has(p.recipeId));
 return {recipe,preparations,period,plannedMealId:scope==='meal'?mealId:null,mealCount:new Set(preparations.flatMap(p=>p.mealIds??[])).size,scope};
}

export async function planningCookingRoutes(request,response,pool,url){
 if(request.method!=='GET')return false;
 if(url.pathname==='/api/planning/available-slots'){
  const householdId=url.searchParams.get('householdId'),start=url.searchParams.get('startDate'),end=url.searchParams.get('endDate');
  if(!uuid(householdId)||!validPlanningDate(start)||!validPlanningDate(end)||end<start||(+new Date(end)-+new Date(start))/86400000>62){sendAccount(response,400,{error:'invalid-planning-period'});return true;}
  const occupied=(await pool.query('SELECT meal_date::text AS date,slot FROM planned_meals WHERE household_id=$1 AND meal_date BETWEEN $2::date AND $3::date',[householdId,start,end])).rows;
  sendAccount(response,200,{slots:freePlanningSlots(start,end,occupied)});return true;
 }
 const match=url.pathname.match(/^\/api\/planning\/meals\/([a-f0-9-]{36})\/cooking$/i);if(!match)return false;
 const householdId=url.searchParams.get('householdId'),recipeId=url.searchParams.get('recipeId'),scope=url.searchParams.get('scope')??'meal';
 if(!uuid(householdId)||!uuid(recipeId)||!['meal','week','fortnight','month'].includes(scope)){sendAccount(response,400,{error:'invalid-cooking-scope'});return true;}
 try{sendAccount(response,200,await cookingForMeal(pool,householdId,match[1],recipeId,scope));}
 catch(error){if(!error.status)throw error;sendAccount(response,error.status,{error:error.message});}return true;
}
