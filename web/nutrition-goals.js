import {renderGuidedEstimator} from './guided-nutrition-ui.js';
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

export function renderNutritionGoals(parent,person,{api,householdId,today,onSaved}) {
 const block=document.createElement('section');block.className='profile-entry';
 const title=document.createElement('h4');title.textContent='Objectifs nutritionnels datés';block.append(title);
 const current=effectiveDatedEntry(person.nutritionTargetHistory,today),review=monthlyReview(person,today);
 const info=document.createElement('p');info.className='muted';info.textContent=review.reason==='no-weights'?'Le bilan mensuel commencera à la première pesée.':review.due?'Bilan à examiner : '+[review.monthly?'rendez-vous mensuel':'',review.weightThreshold?'écart de ±5 kg depuis la dernière cible validée':''].filter(Boolean).join(' · ')+'. Vérifie les pesées et la cible avant de décider.':'Bilan mensuel ancré sur la première pesée du '+review.first.measuredOn+'.';block.append(info);
 if(review.first){const trend=document.createElement('p');trend.textContent=`Première pesée : ${review.first.weightKg} kg le ${review.first.measuredOn} ; dernière : ${review.last.weightKg} kg le ${review.last.measuredOn}.${review.change==null?'':` Écart depuis le poids de référence validé : ${review.change>0?'+':''}${Number(review.change.toFixed(2))} kg.`} ${review.measurements<2?'Pesées récentes insuffisantes pour conclure à une tendance ou à une stagnation.':'La tendance est à examiner avant tout ajustement.'}`;block.append(trend);}
 const form=document.createElement('form');form.className='profile-entry';
 form.innerHTML='<label>Valable à partir du<input name="effectiveFrom" type="date" required></label><label>Cible quotidienne (kcal)<input name="dailyEnergyKcal" type="number" min="500" max="10000" step="1" required></label><label>Minimum indicatif de protéines (g, facultatif)<input name="dailyProteinG" type="number" min="0" max="500" step="0.1"></label><label>Repère lipides (g/j, facultatif)<input name="dailyFatG" type="number" min="0" max="1000" step="0.1"></label><label>Repère glucides (g/j, facultatif)<input name="dailyCarbohydrateG" type="number" min="0" max="2000" step="0.1"></label><label>Repère fibres (g/j, facultatif)<input name="dailyFibreG" type="number" min="0" max="150" step="0.1"></label><label>Origine<select name="origin"><option value="manual">Choix personnel</option><option value="clinician">Prescription ou validation professionnelle</option><option value="estimate">Estimation documentée et validée</option></select></label><label>Méthode, source ou note<textarea name="method" maxlength="1000" rows="3"></textarea></label><button type="submit" class="secondary">Vérifier les valeurs saisies</button>';
 form.elements.effectiveFrom.value=today;
 form.elements.dailyEnergyKcal.value=current?.dailyEnergyKcal??effectiveNutritionProfile(person,today)?.dailyEnergyKcal??'';
 form.elements.dailyProteinG.value=current?.dailyProteinG??'';
 for(const key of ['dailyFatG','dailyCarbohydrateG','dailyFibreG'])form.elements[key].value=current?.[key]??'';
 form.elements.origin.value=current?.origin??'manual';form.elements.method.value=current?.method??'';
 const preview=document.createElement('div'),status=document.createElement('p');status.setAttribute('role','status');
 let questionnaire=null;
 if(current?.questionnaire){const recorded=document.createElement("p");recorded.className="muted";recorded.textContent="Un questionnaire privé est conservé avec cette cible. Reprends le parcours guidé pour le réévaluer ; la saisie directe reste disponible.";block.append(recorded);}
 renderGuidedEstimator(block,person,{targetForm:form,current,estimateDailyEnergy,onInvalidated:()=>{preview.replaceChildren();if(questionnaire)form.elements.origin.value='manual';questionnaire=null;},onProposal:(proposal,input)=>{
   for(const key of ['dailyEnergyKcal','dailyProteinG','dailyFatG','dailyCarbohydrateG','dailyFibreG'])form.elements[key].value=proposal[key]??'';
   form.elements.origin.value='estimate';form.elements.method.value='Mifflin–St Jeor : maintien '+proposal.estimate.maintenanceKcal+' kcal/j ; objectif '+proposal.objective+' ; ajustement choisi '+proposal.adjustmentKcal+' kcal/j. Recommandations : '+proposal.sources.join(' ; ');
   questionnaire=input;preview.replaceChildren();manualDetails.open=true;form.requestSubmit?.();preview.scrollIntoView?.({behavior:"smooth",block:"center"});
 }});
 form.addEventListener('input',event=>{preview.replaceChildren();if(questionnaire&&event.target?.name!=='origin')form.elements.origin.value='manual';});
 form.addEventListener('submit',event=>{event.preventDefault();preview.replaceChildren();status.textContent='';const data=Object.fromEntries(new FormData(form));
  const text=document.createElement('p');text.textContent=`Vérification des valeurs saisies (aucun nouveau calcul ici). À partir du ${data.effectiveFrom} : ${data.dailyEnergyKcal} kcal/j (cible actuelle : ${current?.dailyEnergyKcal??'non renseignée'}) et ${data.dailyProteinG||'aucun'} g de minimum protéique. Lipides : ${data.dailyFatG||'non définis'} g ; glucides : ${data.dailyCarbohydrateG||'non définis'} g ; fibres : ${data.dailyFibreG||'non définies'} g. Les repas existants gardent leurs quantités. Les versions précédentes restent conservées.`;
  const confirm=document.createElement('button');confirm.type='button';confirm.textContent='Valider cette cible';
  confirm.addEventListener('click',async()=>{confirm.disabled=true;try{await api('/api/people/'+person.id+'/nutrition-targets',{method:'POST',body:JSON.stringify({householdId,...data,questionnaire,confirmed:true})});await onSaved();}catch(error){status.textContent=error.body?.error??error.message;confirm.disabled=false;}});preview.append(text,confirm);
 });
 const manualInfo=document.createElement('p');manualInfo.className='muted';manualInfo.textContent='Cible enregistrée / saisie manuelle : les champs ci-dessous reprennent tes valeurs actuelles. Ce formulaire ne calcule pas une nouvelle cible. Utilise « Calculer ma proposition complète » au-dessus, puis « Utiliser cette proposition adaptée » pour les remplacer avant validation.';const manualDetails=document.createElement('details'),manualTitle=document.createElement('summary');manualTitle.textContent='Cible enregistrée / saisie manuelle (aucun calcul)';manualDetails.append(manualTitle,manualInfo,form);block.append(manualDetails,preview,status);
 if(review.due&&current){const keep=document.createElement('button');keep.type='button';keep.className='secondary';keep.textContent='Confirmer le maintien de ma cible actuelle';keep.addEventListener('click',async()=>{keep.disabled=true;try{await api('/api/people/'+person.id+'/nutrition-targets',{method:'POST',body:JSON.stringify({householdId,effectiveFrom:today,dailyEnergyKcal:current.dailyEnergyKcal,dailyProteinG:current.dailyProteinG,dailyFatG:current.dailyFatG,dailyCarbohydrateG:current.dailyCarbohydrateG,dailyFibreG:current.dailyFibreG,questionnaire:current.questionnaire,origin:current.origin,method:current.method,confirmed:true})});await onSaved();}catch(error){status.textContent=error.body?.error??error.message;keep.disabled=false;}});block.append(keep);}
 const history=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Historique des cibles et validations';history.append(summary);
 for(const entry of person.nutritionTargetHistory??[]){const row=document.createElement('p');row.textContent=`${entry.effectiveFrom} · ${entry.dailyEnergyKcal} kcal/j · protéines ${entry.dailyProteinG??'non renseignées'} g · lipides ${entry.dailyFatG??'—'} g · glucides ${entry.dailyCarbohydrateG??'—'} g · fibres ${entry.dailyFibreG??'—'} g · ${entry.origin} · ${entry.method||'sans note'} · révision ${entry.revisionOrder}${entry.effectiveFrom>today?' · futur':''}`;history.append(row);}
 block.append(history);parent.append(block);return block;
}
