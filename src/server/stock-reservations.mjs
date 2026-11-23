// Physical stock is shared by planning and readiness. Scoped lots cover their
// own menu dates first; a surplus becomes available after that range ends.
export async function loadStockBuckets(client,householdId,physicalStock,identity){
 const lots=await client.query(`SELECT s.id,s.recipe_id,s.quantity,
   GREATEST(s.produced_on,COALESCE(target.meal_date,s.planned_start,p.planned_start))::text AS start,
   COALESCE(target.meal_date,s.planned_end,p.planned_end)::text AS "end",COALESCE(s.planned_meal_id,p.planned_meal_id) AS meal_id FROM stock_lots s LEFT JOIN stock_lots p ON p.id=s.parent_lot_id LEFT JOIN planned_meals target ON target.id=COALESCE(s.planned_meal_id,p.planned_meal_id)
   WHERE s.household_id=$1 AND s.cancelled_at IS NULL AND NOT s.is_serving_bundle ORDER BY s.produced_on,s.created_at,s.id`,[householdId]);
 const uses=await client.query('SELECT source_allocations FROM recipe_stock_uses WHERE household_id=$1 AND automatic AND cancelled_at IS NULL',[householdId]);
 const used=new Map();for(const row of uses.rows)for(const item of row.source_allocations??[])if(item.lotId)used.set(item.lotId,(used.get(item.lotId)??0)+Number(item.quantity));
 const buckets=new Map();
 for(const lot of lots.rows){
  const key=identity.key(lot.recipe_id);
  if(!buckets.has(key))buckets.set(key,[]);
  buckets.get(key).push({lotId:lot.id,quantity:Math.max(0,Number(lot.quantity)-(used.get(lot.id)??0)),start:lot.start,end:lot.end,mealId:lot.meal_id});
 }
 // Reconcile legacy uses and physical inventory corrections without changing
 // original lots. New automatic uses have exact source allocations above.
 for(const [id,physical] of physicalStock){
  const entries=buckets.get(id)??[];let difference=Math.max(0,physical)-entries.reduce((s,b)=>s+b.quantity,0);
  if(difference>1e-8)entries.push({lotId:null,quantity:difference,start:null,end:null});
  else for(const entry of entries){const remove=Math.min(entry.quantity,-difference);entry.quantity-=remove;difference+=remove;if(difference>=-1e-8)break;}
  buckets.set(id,entries);
 }
 return buckets;
}
export function takeStock(buckets,recipeId,quantity,date,mealId=null){
 let remaining=quantity;const allocations=[];
 const entries=(buckets.get(recipeId)??[]).filter(b=>(!b.start||date>=b.start)&&(!b.mealId||b.mealId===mealId||date>b.end));
 // Preserve explicitly dated lots for their dates before using general stock.
 const priority=b=>b.mealId&&b.mealId===mealId?-1:b.start&&date<=b.end?0:b.virtual?2:1;
 for(const entry of entries.sort((a,b)=>priority(a)-priority(b))){
  const take=Math.min(Math.max(0,entry.quantity),remaining);if(!(take>0))continue;
  entry.quantity-=take;remaining-=take;allocations.push({lotId:entry.lotId,quantity:take});if(remaining<=1e-8)break;
 }
 return {quantity:quantity-remaining,allocations};
}
export function addPlannedStock(buckets,recipeId,quantity,date){
 if(!(quantity>0))return;if(!buckets.has(recipeId))buckets.set(recipeId,[]);
 buckets.get(recipeId).push({lotId:null,quantity,start:date,end:null,virtual:true});
}
