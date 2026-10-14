const isUuid=value=>typeof value==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export function validateFoodStores(input) {
  if(!input || typeof input!=='object' || !isUuid(input.householdId)
    || !Array.isArray(input.foodIds) || !input.foodIds.length || input.foodIds.length>200 || !input.foodIds.every(isUuid)
    || (input.orderLinkId!==null && !isUuid(input.orderLinkId)))return {error:'invalid-food-stores'};
  return {data:{householdId:input.householdId,foodIds:[...new Set(input.foodIds.map(id=>id.toLowerCase()))],orderLinkId:input.orderLinkId?.toLowerCase()??null}};
}

export async function listFoodStores(pool,householdId) {
  const result=await pool.query(`SELECT s.food_id AS "foodId",f.canonical_name AS name,
    l.id AS "orderLinkId",l.label,l.url FROM household_food_stores s
    JOIN foods f ON f.id=s.food_id
    JOIN household_order_links l ON l.id=s.order_link_id AND l.household_id=s.household_id
    WHERE s.household_id=$1 ORDER BY l.label,f.canonical_name,s.food_id`,[householdId]);
  return result.rows;
}

export async function saveFoodStores(pool,input) {
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const household=await client.query('SELECT id FROM households WHERE id=$1 FOR KEY SHARE',[input.householdId]);
    if(!household.rowCount){await client.query('ROLLBACK');return {error:'household-not-found'};}
    if(input.orderLinkId) {
      const link=await client.query('SELECT id FROM household_order_links WHERE household_id=$1 AND id=$2 FOR KEY SHARE',[input.householdId,input.orderLinkId]);
      if(!link.rowCount){await client.query('ROLLBACK');return {error:'order-link-not-found'};}
    }
    const foods=await client.query('SELECT id FROM foods WHERE id=ANY($1::uuid[]) FOR KEY SHARE',[input.foodIds]);
    if(foods.rowCount!==input.foodIds.length){await client.query('ROLLBACK');return {error:'food-not-found'};}
    if(input.orderLinkId)await client.query(`INSERT INTO household_food_stores(household_id,food_id,order_link_id)
      SELECT $1,id,$3 FROM unnest($2::uuid[]) AS t(id)
      ON CONFLICT(household_id,food_id) DO UPDATE SET order_link_id=EXCLUDED.order_link_id,updated_at=now()`,[input.householdId,input.foodIds,input.orderLinkId]);
    else await client.query('DELETE FROM household_food_stores WHERE household_id=$1 AND food_id=ANY($2::uuid[])',[input.householdId,input.foodIds]);
    await client.query('COMMIT');
    return {updated:input.foodIds.length};
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
