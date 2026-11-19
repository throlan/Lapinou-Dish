import {randomUUID,createHash} from 'node:crypto';
import {listPeople,addProfileHistory,addWeightEntry,addWeightGoal} from './people.mjs';
import {addNutritionTarget} from './nutrition-targets.mjs';
import {automaticNutrition} from '../../web/automatic-nutrition.js';
import {validDate,ACTIVITY_TYPES} from '../../web/activity-model.js';

export const parisToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function validateAutomaticProfile(input,today=parisToday()){
 if(!input||!validDate(input.effectiveFrom)||!['male','female'].includes(input.sex)||!['sedentary','light','moderate','active','very_active'].includes(input.activityLevel))return {error:'invalid-automatic-profile'};
 const displayName=String(input.displayName??'').trim();if(!displayName||displayName.length>80)return {error:'invalid-display-name'};
 const context={};
 for(const key of ['renal','hypoglycemia','pregnancy','cholesterol']){if(!['no','yes','unknown'].includes(input.context?.[key]))return {error:'invalid-medical-context'};context[key]=input.context[key];}
 if(!['none','type1','type2','unknown'].includes(input.context.diabetes)||!['none','sleeve','bypass','mini_bypass','other','unknown'].includes(input.context.surgery))return {error:'invalid-medical-context'};
 context.diabetes=input.context.diabetes;context.surgery=input.context.surgery;context.surgeryDate=input.context.surgeryDate||null;
 if(context.surgeryDate&&(!validDate(context.surgeryDate)||context.surgeryDate>today))return {error:'invalid-surgery-date'};
 const birthDate=input.birthDate||null;if(birthDate&&(!validDate(birthDate)||birthDate>today))return {error:'invalid-birth-date'};
 const data={displayName,effectiveFrom:input.effectiveFrom,birthDate,activityLevel:input.activityLevel,settings:{sex:input.sex,context}};
 for(const [name,min,max] of [['heightCm',50,260],['weightKg',.1,500],['comfortableWeightKg',.1,500],['interimTargetKg',.1,500]]){const value=input[name]==null||input[name]===''?null:Number(input[name]);if(value!=null&&(!Number.isFinite(value)||value<min||value>max))return {error:'invalid-'+name};data[name]=value;}
 data.measuredOn=input.measuredOn||today;if(data.weightKg!=null&&(!validDate(data.measuredOn)||data.measuredOn>today))return {error:'invalid-measured-on'};
 return {data};
}

export async function recalculateAutomatic(pool,personId,householdId,date=parisToday()){
 if(!(await pool.query('SELECT id FROM people WHERE id=$1 AND household_id=$2 FOR UPDATE',[personId,householdId])).rows.length)return null;
 const enabled=(await pool.query('SELECT settings,effective_from::text AS date FROM person_automatic_profiles WHERE person_id=$1 AND effective_from<=$2 ORDER BY effective_from DESC,revision_order DESC LIMIT 1',[personId,date])).rows[0];
 if(!enabled)return null;
 const [person]= (await listPeople(pool,householdId)).filter(row=>row.id===personId);if(!person)return null;
 const result=automaticNutrition({person,settings:enabled.settings,date});
 // Date alone does not create daily revisions. Applicable data and computed output do.
 const firstWeight=person.weightHistory.filter(row=>row.measuredOn<=date).at(-1)?.measuredOn;
 let period=null;
 if(firstWeight){const current=new Date(date+'T00:00:00Z'),first=new Date(firstWeight+'T00:00:00Z');const anniversary=Math.min(first.getUTCDate(),new Date(Date.UTC(current.getUTCFullYear(),current.getUTCMonth()+1,0)).getUTCDate());period=(current.getUTCFullYear()-first.getUTCFullYear())*12+current.getUTCMonth()-first.getUTCMonth()-(current.getUTCDate()<anniversary?1:0);}
 const fingerprint=createHash('sha256').update(JSON.stringify({settings:enabled.settings,result,period})).digest('hex');
 const state=(await pool.query('SELECT input_hash FROM person_automatic_state WHERE person_id=$1',[personId])).rows[0];
 if(state?.input_hash===fingerprint)return result;
 if(result.status==='calculated')await addNutritionTarget(pool,personId,householdId,{effectiveFrom:date,...result,origin:'estimate',method:`Automatique ${result.model} : ${result.maintenanceKcal} kcal de maintien ; objectif ${result.objective}. Détails et sources dans le calcul conservé.`,questionnaire:{automatic:true,model:result.model,settings:enabled.settings,calculation:result}});
 await pool.query('INSERT INTO person_automatic_state(person_id,input_hash,result) VALUES($1,$2,$3::jsonb) ON CONFLICT(person_id) DO UPDATE SET input_hash=excluded.input_hash,result=excluded.result,updated_at=now()',[personId,fingerprint,JSON.stringify(result)]);
 return result;
}

