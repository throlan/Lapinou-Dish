import {cookingPeriod,planningPeriod,shiftPlanningDate,validPlanningDate} from './planning-periods.js';
const names={breakfast:'Petit-déjeuner',lunch:'Déjeuner',snack:'Collation après-midi',dinner:'Dîner'};
const node=(tag,text,className)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(className)n.className=className;return n;};
const label=(text,input)=>{const l=node('label',text);l.append(input);return l;};
const display=date=>new Date(date+'T12:00:00Z').toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short',timeZone:'UTC'});
function modal(title){
 const d=node('dialog',null,'recipe-planning-dialog'),form=node('form'),heading=node('h2',title),body=node('div',null,'recipe-planning-body'),actions=node('div',null,'form-actions'),cancel=node('button','Annuler','secondary'),submit=node('button',null,'primary'),message=node('p',null,'form-message');
 cancel.type='button';cancel.addEventListener('click',()=>d.close());submit.type='submit';actions.append(cancel,submit);message.setAttribute('role','status');form.append(heading,body,message,actions);d.append(form);document.body.append(d);let busy=false;
 d.addEventListener('cancel',event=>{if(busy)event.preventDefault();});d.addEventListener('close',()=>d.remove());
 return {d,form,body,message,submit,busy(value){busy=value;body.inert=value;submit.disabled=cancel.disabled=value;}};
}
export function mealCookingRecipes(meal,recipes){
 const found=new Map();for(const item of meal.items??[]){if(!item.recipe)continue;const id=item.recipe.parentRecipeId??item.recipeId;
  if(!found.has(id))found.set(id,recipes.find(r=>r.id===id)??{id,name:item.recipe.parentRecipeName??item.recipe.name});
 }return [...found.values()];
}
export function createRecipePlanning({api,getHousehold,getAdditions,onPlan,onCook,onCopied}){
 async function browse(recipe,today){
  const ui=modal('Ajouter au planning · '+recipe.name),start=node('input'),end=node('input'),period=node('select'),slot=node('select'),dates=node('fieldset',null,'planning-slot-choices'),range=node('div',null,'recipe-planning-range');
  period.setAttribute('aria-label','Période de planification');for(const [id,text] of [['week','Cette semaine'],['next-week','La semaine prochaine'],['next-fortnight','Les deux prochaines semaines'],['month','Ce mois'],['custom','Autres dates']])period.add(new Option(text,id));
  start.type=end.type='date';start.required=end.required=true;Object.assign(start,{value:planningPeriod(today,'week').start});end.value=planningPeriod(today,'week').end;
  slot.setAttribute('aria-label','Moment du repas');for(const [id,text] of Object.entries(names))if(!recipe.mealMoments?.length||recipe.mealMoments.includes(id))slot.add(new Option(text,id));
  range.append(label('Du',start),label('Au',end));ui.body.append(node('p','Choisis un ou plusieurs créneaux libres. Vérifie ensuite une seule fois les personnes, quantités et compléments : le même repas sera ajouté à chaque créneau coché.'),label('Période',period),range,label('Moment du repas',slot),dates);
  const companions=node('fieldset',null,'recipe-planning-companions');companions.append(node('legend','Compléter ce repas ? · facultatif'));
  const choices=[{id:'main',label:'Un autre plat'},...getAdditions().map(c=>({id:c.id,label:c.label}))];
  for(const choice of choices){const check=node('input');check.type='checkbox';check.value=choice.id;check.name='companion';companions.append(label(choice.label,check));}
  companions.append(node('small','Les cases ajoutent des lignes de choix. Aucun complément n’est sélectionné automatiquement.'));ui.body.append(companions);ui.submit.textContent='Vérifier le repas';
  let slots=[],sequence=0;const selected=()=>[...dates.querySelectorAll('input:checked')].map(i=>slots[Number(i.value)]);
  function selection(){const count=selected().length;ui.submit.disabled=!count;ui.message.textContent=count?count+' créneau(x) sélectionné(s). Les quantités vérifiées seront identiques sur chaque date.':'Coche au moins un créneau libre.';}
  async function load(){const seq=++sequence;ui.submit.disabled=true;dates.replaceChildren(node('legend','Dates disponibles'));
   if(!validPlanningDate(start.value)||!validPlanningDate(end.value)||end.value<start.value){ui.message.textContent='Choisis une plage de dates valide.';return;}
   ui.message.textContent='Recherche des créneaux libres…';try{const data=await api('/api/planning/available-slots?householdId='+encodeURIComponent(getHousehold().id)+'&startDate='+start.value+'&endDate='+end.value);if(seq!==sequence||!ui.d.isConnected)return;
    slots=data.slots.filter(s=>s.slot===slot.value);for(const [i,s] of slots.entries()){const check=node('input');check.type='checkbox';check.value=String(i);check.checked=i===0;check.addEventListener('change',selection);dates.append(label(display(s.date)+' · '+names[s.slot],check));}
    if(!slots.length){dates.append(node('p','Aucun créneau libre pour ce moment sur cette période.'));ui.message.textContent='Change le moment du repas ou la période.';}else selection();
   }catch{if(seq===sequence)ui.message.textContent='Créneaux indisponibles. Vérifie la période (63 jours maximum) et réessaie.';}
  }
  period.addEventListener('change',()=>{if(period.value==='custom')return;const p=planningPeriod(today,period.value);start.value=p.start;end.value=p.end;void load();});
  for(const input of [start,end])input.addEventListener('change',()=>{period.value='custom';void load();});slot.addEventListener('change',load);
  ui.form.addEventListener('submit',async event=>{event.preventDefault();const targets=selected();if(!targets.length)return;ui.busy(true);
   try{const result=await onPlan(recipe,targets[0],[...companions.querySelectorAll('input:checked')].map(i=>i.value),targets);if(result!==false)ui.d.close();else ui.busy(false);}
   catch{ui.message.textContent='Impossible d’ouvrir ce repas. Aucun menu n’a été modifié.';ui.busy(false);}
  });ui.d.showModal();await load();
 }
 function copyPeriod(sourceStart,days){
  const ui=modal(days===7?'Dupliquer une semaine':'Dupliquer une journée'),source=node('input'),target=node('input'),preview=node('div',null,'cooking-scope-summary');source.type=target.type='date';source.required=target.required=true;source.value=sourceStart;target.value=shiftPlanningDate(sourceStart,days===7?7:1);
  const range=node('div',null,'recipe-planning-range');range.append(label(days===7?'Semaine source (lundi)':'Journée source',source),label(days===7?'Semaine cible (lundi)':'Journée cible',target));
  ui.body.append(range,node('p','Les recettes, variantes, personnes, quantités et compléments sont copiés à l’identique. Les copies restent à préparer : aucun stock consommé, avis ou état préparé n’est copié.'),preview);ui.submit.textContent='Créer les copies';let loaded=null,sequence=0,requestId=crypto.randomUUID();
  async function load(){const seq=++sequence;loaded=null;requestId=crypto.randomUUID();ui.submit.disabled=true;preview.textContent='Vérification des repas et des créneaux…';ui.message.textContent='';
   if(days===7){if(validPlanningDate(source.value))source.value=cookingPeriod(source.value,'week').start;if(validPlanningDate(target.value))target.value=cookingPeriod(target.value,'week').start;}
   try{const data=await api('/api/planning/copy-preview',{method:'POST',body:JSON.stringify({householdId:getHousehold().id,sourceStart:source.value,targetStart:target.value,days})});if(seq!==sequence||!ui.d.isConnected)return;loaded=data;preview.replaceChildren(node('strong',data.meals.length+' repas à copier'));
    for(const m of data.meals)preview.append(node('p',display(m.sourceDate)+' → '+display(m.date)+' · '+(names[m.slot]??m.slot)+' · '+m.peopleCount+' personne(s) · '+m.recipeCount+' élément(s) · '+m.recipeNames.join(', ')));
    if(data.conflicts.length){ui.message.textContent='Créneaux déjà occupés : '+data.conflicts.map(c=>display(c.date)+' · '+(names[c.slot]??c.slot)).join(', ')+'. Choisis une autre destination. Aucun repas ne sera écrasé.';}
    else if(!data.meals.length)ui.message.textContent='La période source ne contient aucun repas.';else ui.submit.disabled=false;
   }catch(error){if(seq===sequence)preview.textContent=error.body?.error==='copy-periods-overlap'?'Choisis des périodes distinctes.':'Impossible de préparer la copie. Vérifie les dates et réessaie.';}
  }
  source.addEventListener('change',load);target.addEventListener('change',load);ui.form.addEventListener('submit',async event=>{event.preventDefault();if(!loaded||ui.submit.disabled)return;ui.busy(true);
   try{const result=await api('/api/planning/copy',{method:'POST',body:JSON.stringify({householdId:getHousehold().id,sourceStart:loaded.sourceStart,targetStart:loaded.targetStart,days,fingerprint:loaded.fingerprint,requestId})});ui.d.close();await onCopied?.(loaded.targetStart,result.mealIds.length);}
   catch(error){ui.busy(false);if(['copy-source-changed','planning-slot-unavailable'].includes(error.body?.error)){await load();ui.message.textContent='Le planning a changé. Vérifie le nouvel aperçu avant de confirmer.';}else ui.message.textContent='Copies non confirmées. Réessaie sans changer les dates : aucun doublon ne sera créé.';}
  });ui.d.showModal();void load();
 }

 function cook(meal,recipes){
  const roots=mealCookingRecipes(meal,recipes);if(!roots.length)return;
  const ui=modal('Cuisiner depuis le calendrier'),recipe=node('select'),scope=node('select'),summary=node('div',null,'cooking-scope-summary');recipe.setAttribute('aria-label','Recette à cuisiner');scope.setAttribute('aria-label','Période à cuisiner');
  for(const r of roots)recipe.add(new Option(r.name,r.id));for(const [id,text] of [['meal','Ce repas uniquement'],['week','Cette semaine'],['fortnight','Cette semaine et la suivante'],['month','Ce mois']])scope.add(new Option(text,id));
  ui.body.append(label('Recette',recipe),label('Préparer pour',scope),summary,node('small','Seules les quantités de cette recette, dans cette combinaison, sont regroupées. Le stock disponible et les lots minimums sont pris en compte. La liste de courses conserve sa période.'));ui.submit.textContent='Ouvrir la fiche Cuisiner';let loaded=null,sequence=0;
  async function load(){const seq=++sequence;loaded=null;ui.submit.disabled=true;ui.message.textContent='Calcul des besoins…';const period=cookingPeriod(meal.mealDate,scope.value);summary.textContent='Du '+display(period.start)+' au '+display(period.end);
   try{const result=await api('/api/planning/meals/'+meal.id+'/cooking?householdId='+encodeURIComponent(getHousehold().id)+'&recipeId='+recipe.value+'&scope='+scope.value);if(seq!==sequence||!ui.d.isConnected)return;loaded=result;
    const parts=result.preparations;summary.replaceChildren(node('p','Du '+display(result.period.start)+' au '+display(result.period.end)+' · '+result.mealCount+' repas concerné(s)'));
    for(const part of parts){const unit={portion:'portions',piece:'pièces',slice:'tranches'}[part.unitId]??part.unitId;summary.append(node('p',part.name+' · Prévu : '+Number(part.plannedQuantity).toLocaleString('fr-FR')+' '+unit+' · couvert par le stock : '+Number(part.coveredQuantity).toLocaleString('fr-FR')+' → à préparer : '+Number(part.toMakeQuantity).toLocaleString('fr-FR')+' '+unit));}
    ui.message.textContent=parts.some(p=>p.toMakeQuantity>0)?'Les ingrédients suivront les quantités à préparer.':'Aucun besoin restant sur cette sélection : repas déjà préparés ou quantités couvertes par le stock.';ui.submit.disabled=false;
   }catch{if(seq===sequence)ui.message.textContent='Impossible de calculer les besoins. Aucun stock ni menu n’a été modifié.';}
  }
  recipe.addEventListener('change',load);scope.addEventListener('change',load);ui.form.addEventListener('submit',event=>{event.preventDefault();if(!loaded)return;ui.d.close();onCook(loaded);});ui.d.showModal();void load();
 }
 return {browse,cook,copyPeriod};
}
