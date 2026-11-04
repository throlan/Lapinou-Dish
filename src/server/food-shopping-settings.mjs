const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const groups=new Set(['bulk','fresh','whey_flour','other']);
const units=new Set(['g','kg','ml','l','piece','tsp','tbsp','cup','pinch','scoop']);

export function validateFoodShoppingSettings(input){
  if(!input||!uuid(input.householdId)||!uuid(input.foodId)||!groups.has(input.groupId)
    ||!units.has(input.unitId)||(input.orderLinkId!==null&&!uuid(input.orderLinkId))
    ||(input.packageQuantity!==null&&(!Number.isFinite(input.packageQuantity)||input.packageQuantity<=0||input.packageQuantity>100000000)))
    return {error:'invalid-food-shopping-settings'};
  return {data:input};
}

export async function readFoodShoppingSettings(pool,householdId,foodId){
  const [groupsResult,packs,store,links]=await Promise.all([
    pool.query('SELECT unit_id AS "unitId",group_id AS "groupId" FROM household_food_shopping_groups WHERE household_id=$1 AND food_id=$2 ORDER BY unit_id',[householdId,foodId]),
    pool.query('SELECT unit_id AS "unitId",package_quantity::float8 AS "packageQuantity" FROM household_food_purchase_packs WHERE household_id=$1 AND food_id=$2 ORDER BY unit_id',[householdId,foodId]),
    pool.query('SELECT order_link_id AS "orderLinkId" FROM household_food_stores WHERE household_id=$1 AND food_id=$2',[householdId,foodId]),
    pool.query('SELECT id,label FROM household_order_links WHERE household_id=$1 ORDER BY label,id',[householdId]),
  ]);
  return {groups:groupsResult.rows,packs:packs.rows,orderLinkId:store.rows[0]?.orderLinkId??null,links:links.rows};
}

export async function saveFoodShoppingSettings(pool,input){
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const food=await client.query('SELECT id FROM foods WHERE id=$1 FOR KEY SHARE',[input.foodId]);
    if(!food.rowCount){await client.query('ROLLBACK');return {error:'food-not-found'};}
    if(input.orderLinkId){const link=await client.query('SELECT id FROM household_order_links WHERE id=$1 AND household_id=$2 FOR KEY SHARE',[input.orderLinkId,input.householdId]);
      if(!link.rowCount){await client.query('ROLLBACK');return {error:'order-link-not-found'};}}
    await client.query(`INSERT INTO household_food_shopping_groups(household_id,food_id,unit_id,group_id)
      VALUES($1,$2,$3,$4) ON CONFLICT(household_id,food_id,unit_id) DO UPDATE SET group_id=EXCLUDED.group_id,updated_at=now()`,
    [input.householdId,input.foodId,input.unitId,input.groupId]);
    if(input.packageQuantity===null)await client.query('DELETE FROM household_food_purchase_packs WHERE household_id=$1 AND food_id=$2 AND unit_id=$3',[input.householdId,input.foodId,input.unitId]);
    else await client.query(`INSERT INTO household_food_purchase_packs(household_id,food_id,unit_id,package_quantity)
      VALUES($1,$2,$3,$4) ON CONFLICT(household_id,food_id,unit_id) DO UPDATE SET package_quantity=EXCLUDED.package_quantity,updated_at=now()`,
    [input.householdId,input.foodId,input.unitId,input.packageQuantity]);
    if(input.orderLinkId)await client.query(`INSERT INTO household_food_stores(household_id,food_id,order_link_id)
      VALUES($1,$2,$3) ON CONFLICT(household_id,food_id) DO UPDATE SET order_link_id=EXCLUDED.order_link_id,updated_at=now()`,
    [input.householdId,input.foodId,input.orderLinkId]);
    else await client.query('DELETE FROM household_food_stores WHERE household_id=$1 AND food_id=$2',[input.householdId,input.foodId]);
    await client.query('COMMIT');return {saved:true};
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