export async function refreshAutomaticHousehold(pool,householdId,date=parisToday()){
 const ids=(await pool.query('SELECT DISTINCT a.person_id FROM person_automatic_profiles a JOIN people p ON p.id=a.person_id WHERE p.household_id=$1 AND a.effective_from<=$2 ORDER BY a.person_id',[householdId,date])).rows;
 for(const row of ids){await pool.query('SELECT id FROM people WHERE id=$1 AND household_id=$2 FOR UPDATE',[row.person_id,householdId]);await recalculateAutomatic(pool,row.person_id,householdId,date);}
}

export async function saveAutomaticProfile(pool,personId,householdId,data){
 const client=await pool.connect();try{
  await client.query('BEGIN');
  const person=(await client.query('SELECT id FROM people WHERE id=$1 AND household_id=$2 FOR UPDATE',[personId,householdId])).rows[0];if(!person){await client.query('ROLLBACK');return null;}
  await client.query('UPDATE people SET birth_date=$3,display_name=$4 WHERE id=$1 AND household_id=$2',[personId,householdId,data.birthDate,data.displayName]);
  const existing=(await listPeople(client,householdId)).find(row=>row.id===personId),profile=existing.profileHistory.find(row=>row.effectiveFrom<=data.effectiveFrom);
  if(profile?.heightCm!==data.heightCm||profile?.activityLevel!==data.activityLevel)await addProfileHistory(client,personId,householdId,{effectiveFrom:data.effectiveFrom,heightCm:data.heightCm,activityLevel:data.activityLevel,dailyEnergyKcal:null,dailyEnergyOrigin:null,dailyEnergyMethod:null});
  if(data.weightKg!=null)await addWeightEntry(client,personId,householdId,{weightKg:data.weightKg,measuredOn:data.measuredOn});
  const goal=existing.weightGoalHistory.find(row=>row.effectiveFrom<=data.effectiveFrom);
  if(data.comfortableWeightKg!=null&&(goal?.comfortableWeightKg!==data.comfortableWeightKg||goal?.interimTargetKg!==data.interimTargetKg))await addWeightGoal(client,personId,householdId,{effectiveFrom:data.effectiveFrom,comfortableWeightKg:data.comfortableWeightKg,interimTargetKg:data.interimTargetKg});
  await client.query('INSERT INTO person_automatic_profiles(id,person_id,effective_from,settings) VALUES($1,$2,$3,$4::jsonb)',[randomUUID(),personId,data.effectiveFrom,JSON.stringify(data.settings)]);
  const result=await recalculateAutomatic(client,personId,householdId);await client.query('COMMIT');return {result};
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}

export function validateActivity(input,kind,today=parisToday()){
 if(kind==='activity-sessions'&&input?.action==='cancel')return uuid(input.sessionId)?{data:{action:'cancel',sessionId:input.sessionId}}:{error:'invalid-activity-session'};
 if(!uuid(input?.requestId)||!ACTIVITY_TYPES[input.activityType]||typeof input.additional!=='boolean')return {error:'invalid-activity'};
 if(kind==='activity-plans'){
  const minutes=Number(input.minutesPerSession),sessions=Number(input.sessionsPerWeek);
  if(!validDate(input.effectiveFrom)||!Number.isInteger(minutes)||minutes<1||minutes>180||!Number.isInteger(sessions)||sessions<1||sessions>7)return {error:'invalid-activity-plan'};
  return {data:{id:input.requestId,effectiveFrom:input.effectiveFrom,activityType:input.activityType,minutesPerSession:minutes,sessionsPerWeek:sessions,additional:input.additional}};
 }
 const minutes=Number(input.durationMinutes);
 if(!validDate(input.performedOn)||input.performedOn>today||!Number.isInteger(minutes)||minutes<1||minutes>600)return {error:'invalid-activity-session'};
 return {data:{id:input.requestId,performedOn:input.performedOn,activityType:input.activityType,durationMinutes:minutes,additional:input.additional}};
}

export async function saveActivity(pool,personId,householdId,kind,data){
 if(!(await pool.query('SELECT id FROM people WHERE id=$1 AND household_id=$2',[personId,householdId])).rows.length)return null;
 if(data.action==='cancel'){const r=await pool.query('UPDATE person_activity_sessions SET cancelled_at=coalesce(cancelled_at,now()) WHERE id=$1 AND person_id=$2 RETURNING id',[data.sessionId,personId]);return r.rows[0]??null;}
 const plan=kind==='activity-plans',table=plan?'person_activity_plans':'person_activity_sessions';
 const values=plan?[data.id,personId,data.effectiveFrom,data.activityType,data.minutesPerSession,data.sessionsPerWeek,data.additional]:[data.id,personId,data.performedOn,data.activityType,data.durationMinutes,data.additional];
 const columns=plan?'id,person_id,effective_from,activity_type,minutes_per_session,sessions_per_week,additional':'id,person_id,performed_on,activity_type,duration_minutes,additional';
 const r=await pool.query(`INSERT INTO ${table}(${columns}) VALUES(${values.map((_,i)=>'$'+(i+1)).join(',')}) ON CONFLICT(id) DO NOTHING RETURNING id`,values);
 if(r.rows[0])return r.rows[0];
 const existing=(await pool.query(`SELECT *,${plan?"effective_from":"performed_on"}::text AS date FROM ${table} WHERE id=$1 AND person_id=$2`,[data.id,personId])).rows[0];
 if(!existing)return null;
 const same=existing.activity_type===data.activityType&&existing.additional===data.additional&&(plan?existing.date===data.effectiveFrom&&existing.minutes_per_session===data.minutesPerSession&&existing.sessions_per_week===data.sessionsPerWeek:existing.date===data.performedOn&&existing.duration_minutes===data.durationMinutes);
 return same?{id:data.id}:{error:'activity-request-conflict'};
}

export async function readAutomaticActivity(pool,personId,householdId,date=parisToday()){
 const person=(await pool.query('SELECT id FROM people WHERE id=$1 AND household_id=$2 FOR UPDATE',[personId,householdId])).rows[0];if(!person)return null;
 const calculation=await recalculateAutomatic(pool,personId,householdId,date);
 const profile=(await pool.query('SELECT settings,effective_from::text AS date FROM person_automatic_profiles WHERE person_id=$1 AND effective_from<=$2 ORDER BY effective_from DESC,revision_order DESC LIMIT 1',[personId,date])).rows[0];
 const plans=(await pool.query('SELECT *,effective_from::text AS date FROM person_activity_plans WHERE person_id=$1 ORDER BY effective_from DESC,revision_order DESC',[personId])).rows.map(row=>({id:row.id,effectiveFrom:row.date,activityType:row.activity_type,minutesPerSession:row.minutes_per_session,sessionsPerWeek:row.sessions_per_week,additional:row.additional}));
 const sessions=(await pool.query('SELECT *,performed_on::text AS date FROM person_activity_sessions WHERE person_id=$1 ORDER BY performed_on DESC,created_at DESC',[personId])).rows.map(row=>({id:row.id,performedOn:row.date,activityType:row.activity_type,durationMinutes:row.duration_minutes,additional:row.additional,cancelledAt:row.cancelled_at}));
 return {settings:profile?.settings??null,calculation,plans,sessions};
}
