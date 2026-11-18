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
 if(goal&&(!legacyEnergy||goal.effectiveFrom>=legacyEnergy.effectiveFrom))return {...profile,dailyEnergyKcal:goal.dailyEnergyKcal,dailyEnergyOrigin:goal.origin,dailyEnergyMethod:goal.method};
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
 form.innerHTML='<label>Valable à partir du<input name="effectiveFrom" type="date" required></label><label>Cible quotidienne (kcal)<input name="dailyEnergyKcal" type="number" min="500" max="10000" step="1" required></label><label>Minimum indicatif de protéines (g, facultatif)<input name="dailyProteinG" type="number" min="0" max="500" step="0.1"></label><label>Origine<select name="origin"><option value="manual">Choix personnel</option><option value="clinician">Prescription ou validation professionnelle</option><option value="estimate">Estimation documentée et validée</option></select></label><label>Méthode, source ou note<input name="method" maxlength="1000"></label><button type="submit" class="secondary">Voir la proposition</button>';
 form.elements.effectiveFrom.value=today;
 form.elements.dailyEnergyKcal.value=current?.dailyEnergyKcal??effectiveNutritionProfile(person,today)?.dailyEnergyKcal??'';
 form.elements.dailyProteinG.value=current?.dailyProteinG??'';
 form.elements.origin.value=current?.origin??'manual';form.elements.method.value=current?.method??'';
 const preview=document.createElement('div'),status=document.createElement('p');status.setAttribute('role','status');
 const estimate=document.createElement('details'),estimateTitle=document.createElement('summary');estimateTitle.textContent='Estimer mes besoins quotidiens';estimate.append(estimateTitle);
 const estimator=document.createElement('form');estimator.className='profile-entry';
 estimator.innerHTML='<p>Estimation générale de maintien pour adulte, issue de Mifflin–St Jeor. L’activité choisie influence fortement le résultat. En cas de grossesse, allaitement, chirurgie bariatrique ou situation médicale particulière, privilégie la cible de ton professionnel.</p><label>Paramètre sexué de la formule<select name="sex" required><option value="">Choisir explicitement</option><option value="female">Féminin (−161)</option><option value="male">Masculin (+5)</option></select></label><label>Niveau d’activité quotidien<select name="pal" required><option value="">Choisir</option><option value="1.4">Peu actif / sédentaire · ×1,4</option><option value="1.6">Modérément actif · ×1,6</option><option value="1.8">Actif · ×1,8</option><option value="2">Très actif · ×2</option></select></label><button type="submit" class="secondary">Calculer une estimation</button>';
 const estimateResult=document.createElement('div');
 estimator.addEventListener('submit',event=>{event.preventDefault();estimateResult.replaceChildren();const date=form.elements.effectiveFrom.value,profile=effectiveDatedEntry(person.profileHistory,date),weight=(person.weightHistory??[]).find(row=>row.measuredOn<=date);const result=estimateDailyEnergy({birthDate:person.birthDate,date,weightKg:weight?.weightKg,heightCm:profile?.heightCm,...Object.fromEntries(new FormData(estimator))});
  const text=document.createElement('p');if(result.error){text.textContent=result.error;estimateResult.append(text);return;}
  text.textContent=`Au ${date} : ${result.age} ans, ${result.weightKg} kg mesurés le ${weight.measuredOn}, ${result.heightCm} cm. Repos estimé : ${result.restingKcal} kcal/j ; maintien estimé : ${result.maintenanceKcal} kcal/j. La cible reste à choisir et valider.`;
  const use=document.createElement('button');use.type='button';use.textContent='Utiliser comme proposition de cible';use.addEventListener('click',()=>{form.elements.dailyEnergyKcal.value=result.maintenanceKcal;form.elements.origin.value='estimate';form.elements.method.value=JSON.stringify({...result,measuredOn:weight.measuredOn});preview.replaceChildren();});
  const source=document.createElement('a');source.href='https://pubmed.ncbi.nlm.nih.gov/2305711/';source.target='_blank';source.rel='noopener';source.textContent='Source de la formule';estimateResult.append(text,source,use);
 });estimate.append(estimator,estimateResult);block.append(estimate);
 form.addEventListener('input',()=>preview.replaceChildren());
 form.addEventListener('submit',event=>{event.preventDefault();preview.replaceChildren();status.textContent='';const data=Object.fromEntries(new FormData(form));
  const text=document.createElement('p');text.textContent=`À partir du ${data.effectiveFrom} : ${data.dailyEnergyKcal} kcal/j (cible actuelle : ${current?.dailyEnergyKcal??'non renseignée'}) et ${data.dailyProteinG||'aucun'} g de minimum protéique. Les repas existants gardent leurs quantités. Les versions précédentes restent conservées.`;
  const confirm=document.createElement('button');confirm.type='button';confirm.textContent='Valider cette cible';
  confirm.addEventListener('click',async()=>{confirm.disabled=true;try{await api('/api/people/'+person.id+'/nutrition-targets',{method:'POST',body:JSON.stringify({householdId,...data,confirmed:true})});await onSaved();}catch(error){status.textContent=error.body?.error??error.message;confirm.disabled=false;}});preview.append(text,confirm);
 });
 block.append(form,preview,status);
 if(review.due&&current){const keep=document.createElement('button');keep.type='button';keep.className='secondary';keep.textContent='Confirmer le maintien de ma cible actuelle';keep.addEventListener('click',async()=>{keep.disabled=true;try{await api('/api/people/'+person.id+'/nutrition-targets',{method:'POST',body:JSON.stringify({householdId,effectiveFrom:today,dailyEnergyKcal:current.dailyEnergyKcal,dailyProteinG:current.dailyProteinG,origin:current.origin,method:current.method,confirmed:true})});await onSaved();}catch(error){status.textContent=error.body?.error??error.message;keep.disabled=false;}});block.append(keep);}
 const history=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Historique des cibles et validations';history.append(summary);
 for(const entry of person.nutritionTargetHistory??[]){const row=document.createElement('p');row.textContent=`${entry.effectiveFrom} · ${entry.dailyEnergyKcal} kcal/j · protéines ${entry.dailyProteinG??'non renseignées'} g · ${entry.origin} · ${entry.method||'sans note'} · révision ${entry.revisionOrder}${entry.effectiveFrom>today?' · futur':''}`;history.append(row);}
 block.append(history);parent.append(block);return block;
}
