import {randomUUID} from 'node:crypto';

export function validateNutritionTarget(input) {
  if(!input || !/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveFrom??'') || !Number.isFinite(Date.parse(input.effectiveFrom+'T00:00:00Z')) || new Date(input.effectiveFrom+'T00:00:00Z').toISOString().slice(0,10)!==input.effectiveFrom)return {error:'invalid-effective-date'};
  const energy=Number(input.dailyEnergyKcal),protein=input.dailyProteinG==null||input.dailyProteinG===''?null:Number(input.dailyProteinG);
  if(!Number.isInteger(energy)||energy<500||energy>10000)return {error:'invalid-daily-energy'};
  if(protein!=null&&(!Number.isFinite(protein)||protein<0||protein>500))return {error:'invalid-protein-target'};
  if(!['manual','clinician','estimate'].includes(input.origin))return {error:'invalid-target-origin'};
  if(input.confirmed!==true)return {error:'target-confirmation-required'};
  const method=String(input.method??'').trim();
  if(method.length>1000 || input.origin==='estimate'&&!method)return {error:'target-method-required'};
  return {data:{effectiveFrom:input.effectiveFrom,dailyEnergyKcal:energy,dailyProteinG:protein,origin:input.origin,method}};
}

export async function addNutritionTarget(pool,personId,householdId,data) {
  const id=randomUUID();
  const result=await pool.query(`INSERT INTO person_nutrition_goals(id,person_id,effective_from,daily_energy_kcal,daily_protein_g,origin,method,reference_weight_kg)
    SELECT $1,p.id,$3,$4,$5,$6,$7,(SELECT weight_kg FROM person_weight_entries WHERE person_id=p.id AND measured_on<=$3 ORDER BY measured_on DESC LIMIT 1)
    FROM people p WHERE p.id=$2 AND p.household_id=$8 RETURNING id`,[id,personId,data.effectiveFrom,data.dailyEnergyKcal,data.dailyProteinG,data.origin,data.method,householdId]);
  return result.rows[0]??null;
}
