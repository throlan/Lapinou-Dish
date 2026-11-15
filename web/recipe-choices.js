import {recipeEnergyBadge} from './recipe-directory.js';
const node=(tag,text,className)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(className)n.className=className;return n;};
const units=[['g','g'],['kg','kg'],['ml','ml'],['l','l'],['piece','pièce'],['slice','tranche'],['portion','portion'],['tsp','c. à café'],['tbsp','c. à soupe'],['cup','tasse'],['pinch','pincée'],['scoop','scoop']];
const control=(caption,input)=>{const label=node('label',caption);label.append(input);return label;};
const button=(text,action)=>{const b=node('button',text,'secondary');b.type='button';b.addEventListener('click',action);return b;};

export function createRecipeChoices({api,getHousehold,getAccount,onFood}){
 let lists=[];
 const listUrl=()=>'/api/recipe-choice-lists?householdId='+encodeURIComponent(getHousehold().id);
 async function refresh(){lists=(await api(listUrl())).lists;return lists;}
 const curator=()=>getAccount()?.applicationAdmin||getAccount()?.role==='manager';
 function dialog(title){
  const d=node('dialog',null,'choice-dialog'),heading=node('h2',title),form=node('form'),body=node('div',null,'choice-dialog-body'),actions=node('div',null,'form-actions'),close=button('Fermer',()=>d.close());
  form.method='dialog';form.append(heading,body,actions);actions.append(close);d.append(form);document.body.append(d);
  d.addEventListener('close',()=>d.remove(),{once:true});return {d,form,body,actions,close};
 }
 async function manage(){
  const {d,body,actions}=dialog('Listes d’ingrédients réutilisables');
  body.append(node('p','Chaque choix référence un aliment du catalogue. Les quantités sont réglées ensuite dans chaque recette. Modifier une liste ne réécrit ni les recettes enregistrées ni les repas.'));
  const rows=node('div'),message=node('p',null,'form-message');body.append(rows,message);
  async function render(){
   try{await refresh();rows.replaceChildren();for(const list of lists){const row=node('article',null,'choice-library-row');row.append(node('strong',list.name),node('p',list.foods.map(f=>f.name).join(' · ')));
    if(curator())row.append(button('Modifier',()=>editList(list,render)),button('Archiver',async()=>{if(!confirm('Archiver cette liste ? Les recettes et repas existants seront conservés.'))return;try{await api('/api/recipe-choice-lists/'+list.id,{method:'DELETE',body:JSON.stringify({householdId:getHousehold().id,version:list.version})});await render();}catch{message.textContent='La liste a changé ou ne peut pas être archivée. Actualise avant de réessayer.';}}));rows.append(row);}
   if(!lists.length)rows.append(node('p','Aucune liste. Crée par exemple Fruits, Toppings, Protéines ou Légumineuses.'));
   }catch{message.textContent='Impossible de charger les listes.';}
  }
  if(curator())actions.prepend(button('+ Nouvelle liste',()=>editList(null,render)));
  d.showModal();await render();
 }
 function editList(list,onSaved){
  const {d,form,body,actions,close}=dialog(list?'Modifier la liste':'Nouvelle liste');close.textContent='Annuler';
  const name=node('input');name.required=true;name.maxLength=100;name.value=list?.name??'';
  const search=node('input');search.type='search';search.placeholder='Rechercher dans le catalogue alimentaire';search.setAttribute('aria-label','Rechercher un aliment pour la liste');
  const results=node('div',null,'choice-search-results'),selected=node('div',null,'choice-selected-foods'),message=node('p',null,'form-message');
  const foods=new Map((list?.foods??[]).map(f=>[f.id,f]));let request=0,timer;
  function render(){selected.replaceChildren(...[...foods.values()].map(food=>{const chip=button(food.name+' ×',()=>{foods.delete(food.id);render();});chip.setAttribute('aria-label','Retirer '+food.name);return chip;}));}
  search.addEventListener('input',()=>{clearTimeout(timer);const seq=++request;timer=setTimeout(async()=>{if(search.value.trim().length<2){results.replaceChildren();return;}try{const data=await api('/api/foods?q='+encodeURIComponent(search.value.trim())+'&limit=20');if(seq!==request)return;results.replaceChildren(...data.foods.filter(f=>!foods.has(f.id)).map(food=>button(food.name,()=>{if(foods.size>=50){message.textContent='50 aliments maximum par liste.';return;}foods.set(food.id,{id:food.id,name:food.name});render();results.replaceChildren();search.value='';search.focus();})));}catch{message.textContent='Catalogue indisponible.';}},180);});
  body.append(control('Nom de la liste',name),control('Ajouter des aliments du catalogue',search),results,selected,message);render();
  const save=node('button','Enregistrer la liste','primary');save.type='submit';actions.prepend(save);
  form.addEventListener('submit',async event=>{event.preventDefault();if(!foods.size){message.textContent='Sélectionne au moins un aliment du catalogue.';return;}save.disabled=true;try{await api('/api/recipe-choice-lists'+(list?'/'+list.id:''),{method:list?'PUT':'POST',body:JSON.stringify({householdId:getHousehold().id,name:name.value,foodIds:[...foods.keys()],...(list?{version:list.version}:{})})});d.close();await onSaved();}catch(error){message.textContent=error.body?.error==='choice-list-version-conflict'?'Cette liste a changé. Ferme puis rouvre-la avant de réessayer.':'Impossible d’enregistrer la liste : '+(error.body?.error??error.message);save.disabled=false;}});
  d.showModal();
 }

 function attach(row,initial){
  const details=node('details',null,'ingredient-choices'),summary=node('summary',initial?'Choix d’ingrédient · '+initial.label:'Proposer des variantes pour cet ingrédient');details.append(summary);
  const groupName=node('input');groupName.maxLength=100;groupName.placeholder='Ex. Saveur, Topping, Protéine';groupName.value=initial?.label??'';
  const listSelect=node('select');listSelect.setAttribute('aria-label','Liste de choix pour cet ingrédient');
  const allowNone=node('input');allowNone.type='checkbox';allowNone.checked=initial?.allowNone??false;
  const panel=node('div',null,'choice-option-grid'),message=node('p',null,'form-message');let group=initial?structuredClone(initial):null;
  const base=()=>({foodId:row.querySelector('[aria-label="Aliment lié"]').value,foodName:row.querySelector('[aria-label="Aliment lié"]').selectedOptions[0]?.textContent??'',quantity:Number(row.querySelector('[aria-label="Quantité"]').value),unitId:row.querySelector('[aria-label="Unité"]').value,cookingFactor:row.querySelector('[name=cookingFactor]').value===''?null:Number(row.querySelector('[name=cookingFactor]').value),cookingState:row.querySelector('[name=cookingState]').value||'legacy'});
  function renderOptions(){
   panel.replaceChildren();if(!group)return;
   for(const option of group.options){const line=node('div',null,'choice-option-row'),caption=node('strong',option.foodName||'Aliment du catalogue');
    const quantity=node('input');quantity.type='number';quantity.min='.001';quantity.max='100000';quantity.step='any';quantity.required=true;quantity.value=option.quantity;
    const unit=node('select');for(const [value,label] of units)unit.add(new Option(label,value));if(!units.some(([id])=>id===option.unitId))unit.add(new Option(option.unitId,option.unitId));unit.value=option.unitId;
    const state=node('select');for(const [value,label] of [['legacy','Calcul historique'],['served_raw','Servi cru'],['cooked_from_raw','Cuit ici · poids cru'],['already_cooked','Déjà cuit · poids cuit']])state.add(new Option(label,value));state.value=option.cookingState??'legacy';
    const defaults=option.foodId===base().foodId;if(defaults){quantity.disabled=unit.disabled=state.disabled=true;caption.append(node('small',' · valeur par défaut : ligne ci-dessus'));}
    const update=()=>Object.assign(option,{quantity:Number(quantity.value),unitId:unit.value,cookingState:state.value});for(const input of [quantity,unit,state])input.addEventListener('change',update);
    line.append(caption,control('Quantité',quantity),control('Unité',unit),control('État',state),button('Fiche aliment',()=>onFood?.(option.foodId)));panel.append(line);
   }
  }
  function populate(){const selected=group?.listId??listSelect.value;listSelect.replaceChildren(new Option('Aucune liste · ingrédient fixe',''),...lists.map(l=>new Option(l.name,l.id)));if(selected&&!lists.some(l=>l.id===selected))listSelect.add(new Option('Liste archivée · choix conservés',selected));listSelect.value=selected;}
  function applyList(){const list=lists.find(l=>l.id===listSelect.value);if(!list){if(!listSelect.value){group=null;panel.replaceChildren();summary.textContent='Proposer des variantes pour cet ingrédient';}return;}
   const original=base();if(!original.foodId){message.textContent='Sélectionne d’abord l’aliment de cette ligne.';return;}
   const prior=new Map((group?.options??[]).map(o=>[o.foodId,o]));const foods=[...list.foods];if(!foods.some(f=>f.id===original.foodId))foods.unshift({id:original.foodId,name:original.foodName});
   group={id:group?.id??crypto.randomUUID(),label:groupName.value.trim()||list.name,listId:list.id,options:foods.slice(0,50).map(f=>({...original,...prior.get(f.id),foodId:f.id,foodName:f.name}))};groupName.value=group.label;summary.textContent='Choix d’ingrédient · '+group.label;message.textContent='Les nouvelles options reprennent la quantité et l’unité de la ligne : vérifie-les pour le rendement de base. Le coefficient de cuisson provient de chaque fiche aliment selon l’état choisi. Les repas déjà enregistrés restent inchangés.';renderOptions();
  }
  listSelect.addEventListener('change',applyList);
  details.append(control('Liste réutilisable',listSelect),control('Nom du choix dans cette recette',groupName),control('Autoriser « Sans cet ingrédient »',allowNone),button('Actualiser les choix depuis la liste',async()=>{try{await refresh();populate();applyList();}catch{message.textContent='Impossible de charger les listes.';}}),panel,message);
  details.append(button('Retirer les variantes de cette ligne',()=>{group=null;listSelect.value='';groupName.value='';allowNone.checked=false;panel.replaceChildren();summary.textContent='Proposer des variantes pour cet ingrédient';}));
  if(curator())details.append(button('Créer ou modifier les listes',manage));
  details.addEventListener('toggle',async()=>{if(details.open){try{await refresh();populate();}catch{message.textContent='Listes indisponibles. Les choix enregistrés sont conservés.';}}});
  populate();renderOptions();row.append(details);
  row.recipeChoiceInput=()=>{
   if(!group)return null;const original=base();
   const options=group.options.map(o=>o.foodId===original.foodId?{...o,...original}:o);
   if(!options.some(o=>o.foodId===original.foodId))options.unshift(original);
   return {...group,label:groupName.value.trim()||group.label,allowNone:allowNone.checked,options};
  };
 }
 function serialize(rows){return rows.flatMap((row,lineIndex)=>{const group=row.recipeChoiceInput?.();return group?[{...group,lineIndex}]:[];});}

 function choose(recipe,initialSelection,{previewOnly=false}={}){
  if(!recipe?.choiceGroups?.length)return Promise.resolve(recipe);
  return new Promise(resolve=>{
   const {d,form,body,actions,close}=dialog((previewOnly?'Apports selon les choix · ':'Choisir la variante · ')+recipe.name);close.textContent=previewOnly?'Fermer':'Annuler';
   body.append(node('p',previewOnly?'Compare les combinaisons de cette recette enregistrée. Aucun repas ni aucune déclinaison ne sera créé.':'La même combinaison sera utilisée pour toutes les personnes du repas. Les ingrédients, apports et courses suivront ces choix.'));
   const selections=new Map();for(const group of recipe.choiceGroups){const select=node('select');select.required=true;select.setAttribute('aria-label',group.label);for(const option of group.options)select.add(new Option(option.foodName,option.foodId));if(group.allowNone)select.add(new Option('Sans cet ingrédient','none'));const prior=initialSelection?.[group.id];select.value=prior===null&&group.allowNone?'none':group.options.some(o=>o.foodId===prior)?prior:recipe.lines[group.lineIndex].foodId;selections.set(group.id,select);body.append(control(group.label,select));}
   const nutrition=node('section',null,'choice-nutrition-preview');nutrition.setAttribute('aria-live','polite');nutrition.setAttribute('aria-label','Apports de cette combinaison');
   const message=node('p',null,'form-message');message.setAttribute('role','status');body.append(nutrition,message);const submit=node('button','Utiliser cette combinaison','primary');submit.type='submit';if(!previewOnly)actions.prepend(submit);let settled=false,saving=false,sequence=0,loaded=false;
   const selection=()=>Object.fromEntries([...selections].map(([id,input])=>[id,input.value==='none'?null:input.value]));
   async function refreshPreview(){const seq=++sequence;loaded=false;submit.disabled=true;nutrition.textContent='Calcul des apports…';message.textContent='';
    try{const {preview}=await api('/api/recipes/'+recipe.id+'/choices/preview?householdId='+encodeURIComponent(getHousehold().id)+'&version='+recipe.version+'&selection='+encodeURIComponent(JSON.stringify(selection())));if(seq!==sequence||!d.isConnected)return;
     const display=variantNutritionValues(preview),format=value=>value==null?'—':Number(value).toLocaleString('fr-FR',{maximumFractionDigits:1});
     nutrition.replaceChildren(node('h3','Apports de cette combinaison'),node('p',preview.labels.join(' · '),'hint'),node('strong',format(display.values.energyKcal)+' kcal / '+display.label));
     if(display.badge)nutrition.append(node('span',format(display.badge.kcal)+' kcal / '+display.badge.label,'choice-energy-badge'));
     const macros=node('div',null,'choice-macros');for(const [key,label] of [['proteinG','Protéines'],['carbohydrateG','Glucides'],['fatG','Lipides'],['fibreG','Fibres']])macros.append(node('span',label+' : '+format(display.values[key])+' g'));nutrition.append(macros);
     if(!preview.nutrition.complete)nutrition.append(node('p','Données incomplètes : les valeurs inconnues restent indiquées par —. Vérifie les fiches alimentaires.','form-message'));
     nutrition.append(node('small','Selon les quantités, états et coefficients de cette recette. Les portions du calendrier seront ensuite adaptées aux profils.'));loaded=true;submit.disabled=false;
    }catch(error){if(seq!==sequence||!d.isConnected)return;nutrition.textContent='Apports indisponibles.';message.textContent=error.body?.error==='recipe-version-conflict'?'Cette recette a changé. Ferme puis rouvre-la pour revoir les choix.':'Impossible de calculer les apports. Change un choix ou réessaie.';nutrition.append(button('Réessayer',refreshPreview));}
   }
   for(const input of selections.values())input.addEventListener('change',refreshPreview);
   form.addEventListener('submit',async event=>{event.preventDefault();if(previewOnly||saving||!loaded)return;saving=true;submit.disabled=true;close.disabled=true;for(const input of selections.values())input.disabled=true;
    try{const {recipe:result}=await api('/api/recipes/'+recipe.id+'/choices/resolve',{method:'POST',body:JSON.stringify({householdId:getHousehold().id,version:recipe.version,selection:selection()})});settled=true;d.close();resolve(result);}
    catch(error){message.textContent=error.body?.error==='recipe-version-conflict'?'Cette recette a changé. Annule puis recommence pour revoir les choix.':'Combinaison non enregistrée : '+(error.body?.error??error.message);saving=false;submit.disabled=false;close.disabled=false;for(const input of selections.values())input.disabled=false;}
   });
   d.addEventListener('cancel',event=>{if(saving)event.preventDefault();});d.addEventListener('close',()=>{sequence++;if(!settled)resolve(null);});d.showModal();void refreshPreview();
  });
 }

 return {attach,serialize,manage,choose,compare:recipe=>choose(recipe,undefined,{previewOnly:true})};
}

export function variantNutritionValues(preview){
 const scale=['g','ml'].includes(preview.yield.unitId)?100:1,label=({g:'100 g',ml:'100 ml',piece:'pièce',slice:'tranche',portion:'portion'})[preview.yield.unitId]??preview.yield.unitId;
 const known=key=>key==='energyKcal'?preview.energyKnown!==false:!preview.nutrition.lineIssues?.some(issue=>issue.reason!=='nutrient-data-missing'||issue.missingNutrients?.includes(key));
 return {label,values:Object.fromEntries(['energyKcal','proteinG','carbohydrateG','fatG','fibreG'].map(key=>{const value=preview.nutrition.perYieldUnit[key];return [key,known(key)&&Number.isFinite(value)?value*scale:null];})),badge:recipeEnergyBadge(preview)};
}
