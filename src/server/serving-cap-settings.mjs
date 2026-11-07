import { SERVING_CAP_FIELDS } from '../../web/meal-config.js';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const record=value=>value!=null&&typeof value==='object'&&!Array.isArray(value);

export function validateServingCaps(caps){
  if(!record(caps))return {error:'invalid-serving-caps'};
  const normalized={};
  for(const [id,values] of Object.entries(caps)){
    if(!uuid.test(id)||!record(values)||Object.hasOwn(normalized,id.toLowerCase()))return {error:'invalid-serving-caps'};
    const person={};
    for(const [key,value] of Object.entries(values)){
      if(!Object.hasOwn(SERVING_CAP_FIELDS,key)||!Number.isInteger(value)||value<1||value>SERVING_CAP_FIELDS[key].max)return {error:'invalid-serving-caps'};
      person[key]=value;
    }
    normalized[id.toLowerCase()]=person;
  }
  return {data:Object.fromEntries(Object.entries(normalized).filter(([,person])=>Object.keys(person).length))};
}

export async function readServingCaps(pool,householdId){
  const result=await pool.query('SELECT serving_caps FROM households WHERE id=$1',[householdId]);
  return result.rows.length?{caps:result.rows[0].serving_caps}:null;
}

export async function saveServingCaps(pool,householdId,caps){
  const validated=validateServingCaps(caps);
  if(validated.error)return validated;
  const ids=Object.keys(validated.data);
  const result=await pool.query(`UPDATE households SET serving_caps=$2::jsonb
    WHERE id=$1 AND (SELECT count(*) FROM people WHERE household_id=$1 AND id=ANY($3::uuid[]))=cardinality($3::uuid[])
    RETURNING serving_caps`,[householdId,JSON.stringify(validated.data),ids]);
  if(result.rows.length)return {caps:result.rows[0].serving_caps};
  return {error:await readServingCaps(pool,householdId)?'invalid-serving-caps':'household-not-found'};
}

