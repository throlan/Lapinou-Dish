import {ageAtDate} from './profile-dates.js';

export const ACTIVITY_TYPES=Object.freeze({
 walk_slow:{label:'Marche tranquille · environ 3–4 km/h',met:2.8,code:'17152'},
 walk:{label:'Marche · environ 4 km/h',met:3,code:'17170'},
 walk_moderate:{label:'Marche soutenue · environ 4,5–5,5 km/h',met:3.8,code:'17190'},
});
export const ACTIVITY_SOURCE='https://pacompendium.com/walking/';
export const WEIGHT_MODEL_SOURCE='https://www.niddk.nih.gov/-/media/Files/Labs-Branches-Sections/laboratory-biological-modeling/integrative-physiology-section/Hall-Lancet-Web-Appendix_508.pdf';
export const ACTIVITY_GUIDANCE='https://www.who.int/publications/i/item/9789240015128/';
export function validDate(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;}
export const datePlusDays=(date,days)=>new Date(Date.parse(date+'T00:00:00Z')+days*86400000).toISOString().slice(0,10);

// Net expenditure above resting time, only for activity explicitly declared additional.
export function addedActivityKcal(weightKg,activityType,minutes,sessionsPerWeek=7,additional=true){
 if(!additional)return 0;
 const activity=ACTIVITY_TYPES[activityType];
 if(!activity||!(weightKg>0)||!Number.isFinite(minutes)||minutes<0||!Number.isFinite(sessionsPerWeek)||sessionsPerWeek<0||sessionsPerWeek>7)return null;
 return (activity.met-1)*3.5*weightKg/200*minutes*sessionsPerWeek/7;
}

export function activitySummary(sessions,date){
 const startsOn=datePlusDays(date,-6),rows=sessions.filter(row=>!row.cancelledAt&&row.performedOn>=startsOn&&row.performedOn<=date);
 return {startsOn,endsOn:date,sessions:rows.length,minutes:rows.reduce((sum,row)=>sum+Number(row.durationMinutes),0),additionalMinutes:rows.filter(row=>row.additional).reduce((sum,row)=>sum+Number(row.durationMinutes),0)};
}

// Reduced two-compartment Hall model: appendix equations 3–9 with dG/dt=0;
// extracellular/glycogen water is omitted. kJ, kg, days. This is not full BWP.
export function modelParameters({weightKg,heightCm,age,sex,pal,maintenanceKcal}){
 const fatPercent=.14*age+(sex==='male'?37.31:39.96)*Math.log(weightKg/(heightCm/100)**2)-(sex==='male'?103.94:102.01);
 if(!(fatPercent>3&&fatPercent<65))return null;
 const fat=weightKg*fatPercent/100,lean=weightKg-fat;
 const rmr=10*weightKg+6.25*heightCm-5*age+(sex==='male'?5:-161);
 const delta=((1-.1)*pal-1)*rmr*4.184/weightKg;
 return {fat,lean,delta,k:maintenanceKcal*4.184-13*fat-92*lean-delta*weightKg,fatPercent};
}

