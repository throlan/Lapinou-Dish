const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateCatalogueReviewExclusions(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||!Array.isArray(value.categories)||!Array.isArray(value.foodIds)
    ||value.categories.length>100||value.foodIds.length>2000)return {error:'invalid-catalogue-exclusions'};
  const categories=value.categories.map(item=>typeof item==='string'?item.trim():'');
  const foodIds=value.foodIds.map(item=>typeof item==='string'?item.toLowerCase():'');
  if(categories.some(item=>!item||item.length>80)||foodIds.some(item=>!uuid.test(item))
    ||new Set(categories).size!==categories.length||new Set(foodIds).size!==foodIds.length)return {error:'invalid-catalogue-exclusions'};
  return {data:{categories,foodIds}};
}

export async function readCatalogueReviewExclusions(pool,householdId){
  const result=await pool.query('SELECT catalogue_review_exclusions FROM households WHERE id=$1',[householdId]);
  return result.rows.length?{exclusions:result.rows[0].catalogue_review_exclusions}:null;
}

export async function saveCatalogueReviewExclusions(pool,householdId,value){
  const validated=validateCatalogueReviewExclusions(value);
  if(validated.error)return validated;
  const result=await pool.query('UPDATE households SET catalogue_review_exclusions=$2::jsonb WHERE id=$1 RETURNING catalogue_review_exclusions',[householdId,JSON.stringify(validated.data)]);
  return result.rows.length?{exclusions:result.rows[0].catalogue_review_exclusions}:{error:'household-not-found'};
}
