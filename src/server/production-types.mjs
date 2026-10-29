export const BUILT_IN_PRODUCTION_TYPES = [
  {id:'batch_cooking',label:'Batch cooking',minimumAmount:0,minimumUnitId:'portion'},
  {id:'pasta',label:'Pâtes',minimumAmount:0,minimumUnitId:'portion'},
  {id:'pastry',label:'Pâtisserie',minimumAmount:0,minimumUnitId:'portion'},
  {id:'bread',label:'Pain',minimumAmount:0,minimumUnitId:'portion'},
];
export function validateProductionTypes(input){
  if(!Array.isArray(input)||input.length<BUILT_IN_PRODUCTION_TYPES.length||input.length>24)return {error:'invalid-production-types'};
  const ids=new Set(),types=[];
  for(const item of input){
    if(!item||typeof item!=='object'||typeof item.id!=='string'||!(/^(batch_cooking|pasta|pastry|bread|custom-[a-z0-9_-]{1,33})$/).test(item.id)
      ||ids.has(item.id)||typeof item.label!=='string'||!item.label.trim()||item.label.trim().length>60)return {error:'invalid-production-type'};
    ids.add(item.id);types.push({id:item.id,label:item.label.trim(),minimumAmount:0,minimumUnitId:'portion'});
  }
  if(BUILT_IN_PRODUCTION_TYPES.some(item=>!ids.has(item.id)))return {error:'missing-built-in-production-type'};
  return {data:types};
}

export async function readProductionTypes(pool,householdId){
  const result=await pool.query('SELECT production_types FROM households WHERE id=$1',[householdId]);
  if(!result.rowCount)return null;
  const saved=Array.isArray(result.rows[0].production_types)?result.rows[0].production_types:[];
  const byId=new Map(saved.map(item=>[item.id,item]));
  return {productionTypes:[...BUILT_IN_PRODUCTION_TYPES.map(item=>({...item,...byId.get(item.id)})),...saved.filter(item=>item.id.startsWith('custom-'))]};
}

export async function saveProductionTypes(pool,householdId,input){
  const checked=validateProductionTypes(input);if(checked.error)return checked;
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const household=await client.query('SELECT production_types FROM households WHERE id=$1 FOR UPDATE',[householdId]);
    if(!household.rowCount){await client.query('ROLLBACK');return {error:'household-not-found'};}
    const before=Array.isArray(household.rows[0].production_types)?household.rows[0].production_types:[];
    const after=new Set(checked.data.map(item=>item.id));
    const removed=before.filter(item=>item.id.startsWith('custom-')&&!after.has(item.id));
    for(const item of removed){
      const used=await client.query('SELECT count(*) AS count FROM recipes WHERE household_id=$1 AND production_type=$2',[householdId,item.id]);
      if(Number(used.rows[0].count)>0){await client.query('ROLLBACK');return {error:'production-type-in-use',label:item.label,recipeCount:Number(used.rows[0].count)};}
    }
    await client.query('UPDATE households SET production_types=$2::jsonb WHERE id=$1',[householdId,JSON.stringify(checked.data)]);
    await client.query('COMMIT');return {productionTypes:checked.data};
  }catch(error){await client.query('ROLLBACK');throw error;}
  finally{client.release();}
}
