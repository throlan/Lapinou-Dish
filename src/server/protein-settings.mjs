const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateProteinTargets(targets) {
  if(!targets || typeof targets!=='object' || Array.isArray(targets))return {error:'invalid-protein-targets'};
  for(const [personId,value] of Object.entries(targets)) {
    if(!uuidPattern.test(personId) || (value!==null && (typeof value!=='number' || !Number.isFinite(value) || value<0 || value>500)))return {error:'invalid-protein-targets'};
  }
  return {data:targets};
}

export async function readProteinSettings(pool,householdId) {
  const result=await pool.query('SELECT protein_targets FROM households WHERE id=$1',[householdId]);
  return result.rows.length?{targets:result.rows[0].protein_targets}:null;
}

export async function saveProteinSettings(pool,householdId,targets) {
  const validation=validateProteinTargets(targets);
  if(validation.error)return validation;
  const personIds=Object.keys(validation.data);
  if(personIds.length) {
    const people=await pool.query('SELECT id::text FROM people WHERE household_id=$1 AND id=ANY($2::uuid[])',[householdId,personIds]);
    if(people.rows.length!==personIds.length)return {error:'invalid-protein-targets'};
  }
  const result=await pool.query('UPDATE households SET protein_targets=$2::jsonb WHERE id=$1 RETURNING protein_targets',[householdId,JSON.stringify(validation.data)]);
  return result.rows.length?{targets:result.rows[0].protein_targets}:{error:'household-not-found'};
}
