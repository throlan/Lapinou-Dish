import {effectiveDatedEntry} from './profile-dates.js';
import {proposeNutritionPlan,NUTRITION_SOURCES} from './nutrition-recommendations.js';

const yesNo='<option value="">Choisir</option><option value="no">Non</option><option value="yes">Oui</option><option value="unknown">Je ne sais pas</option>';
export function renderGuidedEstimator(parent,person,{targetForm,current,estimateDailyEnergy,onProposal,onInvalidated}) {
 const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Construire une proposition adaptée à mon objectif';details.append(summary);
 const form=document.createElement('form');form.className='profile-entry guided-nutrition';
 form.innerHTML=`<p>Les réponses de santé sont facultatives : choisis « Je ne sais pas » si nécessaire. Elles sont enregistrées uniquement avec une cible que tu confirmes, dans ton profil privé, sans envoi à un service externe. Tu peux aussi saisir directement une consigne professionnelle dans le formulaire de cible.</p>
 <label>Objectif<select name="objective" required><option value="">Choisir</option><option value="maintain">Maintenir mon poids</option><option value="lose">Perdre du poids</option><option value="gain">Prendre du poids</option></select></label>
 <label><input type="checkbox" name="objectiveConfirmed" required>Je confirme cet objectif</label>
 <label>Mode d’ajustement hors maintien<select name="adjustmentChoice"><option value="">Choisir hors maintien</option><option value="10">10 % du maintien</option><option value="15">15 % du maintien</option><option value="20">20 % du maintien</option><option value="fixed">Valeur personnalisée en kcal</option></select></label><p>Ces pourcentages sont des réglages au choix, pas une prescription médicale. Aucun n’est sélectionné automatiquement.</p><label>Ajustement personnalisé hors maintien (kcal/j)<input name="adjustmentKcal" type="number" min="1" max="1000" step="1" placeholder="À choisir, aucun déficit imposé"></label>
 <label>Paramètre sexué de la formule<select name="sex" required><option value="">Choisir</option><option value="female">Féminin (−161)</option><option value="male">Masculin (+5)</option></select></label>
 <label>Activité quotidienne<select name="pal" required><option value="">Choisir</option><option value="1.4">Peu actif · ×1,4</option><option value="1.6">Modérément actif · ×1,6</option><option value="1.8">Actif · ×1,8</option><option value="2">Très actif · ×2</option></select></label>
 <label>Diabète<select name="diabetes" required><option value="">Choisir</option><option value="none">Aucun</option><option value="type2">Type 2</option><option value="type1">Type 1</option><option value="unknown">Je ne sais pas</option></select></label>
 <label>Traitement pouvant provoquer une hypoglycémie (ex. insuline, sulfamides), ou hypoglycémies connues<select name="hypoglycemia" required>${yesNo}</select></label>
 <label>Maladie rénale connue<select name="renal" required>${yesNo}</select></label>
 <label>Grossesse ou allaitement<select name="pregnancy" required>${yesNo}</select></label>
 <label>Chirurgie bariatrique<select name="surgery" required><option value="">Choisir</option><option value="none">Aucune</option><option value="sleeve">Sleeve</option><option value="bypass">Bypass en Y</option><option value="mini_bypass">Mini-bypass / bypass en oméga</option><option value="other">Autre intervention</option><option value="unknown">Je ne sais pas</option></select></label>
 <label>Date de l’intervention, si concerné<input name="surgeryDate" type="date"></label>
 <label>Dumping ou malaises/hypoglycémies après repas<select name="dumping" required>${yesNo}</select></label>
 <label>Formule du poids médical de référence, si chirurgie<select name="idealWeightMethod"><option value="">Choisir si concerné</option><option value="lorentz">Lorentz</option><option value="hamwi">Hamwi</option><option value="bmi25">Référence théorique IMC 25</option></select></label>
 <label>Repère protéique (g/j, facultatif)<input name="proteinG" type="number" min="0" max="500" step="0.1" placeholder="Repère HAS proposé si chirurgie renseignée"></label>
 <label>Part des lipides choisie pour la proposition (%)<input name="fatPercent" type="number" min="20" max="35" step="1" placeholder="Facultatif · repères généraux EFSA 20–35 %"></label>
 <p>Les glucides seront le complément calorique des protéines et lipides choisis. Ce calcul de répartition n’est pas une prescription spécifique au diabète ou à la chirurgie.</p>
 <button type="submit" class="secondary">Examiner la proposition et ses recommandations</button>`;
 const date=targetForm.elements.effectiveFrom.value,weight=(person.weightHistory??[]).find(row=>row.measuredOn<=date),goal=effectiveDatedEntry(person.weightGoalHistory,date);
 if(goal&&weight)form.elements.objective.value=goal.comfortableWeightKg<weight.weightKg?'lose':goal.comfortableWeightKg>weight.weightKg?'gain':'maintain';
 form.elements.proteinG.value=current?.dailyProteinG??'';
 const resultRoot=document.createElement('div');resultRoot.className='nutrition-proposal';
 const invalidate=()=>{resultRoot.replaceChildren();onInvalidated();};form.addEventListener('input',invalidate);targetForm.elements.effectiveFrom.addEventListener('input',invalidate);
 form.addEventListener('submit',event=>{
  event.preventDefault();invalidate();const data=Object.fromEntries(new FormData(form));
  if(!form.elements.objectiveConfirmed.checked){const error=document.createElement('p');error.textContent='Confirme explicitement ton objectif.';resultRoot.append(error);return;}
  const date=targetForm.elements.effectiveFrom.value,profile=effectiveDatedEntry(person.profileHistory,date),weight=(person.weightHistory??[]).find(row=>row.measuredOn<=date);
  const estimate={...estimateDailyEnergy({birthDate:person.birthDate,date,weightKg:weight?.weightKg,heightCm:profile?.heightCm,sex:data.sex,pal:data.pal}),measuredOn:weight?.measuredOn};
  const context=Object.fromEntries(['diabetes','hypoglycemia','renal','pregnancy','surgery','surgeryDate','dumping'].map(key=>[key,data[key]]));
  const adjustmentKcal=['10','15','20'].includes(data.adjustmentChoice)?Math.round(estimate.maintenanceKcal*Number(data.adjustmentChoice)/100):data.adjustmentChoice==='fixed'?data.adjustmentKcal:'';
  const input={estimate,date,objective:data.objective,adjustmentKcal,adjustmentChoice:data.adjustmentChoice,context,proteinG:data.proteinG,fatPercent:data.fatPercent,idealWeightMethod:data.idealWeightMethod};
  const proposal=proposeNutritionPlan(input),text=document.createElement('p');
  if(proposal.error){text.textContent=proposal.error;resultRoot.append(text);return;}
  text.textContent=`Données : ${estimate.age} ans, ${estimate.weightKg} kg pesés le ${estimate.measuredOn}, ${estimate.heightCm} cm. Maintien estimé : ${estimate.maintenanceKcal} kcal/j → ${data.objective==='lose'?'réduction':data.objective==='gain'?'augmentation':'maintien'} choisi : ${proposal.adjustmentKcal} kcal/j → proposition : ${proposal.dailyEnergyKcal} kcal/j. Protéines : ${proposal.dailyProteinG??'non définies'} g ; lipides : ${proposal.dailyFatG??'non définis'} g ; glucides : ${proposal.dailyCarbohydrateG??'non définis'} g ; fibres : ${proposal.dailyFibreG??'non définies'} g.`;resultRoot.append(text);
  for(const note of [...proposal.notes,...proposal.conflicts.map(item=>'À résoudre : '+item)]){const p=document.createElement('p');p.textContent=note;resultRoot.append(p);}
  for(const source of proposal.sources){const a=document.createElement('a');a.href=source;a.target='_blank';a.rel='noopener';a.textContent=({bariatric:'HAS · chirurgie bariatrique 2024',diabetes:'ADA · nutrition et diabète 2026',kidney:'ADA · maladie rénale 2026',energy:'NICE · ajustement énergétique',fats:'EFSA · repères lipidiques'})[Object.entries(NUTRITION_SOURCES).find(([,value])=>value===source)?.[0]]??'Source';resultRoot.append(a);}
  if(!proposal.conflicts.length){const use=document.createElement('button');use.type='button';use.className='secondary';use.textContent='Utiliser cette proposition adaptée';use.addEventListener('click',()=>onProposal(proposal,input));resultRoot.append(use);}
  else {const p=document.createElement('p');p.textContent='La proposition ne peut pas être reportée tant que ces conflits persistent. Tu peux saisir les consignes de ton professionnel dans la cible, en indiquant leur origine.';resultRoot.append(p);}
 });
 details.append(form,resultRoot);parent.append(details);return details;
}
