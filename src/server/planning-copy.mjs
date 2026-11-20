import {createHash} from 'node:crypto';
import {lockHouseholdInventory} from './ingredient-stock.mjs';
import {validatePlannedMeal,savePlannedMealInTransaction} from './planning.mjs';
import {validPlanningDate,shiftPlanningDate} from '../../web/planning-periods.js';

const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const fail=(error,extra={})=>{throw Object.assign(new Error(error),extra);};
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
const hash=value=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
export function validatePlanningCopy(input){
 if(!input||!uuid(input.householdId)||![1,7].includes(input.days)||!validPlanningDate(input.sourceStart)||!validPlanningDate(input.targetStart))return {error:'invalid-planning-copy'};
 const {householdId,sourceStart,targetStart,days}=input;
 if(days===7&&[sourceStart,targetStart].some(d=>new Date(d+'T12:00:00Z').getUTCDay()!==1))return {error:'copy-week-must-start-monday'};
 if(sourceStart<=shiftPlanningDate(targetStart,days-1)&&targetStart<=shiftPlanningDate(sourceStart,days-1))return {error:'copy-periods-overlap'};
 return {data:{householdId,sourceStart,targetStart,days}};
}
async function sourceMeals(client,input){
 const rows=await client.query(`SELECT id,meal_date::text AS date,slot,notes,is_occasion,occasion_title FROM planned_meals
  WHERE household_id=$1 AND meal_date BETWEEN $2::date AND $3::date ORDER BY meal_date,slot,id`,[input.householdId,input.sourceStart,shiftPlanningDate(input.sourceStart,input.days-1)]);
 const meals=[];
 for(const row of rows.rows){
  const people=await client.query('SELECT person_id FROM planned_meal_attendees WHERE meal_id=$1 ORDER BY person_id',[row.id]);
  const items=await client.query('SELECT i.id,i.recipe_id,i.role,i.category_id,r.name FROM planned_meal_items i JOIN recipes r ON r.id=i.recipe_id WHERE i.meal_id=$1 ORDER BY i.sort_order,i.id',[row.id]);
  const data={householdId:input.householdId,mealDate:shiftPlanningDate(input.targetStart,Math.round((new Date(row.date)-new Date(input.sourceStart))/86400000)),slot:row.slot,notes:row.notes,attendeeIds:people.rows.map(p=>p.person_id),items:[],isOccasion:row.is_occasion,occasionTitle:row.occasion_title,occasionEnergy:[]};
  for(const item of items.rows){const amounts=await client.query('SELECT person_id,quantity FROM planned_amounts WHERE planned_item_id=$1 ORDER BY person_id',[item.id]);data.items.push({recipeId:item.recipe_id,role:item.role,categoryId:item.category_id,amounts:amounts.rows.map(a=>({personId:a.person_id,quantity:Number(a.quantity)}))});}
  if(row.is_occasion)data.occasionEnergy=(await client.query('SELECT person_id,energy_kcal FROM planned_occasion_energy WHERE meal_id=$1 ORDER BY person_id',[row.id])).rows.map(e=>({personId:e.person_id,kcal:Number(e.energy_kcal)}));
  meals.push({sourceId:row.id,sourceDate:row.date,recipeNames:items.rows.map(i=>i.name),data});
 }
 return meals;
}
async function conflictsFor(client,householdId,meals){
 const dates=[...new Set(meals.map(m=>m.data.mealDate))];if(!dates.length)return [];
 const occupied=await client.query('SELECT meal_date::text AS date,slot FROM planned_meals WHERE household_id=$1 AND meal_date=ANY($2::date[])',[householdId,dates]);
 const keys=new Set(meals.map(m=>m.data.mealDate+':'+m.data.slot));return occupied.rows.filter(r=>keys.has(r.date+':'+r.slot));
}
export async function previewPlanningCopy(pool,input){
 const client=await pool.connect();try{
  await client.query('BEGIN');await lockHouseholdInventory(client,input.householdId);
  const meals=await sourceMeals(client,input),conflicts=await conflictsFor(client,input.householdId,meals);
  const result={...input,fingerprint:hash(meals),meals:meals.map(m=>({sourceDate:m.sourceDate,date:m.data.mealDate,slot:m.data.slot,recipeNames:m.recipeNames,recipeCount:m.data.items.length,peopleCount:m.data.attendeeIds.length})),conflicts};
  await client.query('COMMIT');return result;
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
async function operation(pool,householdId,requestId,payload,create){
 if(!uuid(requestId))return {error:'invalid-planning-request'};
 const client=await pool.connect();try{
  await client.query('BEGIN');await lockHouseholdInventory(client,householdId);
  const prior=await client.query('SELECT payload,result FROM planning_operations WHERE household_id=$1 AND request_id=$2',[householdId,requestId]);
  if(prior.rowCount){await client.query('ROLLBACK');return hash(prior.rows[0].payload)===hash(JSON.parse(JSON.stringify(payload)))?{...prior.rows[0].result,replayed:true}:{error:'planning-request-conflict'};}
  const result=await create(client);
  await client.query('INSERT INTO planning_operations(household_id,request_id,payload,result) VALUES($1,$2,$3::jsonb,$4::jsonb)',[householdId,requestId,JSON.stringify(payload),JSON.stringify(result)]);
  await client.query('COMMIT');return result;
 }catch(e){await client.query('ROLLBACK');if(e.code==='23503')return {error:'invalid-planned-reference'};if(e.message.startsWith('planning-')||e.message.startsWith('copy-')||e.planningError)return {error:e.message,...(e.conflicts?{conflicts:e.conflicts}:{})};throw e;}finally{client.release();}
}
async function writeMeals(client,householdId,meals){
 const conflicts=await conflictsFor(client,householdId,meals);if(conflicts.length)fail('planning-slot-unavailable',{conflicts});
 const mealIds=[];for(const {data} of meals){const valid=validatePlannedMeal(data);if(valid.error)fail(valid.error,{planningError:true});const saved=await savePlannedMealInTransaction(client,null,valid.data,true);if(saved.error)fail(saved.error,{planningError:true});mealIds.push(saved.id);}
 return {mealIds};
}
export function copyPlanningPeriod(pool,input){
 return operation(pool,input.householdId,input.requestId,input,async client=>{
  const meals=await sourceMeals(client,input);if(!meals.length)fail('copy-source-empty');if(hash(meals)!==input.fingerprint)fail('copy-source-changed');
  return writeMeals(client,input.householdId,meals);
 });
}
export function addPlanningSelection(pool,input){
 const targets=input?.targets;if(!Array.isArray(targets)||targets.length<1||targets.length>63||!uuid(input?.requestId))return Promise.resolve({error:'invalid-planning-selection'});
 const normalized=[];for(const t of targets){const v=validatePlannedMeal({...input.meal,householdId:input.householdId,mealDate:t?.date,slot:t?.slot});if(v.error)return Promise.resolve({error:v.error});normalized.push({data:v.data});}
 if(new Set(targets.map(t=>t.date+':'+t.slot)).size!==targets.length)return Promise.resolve({error:'invalid-planning-selection'});
 return operation(pool,input.householdId,input.requestId,{meal:input.meal,targets},client=>writeMeals(client,input.householdId,normalized));
}

export function addPlanningDay(pool, input) {
 const {householdId, date, meals, requestId} = input ?? {};
 if (!uuid(householdId) || !validPlanningDate(date) || !Array.isArray(meals) ||
     !meals.length || meals.length > 4 || new Set(meals.map(meal => meal?.slot)).size !== meals.length ||
     meals.some(meal => !['breakfast', 'lunch', 'snack', 'dinner'].includes(meal?.slot))) {
  return Promise.resolve({error:'invalid-planning-day'});
 }
 const entries = meals.map(meal => ({data:{...meal, householdId, mealDate:date, isOccasion:false}}));
 return operation(pool, householdId, requestId, {date, meals}, client => writeMeals(client, householdId, entries));
}
