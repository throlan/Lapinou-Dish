import {renderAutomaticProfile} from './automatic-profile-ui.js';
import {effectiveDatedEntry,ageAtDate} from './profile-dates.js';

export function estimateDailyEnergy({birthDate,date,weightKg,heightCm,sex,pal}) {
 const age=ageAtDate(birthDate,date);
 if(age==null||age<18||age>78)return {error:'Estimation réservée aux adultes de 18 à 78 ans ; utilise une cible personnalisée.'};
 if(!['male','female'].includes(sex)||![1.4,1.6,1.8,2].includes(Number(pal))||!(weightKg>0&&weightKg<=500)||!(heightCm>=50&&heightCm<=260))return {error:'Renseigne les paramètres de calcul, le poids, la taille et l’activité.'};
 const resting=10*Number(weightKg)+6.25*Number(heightCm)-5*age+(sex==='male'?5:-161);
 return {restingKcal:Math.round(resting),maintenanceKcal:Math.round(resting*Number(pal)),age,weightKg:Number(weightKg),heightCm:Number(heightCm),sex,pal:Number(pal),date,method:'Mifflin–St Jeor (1990), forme simplifiée ; repos × PAL choisi. https://pubmed.ncbi.nlm.nih.gov/2305711/ ; repères PAL EFSA 2013 : https://www.efsa.europa.eu/sites/default/files/assets/DRV_Summary_tables_jan_17.pdf'};
}

export function effectiveNutritionProfile(person,date) {
 const profile=effectiveDatedEntry(person?.profileHistory,date);
 const legacyEnergy=effectiveDatedEntry((person?.profileHistory??[]).filter(entry=>entry.dailyEnergyKcal!=null),date);
 const goal=effectiveDatedEntry(person?.nutritionTargetHistory,date);
 if(goal&&(!legacyEnergy||goal.effectiveFrom>=legacyEnergy.effectiveFrom))return {...profile,dailyFatG:goal.dailyFatG,dailyCarbohydrateG:goal.dailyCarbohydrateG,dailyFibreG:goal.dailyFibreG,dailyProteinG:goal.dailyProteinG,dailyEnergyKcal:goal.dailyEnergyKcal,dailyEnergyOrigin:goal.origin,dailyEnergyMethod:goal.method};
 return legacyEnergy?{...profile,dailyEnergyKcal:legacyEnergy.dailyEnergyKcal,dailyEnergyOrigin:legacyEnergy.dailyEnergyOrigin,dailyEnergyMethod:legacyEnergy.dailyEnergyMethod}:profile;
}

export function monthlyReview(person,date) {
 const weights=(person?.weightHistory??[]).filter(row=>row.measuredOn<=date).sort((a,b)=>a.measuredOn.localeCompare(b.measuredOn));
 if(!weights.length)return {due:false,reason:'no-weights'};
 const first=weights[0],last=weights.at(-1),goal=effectiveDatedEntry(person.nutritionTargetHistory,date);
 const anchor=first.measuredOn,day=Number(anchor.slice(8));
 let month=Number(date.slice(5,7)),year=Number(date.slice(0,4));
 const anniversary=(y,m)=>`${y}-${String(m).padStart(2,'0')}-${String(Math.min(day,new Date(Date.UTC(y,m,0)).getUTCDate())).padStart(2,'0')}`;
 let dueDate=anniversary(year,month);
 if(dueDate>date){if(--month===0){month=12;year--;}dueDate=anniversary(year,month);}
 const monthly=dueDate>anchor && (!goal||goal.effectiveFrom<dueDate);
 const change=goal?.referenceWeightKg==null?null:last.weightKg-goal.referenceWeightKg;
 return {due:monthly||change!=null&&Math.abs(change)>=5,dueDate,monthly,weightThreshold:change!=null&&Math.abs(change)>=5,change,measurements:weights.filter(row=>row.measuredOn>=dueDate).length,first,last};
}

export function renderNutritionGoals(parent,person,options){return renderAutomaticProfile(parent,person,options);}