export function projectWeight(input){
 const {startDate,birthDate,weightKg,heightCm,sex,pal,intakeKcal,maintenanceKcal,plan=null}=input;
 const age=ageAtDate(birthDate,startDate);
 if(!validDate(startDate)||age==null||age<19||age>59)return {error:'Projection générale réservée aux adultes de 19 à 59 ans ; le journal reste disponible.'};
 if(!Number.isFinite(weightKg)||weightKg<=0||weightKg>500||!Number.isFinite(heightCm)||heightCm<140||heightCm>230||!['male','female'].includes(sex)||![1.4,1.6,1.8,2].includes(pal)||!Number.isFinite(intakeKcal)||intakeKcal<=1200||intakeKcal>10000||!Number.isFinite(maintenanceKcal)||maintenanceKcal<=0||weightKg/(heightCm/100)**2<18.5)return {error:'Paramètres manquants ou hors du domaine de cette projection générale (dont cible >1 200 kcal/j).'};
 const parameters=modelParameters({weightKg,heightCm,age,sex,pal,maintenanceKcal});
 if(!parameters)return {error:'Composition corporelle estimée hors du domaine du modèle.'};
 if(plan&&(!ACTIVITY_TYPES[plan.activityType]||!Number.isInteger(plan.minutesPerSession)||plan.minutesPerSession<1||plan.minutesPerSession>180||!Number.isInteger(plan.sessionsPerWeek)||plan.sessionsPerWeek<1||plan.sessionsPerWeek>7||typeof plan.additional!=='boolean'))return {error:'Disponibilités ou activité invalides.'};
 const extra=plan?addedActivityKcal(1,plan.activityType,plan.minutesPerSession,plan.sessionsPerWeek,plan.additional)*4.184:0;
 const deltaEI=(intakeKcal-maintenanceKcal)*4.184,ei=intakeKcal*4.184;
 const derivative=state=>{
  const [f,l,at]=state,w=f+l,p=(10.4*7600/39500)/(10.4*7600/39500+f);
  const efficiency=p*960/7600+(1-p)*750/39500;
  const ee=(parameters.k+13*f+92*l+(parameters.delta+extra)*w+.1*deltaEI+at+ei*efficiency)/(1+efficiency);
  return [(1-p)*(ei-ee)/39500,p*(ei-ee)/7600,(.14*deltaEI-at)/14];
 };
 const step=(state,h)=>{
  const a=derivative(state),b=derivative(state.map((v,i)=>v+h*a[i]/2)),c=derivative(state.map((v,i)=>v+h*b[i]/2)),d=derivative(state.map((v,i)=>v+h*c[i]));
  return state.map((v,i)=>v+h*(a[i]+2*b[i]+2*c[i]+d[i])/6);
 };
 const horizon=input.horizonDays??1095;
 if(!Number.isInteger(horizon)||horizon<1||horizon>1095)return {error:'La projection est limitée à trois ans.'};
 const targets=Object.fromEntries(Object.entries(input.targets??{}).filter(([,v])=>Number.isFinite(v)&&v>0));
 const reached=Object.fromEntries(Object.entries(targets).map(([key,v])=>[key,Math.abs(v-weightKg)<.001?startDate:null]));
 let state=[parameters.fat,parameters.lean,0],stopReason=null;
 const points=[{date:startDate,weightKg}],daily=[];
 for(let day=1;day<=horizon;day++){
  for(let part=0;part<4;part++)state=step(state,.25);
  const w=state[0]+state[1],date=datePlusDays(startDate,day);
  if(!state.every(Number.isFinite)||state[0]<=0||state[1]<=0||w/(heightCm/100)**2<18.5){stopReason='Limite du domaine du modèle atteinte.';break;}
  daily.push({date,weightKg:w});
  for(const [key,target] of Object.entries(targets))if(!reached[key]&&(target<weightKg?w<=target:w>=target))reached[key]=date;
 }
 let previous=weightKg;
 for(let month=1;month<=36;month++){
  const base=new Date(startDate+'T00:00:00Z'),monthStart=new Date(Date.UTC(base.getUTCFullYear(),base.getUTCMonth()+month,1));
  const year=monthStart.getUTCFullYear(),m=monthStart.getUTCMonth(),day=Math.min(base.getUTCDate(),new Date(Date.UTC(year,m+1,0)).getUTCDate());
  const date=new Date(Date.UTC(year,m,day)).toISOString().slice(0,10),point=daily.find(row=>row.date===date);
  if(!point)break;
  points.push({...point,changeKg:point.weightKg-previous});previous=point.weightKg;
 }
 return {model:'hall-reduced-two-compartment-v1',parameters,points,reached,stopReason,additionalKcalPerDay:extra*weightKg/4.184,finalWeightKg:daily.at(-1)?.weightKg??weightKg,days:daily.length};
}
