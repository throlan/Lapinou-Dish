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
  const result=await pool.query(`WITH updated AS (
    UPDATE households SET protein_targets=$2::jsonb WHERE id=$1 RETURNING protein_targets
  ), saved AS (
    INSERT INTO person_nutrition_goals(id,person_id,effective_from,daily_energy_kcal,daily_protein_g,origin,method,reference_weight_kg)
    SELECT md5(random()::text||p.id::text||clock_timestamp()::text)::uuid,p.id,CURRENT_DATE,energy.daily_energy_kcal,
      (entry.value #>> '{}')::numeric,'manual','Minimum protéique confirmé dans Administration',
      (SELECT weight_kg FROM person_weight_entries WHERE person_id=p.id AND measured_on<=CURRENT_DATE ORDER BY measured_on DESC LIMIT 1)
    FROM updated,jsonb_each(updated.protein_targets) entry JOIN people p ON p.id=entry.key::uuid
    JOIN LATERAL (SELECT daily_energy_kcal FROM effective_energy_history WHERE person_id=p.id AND effective_from<=CURRENT_DATE ORDER BY effective_from DESC,priority DESC,revision_order DESC LIMIT 1) energy ON true
    WHERE p.household_id=$1 AND energy.daily_energy_kcal IS NOT NULL
  ) SELECT protein_targets FROM updated`,[householdId,JSON.stringify(validation.data)]);
  return result.rows.length?{targets:result.rows[0].protein_targets}:{error:'household-not-found'};
}
