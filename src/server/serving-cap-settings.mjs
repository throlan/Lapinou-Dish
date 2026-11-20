import { SERVING_CAP_FIELDS, validCommonProteinPortion } from '../../web/meal-config.js';

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
  const result=await pool.query('SELECT serving_caps, common_protein_portion_g FROM households WHERE id=$1',[householdId]);
  if(!result.rows.length)return null;
  const caps=structuredClone(result.rows[0].serving_caps);
  const people=await pool.query('SELECT id,main_dish_cap_g FROM people WHERE household_id=$1 AND main_dish_cap_g IS NOT NULL',[householdId]);
  for(const person of people.rows)(caps[person.id]??={}).plateTotal=person.main_dish_cap_g;
  return {caps,commonProteinG:result.rows[0].common_protein_portion_g};
}

export async function saveServingCaps(pool,householdId,caps,commonProteinG){
  const validated=validateServingCaps(caps);
  if(validated.error)return validated;
  if(commonProteinG!==undefined&&!validCommonProteinPortion(commonProteinG))return {error:'invalid-serving-caps'};
  const ids=Object.keys(validated.data);
  const result=await pool.query(`UPDATE households SET serving_caps=$2::jsonb, common_protein_portion_g=COALESCE($4,common_protein_portion_g)
    WHERE id=$1 AND (SELECT count(*) FROM people WHERE household_id=$1 AND id=ANY($3::uuid[]))=cardinality($3::uuid[])
    RETURNING serving_caps`,[householdId,JSON.stringify(validated.data),ids,commonProteinG??null]);
  if(result.rows.length)return readServingCaps(pool,householdId);
  return {error:await readServingCaps(pool,householdId)?'invalid-serving-caps':'household-not-found'};
}


export function validatePersonServingCap(input){
 if(!input||!Object.hasOwn(input,'mainDishCapG'))return {error:'invalid-person-serving-cap'};
 const raw=input.mainDishCapG;
 if(raw===null||typeof raw==='string'&&raw.trim()==='')return {data:null};
 if(!['string','number'].includes(typeof raw))return {error:'invalid-person-serving-cap'};
 const value=Number(raw);
 return Number.isInteger(value)&&value>=1&&value<=5000?{data:value}:{error:'invalid-person-serving-cap'};
}
export async function savePersonServingCap(pool,personId,householdId,value){
 const result=await pool.query('UPDATE people SET main_dish_cap_g=$3 WHERE id=$1 AND household_id=$2 RETURNING main_dish_cap_g AS "mainDishCapG"',[personId,householdId,value]);
 return result.rows[0]??null;
}
