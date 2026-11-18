import {randomUUID} from 'node:crypto';
import {proposeNutritionPlan} from '../../web/nutrition-recommendations.js';

export function validateNutritionTarget(input) {
  if(!input || !/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveFrom??'') || !Number.isFinite(Date.parse(input.effectiveFrom+'T00:00:00Z')) || new Date(input.effectiveFrom+'T00:00:00Z').toISOString().slice(0,10)!==input.effectiveFrom)return {error:'invalid-effective-date'};
  const energy=Number(input.dailyEnergyKcal),protein=input.dailyProteinG==null||input.dailyProteinG===''?null:Number(input.dailyProteinG);
  if(!Number.isInteger(energy)||energy<500||energy>10000)return {error:'invalid-daily-energy'};
  if(protein!=null&&(!Number.isFinite(protein)||protein<0||protein>500))return {error:'invalid-protein-target'};
  if(!['manual','clinician','estimate'].includes(input.origin))return {error:'invalid-target-origin'};
  if(input.confirmed!==true)return {error:'target-confirmation-required'};
  const method=String(input.method??'').trim();
  if(method.length>1000 || input.origin==='estimate'&&!method)return {error:'target-method-required'};
  const macros={};
  for(const [name,max] of [['dailyFatG',1000],['dailyCarbohydrateG',2000],['dailyFibreG',150]]){
    const value=input[name]==null||input[name]===''?null:Number(input[name]);
    if(value!=null&&(!Number.isFinite(value)||value<0||value>max))return {error:'invalid-macronutrient-target'};
    macros[name]=value;
  }
  let questionnaire=null;
  if(input.questionnaire!=null){
    if(typeof input.questionnaire!=='object'||Array.isArray(input.questionnaire)||JSON.stringify(input.questionnaire).length>12000)return {error:'invalid-nutrition-questionnaire'};
    const proposal=proposeNutritionPlan(input.questionnaire);
    if(proposal.error||proposal.conflicts.length)return {error:'nutrition-conflicts-require-review'};
    if(input.origin==='estimate'&&(proposal.dailyEnergyKcal!==energy||proposal.dailyProteinG!==protein||Object.entries(macros).some(([name,value])=>proposal[name]!==value)))return {error:'nutrition-proposal-changed'};
    questionnaire=input.questionnaire;
  }
  return {data:{effectiveFrom:input.effectiveFrom,dailyEnergyKcal:energy,dailyProteinG:protein,origin:input.origin,method,...macros,questionnaire}};
}

export async function addNutritionTarget(pool,personId,householdId,data) {
  const id=randomUUID();
  const result=await pool.query(`INSERT INTO person_nutrition_goals(id,person_id,effective_from,daily_energy_kcal,daily_protein_g,origin,method,reference_weight_kg,daily_fat_g,daily_carbohydrate_g,daily_fibre_g,questionnaire)
    SELECT $1,p.id,$3,$4,$5,$6,$7,(SELECT weight_kg FROM person_weight_entries WHERE person_id=p.id AND measured_on<=$3 ORDER BY measured_on DESC LIMIT 1),$9,$10,$11,$12::jsonb
    FROM people p WHERE p.id=$2 AND p.household_id=$8 RETURNING id`,[id,personId,data.effectiveFrom,data.dailyEnergyKcal,data.dailyProteinG,data.origin,data.method,householdId,data.dailyFatG??null,data.dailyCarbohydrateG??null,data.dailyFibreG??null,data.questionnaire?JSON.stringify(data.questionnaire):null]);
  return result.rows[0]??null;
}
