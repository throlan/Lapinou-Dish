import {createHash} from 'node:crypto';
import {transaction,accountError,sendAccount,jsonBody} from './accounts.mjs';
import {lockHouseholdInventory} from './ingredient-stock.mjs';
import {readRecipe} from './recipes.mjs';
import {validatePlannedMeal,savePlannedMealInTransaction} from './planning.mjs';
import {validPlanningDate} from '../../web/planning-periods.js';
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
const fail=(message,status=409)=>{throw accountError(message,status);};
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function conversion(quantity,old,next){
 if(old.yield.unitId===next.yield.unitId)return quantity;
 if(next.outputUnits?.[old.yield.unitId]>0)return quantity*next.yield.amount/next.outputUnits[old.yield.unitId];
 if(old.outputUnits?.[next.yield.unitId]>0)return quantity*old.outputUnits[next.yield.unitId]/old.yield.amount;
 return null;
}
async function preview(client,id,h,start,end){
 if(!(await client.query('SELECT id FROM recipes WHERE id=$1 AND household_id=$2',[id,h])).rows.length)fail('recipe-not-found',404);
 const source=await readRecipe(client,id);if(!source||source.parentRecipeId||!source.replacedByRecipeId)fail('recipe-not-replaced');
 let target=source;const seen=new Set();while(target.replacedByRecipeId){if(seen.has(target.id))fail('recipe-replacement-cycle');seen.add(target.id);target=await readRecipe(client,target.replacedByRecipeId);if(!target)fail('recipe-not-found',404);}
 const mapping=new Map([[source.id,target]]);for(const part of source.servingParts){const next=target.servingParts.find(p=>p.servingPart===part.servingPart);if(next&&source.servingParts.length===target.servingParts.length)mapping.set(part.id,next);}
 const old=new Map([source,...source.servingParts,...source.archivedServingParts].map(r=>[r.id,r]));
 const found=await client.query(`SELECT DISTINCT m.id,m.meal_date::text AS date,m.slot,m.notes,m.prepared_at,
  EXISTS(SELECT 1 FROM recipe_stock_uses u WHERE u.meal_id=m.id AND u.cancelled_at IS NULL) AS used
  FROM planned_meals m JOIN planned_meal_items i ON i.meal_id=m.id
  WHERE m.household_id=$1 AND m.meal_date BETWEEN $2::date AND $3::date AND i.recipe_id=ANY($4::uuid[]) ORDER BY date,m.slot,m.id`,[h,start,end,[...old.keys()]]);
 const meals=[],changes=[];let protectedMeals=0;
 for(const m of found.rows){if(m.prepared_at||m.used){protectedMeals++;continue;}
  const people=(await client.query('SELECT a.person_id,p.display_name FROM planned_meal_attendees a JOIN people p ON p.id=a.person_id WHERE a.meal_id=$1 ORDER BY a.person_id',[m.id])).rows;
  const items=(await client.query('SELECT id,recipe_id,role,category_id FROM planned_meal_items WHERE meal_id=$1 ORDER BY sort_order,id',[m.id])).rows;let blocked=false;
  const data={householdId:h,mealDate:m.date,slot:m.slot,notes:m.notes,attendeeIds:people.map(p=>p.person_id),items:[]};
  for(const item of items){const amounts=(await client.query('SELECT person_id,quantity FROM planned_amounts WHERE planned_item_id=$1 ORDER BY person_id',[item.id])).rows.map(a=>({personId:a.person_id,quantity:Number(a.quantity)}));const previous=old.get(item.recipe_id),next=mapping.get(item.recipe_id);
   if(previous&&!next)blocked=true;
   data.items.push({recipeId:next?.id??item.recipe_id,role:item.role,categoryId:item.category_id,amounts});
   if(previous&&next)for(const amount of amounts)changes.push({key:item.id+':'+amount.personId,mealId:m.id,date:m.date,slot:m.slot,personId:amount.personId,personName:people.find(p=>p.person_id===amount.personId)?.display_name,before:amount.quantity,oldUnit:previous.yield.unitId,newUnit:next.yield.unitId,proposed:conversion(amount.quantity,previous,next),itemIndex:data.items.length-1});
  }
  meals.push({id:m.id,date:m.date,slot:m.slot,blocked,data});
 }
 const snapshot={sourceVersion:source.version,targetId:target.id,targetVersion:target.version,meals,changes,protectedMeals};
 return {source:{id:source.id,name:source.name},target:{id:target.id,name:target.name},start,end,meals,changes,protectedMeals,token:hash(snapshot)};
}
export function previewRecipeReplacement(pool,id,h,start,end){return transaction(pool,async client=>{await lockHouseholdInventory(client,h);return preview(client,id,h,start,end);});}
export function applyRecipeReplacement(pool,id,h,start,end,token,quantities){return transaction(pool,async client=>{
 await lockHouseholdInventory(client,h);const current=await preview(client,id,h,start,end);if(current.token!==token)fail('replacement-preview-stale');
 const expected=current.changes.filter(c=>!current.meals.find(m=>m.id===c.mealId).blocked);
 if(!quantities||Object.keys(quantities).length!==expected.length||expected.some(c=>!Number.isFinite(quantities[c.key])||quantities[c.key]<=0||quantities[c.key]>100000))fail('replacement-quantities-required',400);
 let updated=0;for(const meal of current.meals.filter(m=>!m.blocked)){
  for(const change of expected.filter(c=>c.mealId===meal.id))meal.data.items[change.itemIndex].amounts.find(a=>a.personId===change.personId).quantity=quantities[change.key];
  const checked=validatePlannedMeal(meal.data);if(checked.error)fail(checked.error,400);const saved=await savePlannedMealInTransaction(client,meal.id,checked.data,true);if(saved?.error)fail(saved.error);updated++;
 }return {updated};
});}
export async function recipeReplacementRoutes(request,response,pool,url){
 const match=url.pathname.match(/^\/api\/recipes\/([a-f0-9-]{36})\/replacement(?:\/(apply))?$/i);if(!match)return false;
 if((match[2]&&request.method!=='POST')||(!match[2]&&request.method!=='GET'))return false;
 try{const body=match[2]?await jsonBody(request):null,h=body?.householdId??url.searchParams.get('householdId'),start=body?.start??url.searchParams.get('start'),end=body?.end??url.searchParams.get('end');
  if(!uuid(h)||!uuid(match[1])||!validPlanningDate(start)||!validPlanningDate(end)||end<start)fail('invalid-replacement-request',400);
  sendAccount(response,200,match[2]?await applyRecipeReplacement(pool,match[1],h,start,end,body.token,body.quantities):await previewRecipeReplacement(pool,match[1],h,start,end));
 }catch(e){if(!e.status)throw e;sendAccount(response,e.status,{error:e.message});}return true;
}
