import {ageAtDate,effectiveDatedEntry} from './profile-dates.js';
import {ACTIVITY_TYPES,ACTIVITY_SOURCE,ACTIVITY_GUIDANCE,WEIGHT_MODEL_SOURCE,activitySummary,projectWeight} from './activity-model.js';
const element=(tag,text)=>{const node=document.createElement(tag);if(text!=null)node.textContent=text;return node;};
function input(form,label,name,type,value='',required=false){const wrapper=element('label',label),field=element('input');field.name=name;field.type=type;field.value=value??'';field.required=required;wrapper.append(field);form.append(wrapper);return field;}
function select(form,label,name,options,value){const wrapper=element('label',label),field=element('select');field.name=name;field.required=true;for(const [key,text] of options){const option=element('option',text);option.value=key;field.append(option);}if(value!=null)field.value=value;wrapper.append(field);form.append(wrapper);return field;}
function submit(form,text){const button=element('button',text);button.type='submit';button.className='secondary';form.append(button);return button;}
const choices=[['','Choisir'],['no','Non'],['yes','Oui'],['unknown','Je ne sais pas']];
const number=(form,label,name,value,min,max,step='0.1')=>{const f=input(form,label,name,'number',value);f.min=min;f.max=max;f.step=step;return f;};
const activityChoices=Object.entries(ACTIVITY_TYPES).map(([key,value])=>[key,value.label]);
const humanDate=date=>new Intl.DateTimeFormat('fr-FR',{month:'long',year:'numeric'}).format(new Date(date+'T12:00:00Z'));

