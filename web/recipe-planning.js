import {cookingPeriod,shiftPlanningDate,validPlanningDate} from './planning-periods.js';
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
export function createRecipePlanning({api,getHousehold,getAdditions,onPlan,onCook}){
 async function browse(recipe,today){
  const ui=modal('Ajouter au planning · '+recipe.name),start=node('input'),end=node('input'),slot=node('select'),range=node('div',null,'recipe-planning-range');
  start.type=end.type='date';start.required=end.required=true;start.value=today;end.value=shiftPlanningDate(today,13);slot.required=true;slot.setAttribute('aria-label','Créneau libre');
  range.append(label('Du',start),label('Au',end));ui.body.append(node('p','Choisis un créneau libre. Le repas sera ouvert pour vérifier les personnes, les portions et les compléments avant de l’enregistrer.'),range,label('Créneau disponible',slot));
  const companions=node('fieldset',null,'recipe-planning-companions');companions.append(node('legend','Compléter ce repas ? · facultatif'));
  const choices=[{id:'main',label:'Un autre plat'},...getAdditions().map(c=>({id:c.id,label:c.label}))];
  for(const choice of choices){const check=node('input');check.type='checkbox';check.value=choice.id;check.name='companion';companions.append(label(choice.label,check));}
  companions.append(node('small','Les cases ajoutent des lignes de choix. Aucune boisson, sauce ou recette supplémentaire n’est sélectionnée automatiquement.'));ui.body.append(companions);ui.submit.textContent='Vérifier le repas';
  let slots=[],sequence=0;
  async function load(){const seq=++sequence;ui.submit.disabled=true;slot.replaceChildren();if(!validPlanningDate(start.value)||!validPlanningDate(end.value)||end.value<start.value){ui.message.textContent='Choisis une plage de dates valide.';return;}
   ui.message.textContent='Recherche des créneaux libres…';try{const data=await api('/api/planning/available-slots?householdId='+encodeURIComponent(getHousehold().id)+'&startDate='+start.value+'&endDate='+end.value);if(seq!==sequence||!ui.d.isConnected)return;
    slots=data.slots.filter(s=>!recipe.mealMoments?.length||recipe.mealMoments.includes(s.slot));slot.replaceChildren(...slots.map((s,i)=>new Option(display(s.date)+' · '+names[s.slot],String(i))));
    ui.message.textContent=slots.length?slots.length+' créneau(x) libre(s) pour les moments adaptés à cette recette.':'Aucun créneau libre adapté à cette recette sur cette période.';ui.submit.disabled=!slots.length;
   }catch{if(seq===sequence)ui.message.textContent='Créneaux indisponibles. Vérifie la période (63 jours maximum) et réessaie.';}
  }
  start.addEventListener('change',load);end.addEventListener('change',load);
  ui.form.addEventListener('submit',async event=>{event.preventDefault();const selected=slots[Number(slot.value)];if(!selected)return;ui.busy(true);
   try{const result=await onPlan(recipe,selected,[...companions.querySelectorAll('input:checked')].map(i=>i.value));if(result!==false)ui.d.close();else ui.busy(false);}
   catch{ui.message.textContent='Impossible d’ouvrir ce repas. Aucun menu n’a été modifié.';ui.busy(false);}
  });ui.d.showModal();await load();
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
 return {browse,cook};
}
