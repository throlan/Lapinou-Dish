import { randomUUID } from 'node:crypto';

const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export function validateFoodYieldConversion(input){
  if(!input||!uuid(input.householdId)||!uuid(input.sourceFoodId)||!uuid(input.targetFoodId)||input.sourceFoodId===input.targetFoodId
    ||Object.hasOwn(input,'id')&&!uuid(input.id)||typeof input.factor!=='number'||!Number.isFinite(input.factor)||input.factor<=0||input.factor>10)return{error:'invalid-food-yield-conversion'};
  return{data:{id:uuid(input.id)?input.id:undefined,householdId:input.householdId,sourceFoodId:input.sourceFoodId,targetFoodId:input.targetFoodId,factor:input.factor}};
}

export async function listFoodYieldConversions(pool,householdId){
  const result=await pool.query(`SELECT c.id,c.household_id AS "householdId",c.source_food_id AS "sourceFoodId",s.canonical_name AS "sourceFoodName",
      c.target_food_id AS "targetFoodId",t.canonical_name AS "targetFoodName",c.factor
    FROM household_food_yield_conversions c JOIN foods s ON s.id=c.source_food_id JOIN foods t ON t.id=c.target_food_id
    WHERE c.household_id=$1 ORDER BY s.canonical_name`,[householdId]);
  return result.rows.map(row=>({...row,factor:Number(row.factor)}));
}

export async function saveFoodYieldConversion(pool,data){
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const household=await client.query('SELECT id FROM households WHERE id=$1',[data.householdId]);
    const foods=await client.query('SELECT id FROM foods WHERE id=ANY($1::uuid[])',[ [data.sourceFoodId,data.targetFoodId] ]);
    if(!household.rowCount){await client.query('ROLLBACK');return{error:'household-not-found'};}
    if(foods.rowCount!==2){await client.query('ROLLBACK');return{error:'food-not-found'};}
    const result=data.id
      ?await client.query(`UPDATE household_food_yield_conversions SET source_food_id=$3,target_food_id=$4,factor=$5,updated_at=now()
          WHERE household_id=$2 AND id=$1 RETURNING id`,[data.id,data.householdId,data.sourceFoodId,data.targetFoodId,data.factor])
      :await client.query(`INSERT INTO household_food_yield_conversions(id,household_id,source_food_id,target_food_id,factor)
          VALUES($1,$2,$3,$4,$5) ON CONFLICT(household_id,source_food_id) DO UPDATE SET target_food_id=$4,factor=$5,updated_at=now()
          RETURNING id`,[randomUUID(),data.householdId,data.sourceFoodId,data.targetFoodId,data.factor]);
    if(!result.rowCount){await client.query('ROLLBACK');return{error:'food-yield-not-found'};}
    await client.query('COMMIT');
    return(await listFoodYieldConversions(pool,data.householdId)).find(row=>row.id===result.rows[0].id)??{id};
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}

export async function deleteFoodYieldConversion(pool,householdId,id){
  const result=await pool.query('DELETE FROM household_food_yield_conversions WHERE household_id=$1 AND id=$2 RETURNING id',[householdId,id]);
  return Boolean(result.rowCount);
}
