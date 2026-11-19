import {validDate} from './activity-model.js';
import {ageAtDate,effectiveDatedEntry} from './profile-dates.js';
import {idealWeight,NUTRITION_SOURCES} from './nutrition-recommendations.js';

export const AUTO_NUTRITION_VERSION='profile-auto-v2';
export const AUTO_PAL={sedentary:1.4,light:1.6,moderate:1.6,active:1.8,very_active:2};
export function automaticNutrition({person,settings,date}){
 const age=ageAtDate(person.birthDate,date),profile=effectiveDatedEntry(person.profileHistory,date),weight=person.weightHistory?.find(row=>row.measuredOn<=date),goal=effectiveDatedEntry(person.weightGoalHistory,date);
 const problems=[],context=settings.context??{};
 if(age==null||age<18||age>78)problems.push('L’estimation générale adulte ne couvre pas ce profil ; aucune cible de perte de poids automatique pour un mineur ou un âge inconnu.');
 if(!weight||!profile?.heightCm||!AUTO_PAL[profile?.activityLevel]||!['male','female'].includes(settings.sex))problems.push('Complète la naissance, le poids, la taille, le paramètre sexué et l’activité habituelle.');
 if(context.renal!=='no'||context.hypoglycemia!=='no'||context.pregnancy!=='no'||!['none','type2'].includes(context.diabetes)||!['none','sleeve','bypass','mini_bypass'].includes(context.surgery))problems.push('Ce contexte médical demande des repères individuels ; le système ne dispose pas d’une règle générale suffisamment adaptée.');
 if(context.surgery!=='none'&&(!validDate(context.surgeryDate)||Date.parse(context.surgeryDate)>Date.parse(date)||Date.parse(date)-Date.parse(context.surgeryDate)<365*86400000))problems.push('La date ou la première année après chirurgie nécessite le protocole de suivi de l’équipe bariatrique.');
 if(problems.length)return {status:'needs-review',problems};
 const w=weight.weightKg,h=profile.heightCm,bmi=w/(h/100)**2,pal=AUTO_PAL[profile.activityLevel];
 const maintenance=Math.round((10*w+6.25*h-5*age+(settings.sex==='male'?5:-161))*pal);
 const targetWeight=goal?.comfortableWeightKg??w;
 const objective=Math.abs(w-targetWeight)<.5?'maintain':targetWeight<w?'lose':'gain';
 if(objective==='lose'&&(bmi<18.5||targetWeight/(h/100)**2<18.5))return {status:'needs-review',problems:['L’objectif sort du domaine de la perte de poids générale du modèle.']};
 const adjustment=objective==='maintain'?0:Math.min(500,maintenance*.2);
 const energy=Math.round((maintenance+(objective==='lose'?-adjustment:objective==='gain'?adjustment:0))/10)*10;
 if(!Number.isFinite(energy)||energy<=1200||energy>10000)return {status:'needs-review',problems:['La cible calculée nécessite un accompagnement spécialisé ; aucune cible automatique n’est appliquée.']};
 const medicalWeight=context.surgery==='none'?null:idealWeight(h,settings.sex,'lorentz');
 const proteinMinimum=Math.ceil(medicalWeight==null ? .83*w : Math.max(60,1.1*medicalWeight));
 const protein=Math.max(proteinMinimum,Math.round(energy*.2/4));
 const carbohydrate=Math.round(energy*.45/4*10)/10,fat=Math.round((energy-protein*4-carbohydrate*4)/9*10)/10;
 if(!Number.isFinite(protein)||protein>500||fat<0)return {status:'needs-review',problems:['Répartition énergétique incompatible avec les repères calculés.']};
 const fibre=Math.max(25,context.diabetes==='type2'?Math.ceil(14*energy/1000):25);
 const notes=['Estimation générale : Mifflin–St Jeor × activité habituelle. Ajustement applicatif automatique de 20 % plafonné à 500 kcal/j, sans consigne de perte rapide. Ce choix n’est pas une prescription individuelle.','Protéines calculées sans reprise d’une ancienne saisie ; glucides à 45 % des calories, lipides par différence. Aucune répartition universelle spécifique au diabète.'];
 notes.push(`Référence protéique minimale calculée : ${proteinMinimum} g/j. Le repère de répartition de l’application réserve environ 20 % des calories aux protéines s’il est supérieur ; ce choix de répartition n’est pas un besoin médical mesuré.`);
 if(medicalWeight!=null)notes.push(`Repère HAS après chirurgie : minimum 60 g/j, idéalement au moins 1,1 g/kg de référence. Lorentz : ${medicalWeight.toFixed(1)} kg ; ce nombre n’est pas ton objectif de poids.`);
 if(context.cholesterol==='yes')notes.push('Cholestérol élevé déclaré : privilégier les graisses insaturées en remplacement des graisses saturées. La qualité des graisses compte ; aucune estimation du LDL ni adaptation d’un traitement.');
 if(context.cholesterol==='unknown')notes.push('Statut du cholestérol non renseigné ; aucun diagnostic n’est déduit.');
 return {status:'calculated',model:AUTO_NUTRITION_VERSION,dailyEnergyKcal:energy,dailyProteinG:protein,dailyFatG:fat,dailyCarbohydrateG:carbohydrate,dailyFibreG:fibre,maintenanceKcal:maintenance,objective,adjustmentKcal:maintenance-energy,medicalWeight,notes,estimate:{age,weightKg:w,heightCm:h,sex:settings.sex,pal,maintenanceKcal:maintenance,measuredOn:weight.measuredOn},sources:['https://pubmed.ncbi.nlm.nih.gov/2305711/','https://www.efsa.europa.eu/sites/default/files/assets/DRV_Summary_tables_jan_17.pdf',NUTRITION_SOURCES.energy,NUTRITION_SOURCES.fats,NUTRITION_SOURCES.fibre,...(medicalWeight==null?[NUTRITION_SOURCES.protein]:[NUTRITION_SOURCES.bariatric]),...(context.diabetes==='type2'?[NUTRITION_SOURCES.diabetes]:[]),...(context.cholesterol==='yes'?['https://www.who.int/publications/i/item/9789240073630']:[])]};
}