export function renderAutomaticProfile(parent,person,{api,householdId,today,onSaved}){
 const root=element('section');root.className='automatic-profile';root.append(element('h4','Profil, activité et repères automatiques'));
 const content=element('div'),message=element('p');message.setAttribute('role','status');root.append(content,message);parent.append(root);
 let model=null;
 const action=async(button,operation)=>{button.disabled=true;message.textContent='';try{await operation();}catch(error){message.textContent=({'entry-already-exists-for-date':'Une pesée existe déjà pour cette date ; les valeurs précédentes ont été conservées.','invalid-medical-context':'Complète les antécédents, ou choisis « Je ne sais pas ».','invalid-automatic-profile':'Vérifie les données du profil et l’activité habituelle.','invalid-activity-session':'Vérifie la date et la durée de la séance.'})[error.body?.error]??error.body?.error??error.message;}finally{button.disabled=false;}};
 const load=async()=>{model=await api('/api/people/'+person.id+'/automatic?householdId='+encodeURIComponent(householdId));render();};
 function render(){
  content.replaceChildren();const calculation=model.calculation;
  if(calculation?.status==='calculated'){
   content.append(element('p','Repères calculés et appliqués automatiquement. Les nouvelles pesées et les modifications du profil actualisent ce suivi ; les repas déjà enregistrés gardent leurs quantités.'));
   const dl=element('dl');dl.className='nutrition-proposal-values';for(const [label,value,unit] of [['Calories',calculation.dailyEnergyKcal,'kcal'],['Protéines',calculation.dailyProteinG,'g'],['Lipides',calculation.dailyFatG,'g'],['Glucides',calculation.dailyCarbohydrateG,'g'],['Fibres',calculation.dailyFibreG,'g']])dl.append(element('dt',label),element('dd',value+' '+unit+'/jour'));content.append(dl);
   const details=element('details');details.append(element('summary','Comprendre le calcul'));details.append(element('p',`Maintien estimé : ${calculation.maintenanceKcal} kcal/j ; ajustement : ${calculation.adjustmentKcal>0?'−':'+'}${Math.abs(calculation.adjustmentKcal)} kcal/j ; cible appliquée : ${calculation.dailyEnergyKcal} kcal/j. Dernier poids utilisé : ${calculation.estimate.weightKg} kg mesurés le ${calculation.estimate.measuredOn}.`));for(const note of calculation.notes)details.append(element('p',note));for(const source of calculation.sources){const link=element('a','Consulter une source du calcul');link.href=source;link.target='_blank';link.rel='noopener';details.append(link);}content.append(details);
  }else if(calculation){content.append(element('p','Calcul automatique non appliqué : '+calculation.problems.join(' ')));}
  else content.append(element('p','Renseigne les faits du profil ; le système calculera les repères sans saisie de calories ni de macronutriments.'));
  const details=element('details');details.open=!model.settings;details.append(element('summary','Modifier mon profil et mes antécédents'));
  const form=element('form');form.className='profile-entry';
  const profile=effectiveDatedEntry(person.profileHistory,today),goal=effectiveDatedEntry(person.weightGoalHistory,today),legacy=effectiveDatedEntry(person.nutritionTargetHistory,today)?.questionnaire,settings=model.settings??{sex:legacy?.estimate?.sex??legacy?.sex,context:legacy?.context??{}},context=settings.context??{};
  input(form,'Nom affiché','displayName','text',person.displayName,true).maxLength=80;
  input(form,'Date de naissance','birthDate','date',person.birthDate);
  number(form,'Taille (cm)','heightCm',profile?.heightCm??'',50,260);
  select(form,'Paramètre sexué du calcul','sex',[['','Choisir'],['female','Féminin'],['male','Masculin']],settings.sex);
  select(form,'Activité habituelle (hors nouvelle activité planifiée)','activityLevel',[['sedentary','Sédentaire / peu actif'],['light','Légèrement actif'],['moderate','Modérément actif'],['active','Actif'],['very_active','Très actif']],profile?.activityLevel??'sedentary');
  number(form,'Poids de forme souhaité (kg)','comfortableWeightKg',goal?.comfortableWeightKg??'',.1,500);
  number(form,'Objectif intermédiaire (kg, facultatif)','interimTargetKg',goal?.interimTargetKg??'',.1,500);
  form.append(element('p','Nouvelle pesée facultative : laisse ces champs vides pour garder les relevés existants.'));
  number(form,'Nouveau poids mesuré (kg)','weightKg','',.1,500);input(form,'Date de la nouvelle pesée','measuredOn','date',today).max=today;
  select(form,'Diabète','diabetes',[['','Choisir'],['none','Aucun'],['type2','Type 2'],['type1','Type 1'],['unknown','Je ne sais pas']],context.diabetes);
  select(form,'Cholestérol élevé connu','cholesterol',choices,context.cholesterol);
  select(form,'Maladie rénale connue','renal',choices,context.renal);
  select(form,'Hypoglycémies ou traitement à risque (insuline, sulfamides…)','hypoglycemia',choices,context.hypoglycemia);
  select(form,'Grossesse ou allaitement','pregnancy',choices,context.pregnancy);
  const surgery=select(form,'Chirurgie bariatrique','surgery',[['','Choisir'],['none','Aucune'],['sleeve','Sleeve'],['bypass','Bypass en Y'],['mini_bypass','Mini-bypass / oméga'],['other','Autre'],['unknown','Je ne sais pas']],context.surgery);
  const surgeryDate=input(form,'Date d’intervention si concerné','surgeryDate','date',context.surgeryDate);surgeryDate.max=today;
  const surgeryVisibility=()=>{surgeryDate.parentElement.hidden=!surgery.value||surgery.value==='none';};surgery.addEventListener('change',surgeryVisibility);surgeryVisibility();
  form.append(element('p','Ces informations restent privées au profil. Aucun envoi à une IA ou application tierce. Si une situation dépasse les règles générales disponibles, le système le signale sans inventer de cible.'));
  const save=submit(form,'Enregistrer le profil et calculer automatiquement');
  form.addEventListener('submit',event=>{event.preventDefault();action(save,async()=>{const data=Object.fromEntries(new FormData(form)),context=Object.fromEntries(['diabetes','cholesterol','renal','hypoglycemia','pregnancy','surgery','surgeryDate'].map(key=>[key,data[key]]));await api('/api/people/'+person.id+'/automatic-profile',{method:'POST',body:JSON.stringify({householdId,effectiveFrom:today,...data,context})});await onSaved();});});details.append(form);content.append(details);
  renderActivity(content);
 }
 function renderActivity(parent){
  const details=element('details');details.append(element('summary','Mon temps disponible et mes séances réalisées'));parent.append(details);
  const currentPlan=effectiveDatedEntry(model.plans,today),planForm=element('form');planForm.className='profile-entry';
  select(planForm,'Activité prévue','activityType',activityChoices,currentPlan?.activityType??'walk_slow');
  number(planForm,'Temps disponible par séance (minutes)','minutesPerSession',currentPlan?.minutesPerSession??30,1,180,'1').required=true;
  number(planForm,'Nombre de séances possibles par semaine','sessionsPerWeek',currentPlan?.sessionsPerWeek??3,1,7,'1').required=true;
  const extra=input(planForm,'Cette activité s’ajoute à mes habitudes actuelles','additional','checkbox');extra.checked=currentPlan?.additional??true;
  planForm.append(element('p','Le temps prévu sert à une projection, jamais à créer des séances réalisées. Décoche si cette activité est déjà comprise dans ton activité habituelle.'));
  const savePlan=submit(planForm,'Enregistrer mes disponibilités');let planRequest=crypto.randomUUID();
  planForm.addEventListener('input',()=>{planRequest=crypto.randomUUID();});
  planForm.addEventListener('submit',event=>{event.preventDefault();action(savePlan,async()=>{await api('/api/people/'+person.id+'/activity-plans',{method:'POST',body:JSON.stringify({householdId,requestId:planRequest,effectiveFrom:today,...Object.fromEntries(new FormData(planForm)),additional:extra.checked})});await load();});});details.append(planForm);
  const summary=activitySummary(model.sessions,today);details.append(element('p',`Sur les 7 derniers jours : ${summary.sessions} séance(s) saisie(s), ${summary.minutes} minutes réalisées${currentPlan?' ; disponibilité prévue '+currentPlan.minutesPerSession*currentPlan.sessionsPerWeek+' min/semaine':''}. Les jours non renseignés ne sont pas des mesures d’inactivité.`));
  const sessionForm=element('form');sessionForm.className='profile-entry';input(sessionForm,'Date de la séance réalisée','performedOn','date',today,true).max=today;
  select(sessionForm,'Activité réalisée','activityType',activityChoices,currentPlan?.activityType??'walk_slow');number(sessionForm,'Durée réalisée (minutes)','durationMinutes','',1,600,'1').required=true;
  const additional=input(sessionForm,'Séance supplémentaire à mes habitudes','additional','checkbox');additional.checked=currentPlan?.additional??true;
  const saveSession=submit(sessionForm,'Ajouter cette séance réalisée');let sessionRequest=crypto.randomUUID();sessionForm.addEventListener('input',()=>{sessionRequest=crypto.randomUUID();});
  sessionForm.addEventListener('submit',event=>{event.preventDefault();action(saveSession,async()=>{await api('/api/people/'+person.id+'/activity-sessions',{method:'POST',body:JSON.stringify({householdId,requestId:sessionRequest,...Object.fromEntries(new FormData(sessionForm)),additional:additional.checked})});await load();});});details.append(sessionForm);
  const history=element('details');history.append(element('summary','Historique des séances'));for(const session of model.sessions.slice(0,50)){const row=element('p',`${session.performedOn} · ${ACTIVITY_TYPES[session.activityType]?.label??session.activityType} · ${session.durationMinutes} min${session.cancelledAt?' · annulée':''}`);if(!session.cancelledAt){const cancel=element('button','Annuler cette saisie');cancel.type='button';cancel.className='secondary';cancel.addEventListener('click',()=>action(cancel,async()=>{await api('/api/people/'+person.id+'/activity-sessions',{method:'POST',body:JSON.stringify({householdId,action:'cancel',sessionId:session.id})});await load();}));row.append(cancel);}history.append(row);}details.append(history);
  if(ageAtDate(person.birthDate,today)>=18)details.append(element('p','Repère OMS adulte : progresser selon ses capacités vers 150–300 min d’activité modérée par semaine ; commencer par de petites durées si nécessaire. Ces disponibilités ne constituent pas une prescription d’exercice.'));
  const link=element('a','Sources : activité et dépenses');link.href=ACTIVITY_SOURCE;link.target='_blank';link.rel='noopener';details.append(link);
  const who=element('a','Recommandations OMS');who.href=ACTIVITY_GUIDANCE;who.target='_blank';who.rel='noopener';details.append(who);
  renderProjection(parent,currentPlan);
 }
 function renderProjection(parent,plan){
  const details=element('details');details.append(element('summary','Estimation d’évolution du poids'));parent.append(details);
  const calculated=model.calculation,weight=person.weightHistory?.find(row=>row.measuredOn<=today),goal=effectiveDatedEntry(person.weightGoalHistory,today);
  if(calculated?.status!=='calculated'||!weight){details.append(element('p','Complète le profil pour disposer d’un calcul automatique applicable avant la simulation.'));return;}
  const input={startDate:today,birthDate:person.birthDate,weightKg:weight.weightKg,heightCm:calculated.estimate.heightCm,sex:calculated.estimate.sex,pal:calculated.estimate.pal,intakeKcal:calculated.dailyEnergyKcal,maintenanceKcal:calculated.maintenanceKcal,targets:{comfortable:goal?.comfortableWeightKg,interim:goal?.interimTargetKg}};
  const baseline=projectWeight(input),planned=plan?projectWeight({...input,plan}):baseline;
  if(baseline.error||planned.error){details.append(element('p',baseline.error??planned.error));return;}
  details.append(element('p',`Simulation à partir du ${today} : ${weight.weightKg} kg, dernière pesée du ${weight.measuredOn}. Hypothèse : cible actuelle de ${calculated.dailyEnergyKcal} kcal/j constante. La projection est recalculée quand le suivi change ; elle n’est pas une promesse ni le calculateur complet NIDDK.`));
  if(plan)details.append(element('p',`Disponibilités : ${plan.minutesPerSession} min × ${plan.sessionsPerWeek}/semaine. Dépense supplémentaire nette initiale estimée : ${planned.additionalKcalPerDay.toFixed(0)} kcal/j en moyenne. ${plan.additional?'Seule l’activité déclarée en plus des habitudes est ajoutée.':'Cette activité est déjà incluse dans le profil : aucun ajout au maintien.'} Les séances saisies sont suivies séparément et ne sont pas ajoutées une seconde fois au programme.`));
  const table=element('table'),head=element('thead'),header=element('tr');for(const label of ['Échéance','Sans ajout','Avec disponibilités','Variation du mois'])header.append(element('th',label));head.append(header);table.append(head);const body=element('tbody');
  for(let index=1;index<=12&&index<planned.points.length;index++){const row=element('tr'),p=planned.points[index],b=baseline.points[index];for(const text of [humanDate(p.date),b?b.weightKg.toFixed(1)+' kg':'—',p.weightKg.toFixed(1)+' kg',(p.changeKg>0?'+':'')+p.changeKg.toFixed(1)+' kg'])row.append(element('td',text));body.append(row);}table.append(body);const tableWrap=element('div');tableWrap.className='activity-projection-table';tableWrap.append(table);details.append(tableWrap);
  for(const [key,label] of [['interim','Objectif intermédiaire'],['comfortable','Poids de forme']]){const target=input.targets[key];if(!Number.isFinite(target))continue;const already=calculated.objective==='lose'?weight.weightKg<=target:calculated.objective==='gain'?weight.weightKg>=target:Math.abs(weight.weightKg-target)<.5;details.append(element('p',`${label} (${target} kg) : ${already?'déjà atteint':planned.reached[key]?'vers '+humanDate(planned.reached[key]):'non atteint dans ce scénario sur trois ans'}.`));}
  details.append(element('p','Modèle réduit à deux compartiments de Hall (équations 3–9), avec adaptation des dépenses et plateau possible. Composition corporelle estimée, activité moyenne et MET de population ; variations rapides d’eau/glycogène et malabsorption après chirurgie non modélisées. Les repères restent des estimations, y compris après chirurgie ou avec un diabète. Aucune augmentation automatique des calories à manger après une séance.'));
  const source=element('a','Équations et hypothèses du modèle');source.href=WEIGHT_MODEL_SOURCE;source.target='_blank';source.rel='noopener';details.append(source);
 }
 load().catch(error=>{message.textContent='Suivi indisponible : '+(error.body?.error??error.message);});
 return root;
}
