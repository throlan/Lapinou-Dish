import {randomUUID} from 'node:crypto';
import {availableRecipeStock,loadRecipeGraph,recipeFraction} from './recipe-ingredients.mjs';
import {loadStockBuckets,takeStock} from './stock-reservations.mjs';
import {lockHouseholdInventory} from './ingredient-stock.mjs';
export function stockLocalDate(now=new Date()){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const get=type=>parts.find(p=>p.type===type).value;return `${get('year')}-${get('month')}-${get('day')}`;
}
export async function mealStockReadiness(client,householdId){
 const [graph,physical]=await Promise.all([loadRecipeGraph(client,householdId),availableRecipeStock(client,householdId)]);
 const buckets=await loadStockBuckets(client,householdId,physical);
 const events=await client.query(`SELECT m.id AS meal_id,m.meal_date::text AS date,m.stock_auto_disabled,i.id AS item_id,i.recipe_id,
   sum(a.quantity) AS quantity,COALESCE(u.quantity,0) AS used,u.used_at
   FROM planned_meals m JOIN planned_meal_items i ON i.meal_id=m.id JOIN planned_amounts a ON a.planned_item_id=i.id
   LEFT JOIN (SELECT planned_item_id,sum(quantity) AS quantity,max(created_at) AS used_at FROM recipe_stock_uses
     WHERE household_id=$1 AND automatic AND cancelled_at IS NULL GROUP BY planned_item_id) u ON u.planned_item_id=i.id
   WHERE m.household_id=$1 AND m.prepared_at IS NULL AND NOT m.is_occasion
   GROUP BY m.id,m.meal_date,m.slot,m.created_at,m.stock_auto_disabled,i.id,i.recipe_id,i.sort_order,u.quantity,u.used_at
   ORDER BY m.meal_date,CASE m.slot WHEN 'breakfast' THEN 1 WHEN 'lunch' THEN 2 WHEN 'snack' THEN 3 WHEN 'dinner' THEN 4 ELSE 5 END,m.created_at,m.id,i.sort_order,i.id`,[householdId]);
 const meals=new Map(),ready=[];
 function reserve(id,quantity,date,path=[]){
  if(path.includes(id))throw new Error('recipe-ingredient-cycle');const recipe=graph.get(id);if(!recipe)throw new Error('recipe-ingredient-not-found');
  if(recipe.productionType!=='none')return takeStock(buckets,id,quantity,date);
  // A bagel in stock does not mean its untracked hamburger is already cooked.
  for(const line of recipe.lines.filter(l=>l.recipeId)){const child=graph.get(line.recipeId),fraction=recipeFraction(graph,line.recipeId,line.quantity*quantity/recipe.yield.amount,line.unitId);
   for(const part of child.separateStarch&&child.parts.length?child.parts:[child])reserve(part.id,fraction*part.yield.amount,date,[...path,id]);}
  return {quantity:0,allocations:[]};
 }
 for(const event of events.rows){
  const state=meals.get(event.meal_id)??{stockReady:true,readyItemIds:[],usedItemIds:[],stockUsedAt:null,autoStockDisabled:event.stock_auto_disabled};
  const quantity=Math.max(0,Number(event.quantity)-Number(event.used));
  if(!(quantity>1e-8)){state.usedItemIds.push(event.item_id);state.stockUsedAt=event.used_at;}
  else{
   const allocation=reserve(event.recipe_id,quantity,event.date);
   const complete=allocation.quantity+1e-8>=quantity&&!event.stock_auto_disabled;
   if(complete){state.readyItemIds.push(event.item_id);ready.push({...event,quantity,allocations:allocation.allocations});}
   else state.stockReady=false;
  }
  meals.set(event.meal_id,state);
 }
 return {meals,ready};
}
export async function settleHouseholdMealStock(pool,householdId,{now=new Date()}={}){
 const today=stockLocalDate(now),client=await pool.connect();
 try{
  await client.query('BEGIN');await lockHouseholdInventory(client,householdId);
  const settings=await client.query('SELECT auto_stock_start_date::text AS start FROM households WHERE id=$1',[householdId]);
  if(!settings.rowCount){await client.query('ROLLBACK');return {used:0};}
  // Start today on activation; never silently consume older menu history.
  const start=settings.rows[0].start??today;
  if(!settings.rows[0].start)await client.query('UPDATE households SET auto_stock_start_date=$2 WHERE id=$1',[householdId,today]);
  const {ready}=await mealStockReadiness(client,householdId);let used=0;
  for(const item of ready.filter(item=>item.date>=start&&item.date<today)){
   await client.query(`INSERT INTO recipe_stock_uses(id,household_id,recipe_id,quantity,meal_id,automatic,planned_item_id,source_allocations)
    VALUES($1,$2,$3,$4,$5,true,$6,$7::jsonb)`,[randomUUID(),householdId,item.recipe_id,item.quantity,item.meal_id,item.item_id,JSON.stringify(item.allocations)]);used++;
  }
  await client.query('COMMIT');return {used};
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
export function startMealStockClock(pool,{clock=()=>new Date(),onError=()=>{}}={}){
 let active=null,stopped=false;
 const tick=()=>{if(active||stopped)return active;active=(async()=>{
  const households=await pool.query('SELECT id FROM households');for(const row of households.rows)await settleHouseholdMealStock(pool,row.id,{now:clock()});
 })().catch(onError).finally(()=>{active=null;});return active;};
 void tick();const timer=setInterval(tick,60000);timer.unref?.();
 return async()=>{stopped=true;clearInterval(timer);await active;};
}
