import {MEAL_LABELS} from './meal-config.js';
const node=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
export function createRecipeReplacements({api,getHousehold,onApplied}){
 return async function open(recipe,start,end){
  const dialog=node('dialog'),form=node('form'),body=node('div'),actions=node('div'),title=node('h2','Actualiser les repas à préparer'),message=node('p'),close=node('button','Annuler'),save=node('button','Actualiser les repas');
  dialog.className='choice-dialog';body.className='choice-dialog-body';actions.className='form-actions';message.setAttribute('role','status');message.className='form-message';close.type='button';close.className='secondary';save.type='submit';save.className='primary';save.disabled=true;actions.append(close,save);form.append(title,body,message,actions);dialog.append(form);document.body.append(dialog);
  let busy=false,preview=null;const fields=new Map();close.onclick=()=>dialog.close();dialog.oncancel=e=>{if(busy)e.preventDefault();};dialog.onclose=()=>dialog.remove();dialog.showModal();body.textContent='Recherche des repas…';
  try{preview=await api('/api/recipes/'+recipe.id+'/replacement?householdId='+encodeURIComponent(getHousehold().id)+'&start='+start+'&end='+end);if(!dialog.isConnected)return;
   body.replaceChildren(node('p',preview.source.name+' → '+preview.target.name),node('p','Période : '+start+' au '+end+'. Seuls les repas non préparés sont actualisés. Les personnes, dates et autres recettes sont conservées. Vérifie les quantités ; si les unités changent sans équivalence déclarée, renseigne-les manuellement.'));
   for(const meal of preview.meals){const box=node('fieldset');box.append(node('legend',meal.date+' · '+(MEAL_LABELS[meal.slot]??meal.slot)));
    if(meal.blocked){box.append(node('p','Le découpage de cette recette a changé. Ce repas reste inchangé : ouvre-le dans le calendrier pour choisir ses nouvelles parties.'));}
    else for(const change of preview.changes.filter(c=>c.mealId===meal.id)){const label=node('label',change.personName+' · avant : '+change.before+' '+change.oldUnit+' → nouvelle quantité ('+change.newUnit+')'),input=node('input');input.type='number';input.required=true;input.min='0.00001';input.max='100000';input.step='any';if(change.proposed!=null)input.value=String(change.proposed);else input.placeholder='À renseigner';input.setAttribute('aria-label','Nouvelle quantité pour '+change.personName+' le '+meal.date+' '+meal.slot);label.append(input);box.append(label);fields.set(change.key,input);}
    body.append(box);
   }
   if(preview.protectedMeals)body.append(node('p',preview.protectedMeals+' repas déjà préparé(s) ou utilisé(s) conservé(s).'));
   const count=preview.meals.filter(m=>!m.blocked).length;save.textContent='Actualiser '+count+' repas';save.disabled=!count;if(!count)message.textContent='Aucun repas compatible à actualiser sur cette période.';
  }catch{body.textContent='Impossible de charger les repas à actualiser. Aucun changement effectué.';}
  form.onsubmit=async event=>{event.preventDefault();if(busy||save.disabled||!form.reportValidity())return;busy=true;save.disabled=close.disabled=true;body.inert=true;
   try{const result=await api('/api/recipes/'+recipe.id+'/replacement/apply',{method:'POST',body:JSON.stringify({householdId:getHousehold().id,start,end,token:preview.token,quantities:Object.fromEntries([...fields].map(([id,input])=>[id,Number(input.value)]))})});dialog.close();await onApplied(result.updated);}
   catch(error){busy=false;body.inert=false;close.disabled=false;message.textContent=error.body?.error==='replacement-preview-stale'?'Le planning ou la recette a changé. Ferme puis rouvre cet aperçu avant de confirmer.':'Actualisation non confirmée. Ferme puis rouvre cet aperçu pour vérifier les repas. Aucun changement partiel n’est conservé.';}
  };
 };
}
