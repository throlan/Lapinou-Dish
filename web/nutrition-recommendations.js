export const NUTRITION_SOURCES = Object.freeze({
 bariatric:'https://www.has-sante.fr/upload/docs/application/pdf/2024-02/reco369_recommandations_obesite_2e_3e_niveaux_ii_cd_2024_02_08_preparation_mel.pdf',
 diabetes:'https://doi.org/10.2337/dc26-S005',
 kidney:'https://doi.org/10.2337/dc26-s011',
 energy:'https://www.nice.org.uk/guidance/ng246/chapter/Physical-activity-and-diet',
 fats:'https://efsa.onlinelibrary.wiley.com/doi/10.2903/j.efsa.2022.7259',
});

export function idealWeight(heightCm,sex,method) {
 if(!(heightCm>=140&&heightCm<=230)||!['male','female'].includes(sex))return null;
 if(method==='lorentz')return heightCm-100-(heightCm-150)/(sex==='male'?4:2.5);
 if(method==='hamwi')return sex==='male'?48+(heightCm-152)*1.06:45.4+(heightCm-152)*0.89;
 if(method==='bmi25')return 25*(heightCm/100)**2;
 return null;
}

export function proposeNutritionPlan(input={}) {
 const {estimate,objective,date}=input,context=input.context??{},conflicts=[],notes=[],sources=new Set([NUTRITION_SOURCES.energy]);
 if(!estimate||estimate.error||!(estimate.maintenanceKcal>0)||!Number.isFinite(estimate.age)||estimate.age<18||estimate.age>78||!(estimate.weightKg>0)||!(estimate.heightCm>=50)||!['male','female'].includes(estimate.sex))return {error:'Une estimation adulte complète est nécessaire.'};
 if(!['maintain','lose','gain'].includes(objective))return {error:'Confirme ton objectif : maintien, perte ou prise de poids.'};
 for(const name of ['renal','hypoglycemia','pregnancy','dumping'])if(!['no','yes','unknown'].includes(context[name]))return {error:'Complète les réponses de santé, ou choisis « Je ne sais pas ».'};
 if(!['none','type1','type2','unknown'].includes(context.diabetes)||!['none','sleeve','bypass','mini_bypass','other','unknown'].includes(context.surgery))return {error:'Renseigne le diabète et les antécédents de chirurgie.'};
 const adjustment=objective==='maintain'?0:Number(input.adjustmentKcal);
 if(objective!=='maintain'&&(input.adjustmentKcal===''||input.adjustmentKcal==null||!Number.isFinite(adjustment)||adjustment<=0||adjustment>1000))return {error:'Choisis explicitement l’ajustement calorique (1 à 1 000 kcal/j). Ce choix ne constitue pas une prescription.'};
 const energy=Math.round(estimate.maintenanceKcal+(objective==='lose'?-adjustment:objective==='gain'?adjustment:0));
 if(energy<=1200)conflicts.push('La cible proposée est ≤ 1 200 kcal/j : un accompagnement spécialisé est nécessaire. Utilise une cible prescrite.');
 if(objective==='lose'&&estimate.weightKg/(estimate.heightCm/100)**2<18.5)conflicts.push('Une perte de poids ne peut pas être proposée avec cet IMC.');
 if(context.renal!=='no'){conflicts.push('Fonction rénale atteinte ou inconnue : faire préciser les cibles protéiques avant une proposition personnalisée.');sources.add(NUTRITION_SOURCES.kidney);}
 if(context.pregnancy!=='no')conflicts.push('Grossesse ou allaitement déclaré ou incertain : utiliser une cible personnalisée par un professionnel.');
 if(context.diabetes!=='none'){
  sources.add(NUTRITION_SOURCES.diabetes);
  notes.push('Diabète : aucune répartition universelle des macronutriments. Les glucides calculés ci-dessous dépendent des choix validés ; ils ne sont pas une prescription pour le diabète.');
  if(context.diabetes==='type1'||context.diabetes==='unknown')conflicts.push('Type de diabète nécessitant une personnalisation : reprendre les objectifs de l’équipe soignante.');
 }
 if(context.hypoglycemia!=='no')conflicts.push('Traitement à risque d’hypoglycémie ou statut inconnu : faire valider une modification des apports par l’équipe soignante. Aucun traitement n’est modifié ici.');
 let protein=input.proteinG===''||input.proteinG==null?null:Number(input.proteinG),referenceWeight=null;
 if(context.surgery!=='none'){
  sources.add(NUTRITION_SOURCES.bariatric);
  const surgeryDate=context.surgeryDate;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(surgeryDate??'')||!Number.isFinite(Date.parse(surgeryDate))||new Date(surgeryDate+'T00:00:00Z').toISOString().slice(0,10)!==surgeryDate||surgeryDate>date)conflicts.push('Précise une date d’intervention passée et valide.');
  else if((Date.parse(date)-Date.parse(surgeryDate))/86400000<365)conflicts.push('Première année après chirurgie : suivre le protocole nutritionnel de l’équipe bariatrique, sans déficit calculé automatiquement.');
  if(['other','unknown'].includes(context.surgery))conflicts.push('Le type d’intervention doit être précisé avec l’équipe bariatrique.');
  referenceWeight=idealWeight(estimate.heightCm,estimate.sex,input.idealWeightMethod);
  if(referenceWeight==null)conflicts.push('Choisis explicitement la formule de poids idéal médical. Le poids de forme personnel ne la remplace pas.');
  else {
   const recommendation=Math.ceil(Math.max(60,1.1*referenceWeight));
   notes.push(`HAS 2024 R98 : minimum 60 g/j et idéalement au moins 1,1 g/kg de poids idéal/j. ${input.idealWeightMethod} : ${referenceWeight.toFixed(1)} kg, soit repère ${recommendation} g/j. Ce repère reste à valider individuellement.`);
   if(protein==null)protein=recommendation;
   else if(protein<recommendation)conflicts.push(`Le repère protéique saisi (${protein} g) est inférieur au repère bariatrique proposé (${recommendation} g). À arbitrer avec le professionnel.`);
  }
 }
 if(context.dumping!=='no'){sources.add(NUTRITION_SOURCES.bariatric);conflicts.push('Dumping ou hypoglycémies après repas, ou statut incertain : personnaliser le fractionnement et les glucides avec l’équipe soignante (HAS R153).');}
 if(protein!=null&&(!Number.isFinite(protein)||protein<0||protein>500))return {error:'Le repère protéique doit être compris entre 0 et 500 g/j.'};
 let fat=null,carbohydrate=null;
 if(input.fatPercent!==''&&input.fatPercent!=null){
  const percent=Number(input.fatPercent);if(!Number.isFinite(percent)||percent<20||percent>35)return {error:'Pour cette proposition générale, choisis une part de lipides entre 20 et 35 %. Une prescription différente peut être saisie directement.'};
  sources.add(NUTRITION_SOURCES.fats);fat=Math.round(energy*percent/90)/10;
  if(protein!=null){carbohydrate=Math.round((energy-protein*4-fat*9)/4*10)/10;if(carbohydrate<0)conflicts.push('Les protéines et lipides choisis dépassent les calories disponibles.');}
 }
 const fiber=context.diabetes!=='none'?Math.ceil(14*energy/1000):null;
 if(fiber!=null)notes.push('ADA 2026 : repère de fibres ≥14 g/1 000 kcal, à adapter à la tolérance digestive et aux consignes postopératoires.');
 return {dailyEnergyKcal:energy,dailyProteinG:protein,dailyFatG:fat,dailyCarbohydrateG:carbohydrate,dailyFibreG:fiber,objective,adjustmentKcal:adjustment,referenceWeight,idealWeightMethod:input.idealWeightMethod||null,context,notes,sources:[...sources],conflicts,estimate};
}
