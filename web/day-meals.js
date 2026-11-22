export function homeBudgetShare(meals, personId, date, ratios) {
  let share = 1;
  for (const slot of ['lunch', 'dinner']) {
    const planned = meals.filter(meal => meal.mealDate === date && meal.slot === slot);
    if (planned.length && planned.every(meal => Array.isArray(meal.attendees) &&
      !meal.attendees.some(person => person.id === personId))) {
      share -= ratios[slot] ?? 0;
    }
  }
  return Math.max(0, share);
}

export function itemMacro(item, personId, key) {
  const amount = item.amounts?.find(entry => entry.personId === personId);
  if (!(amount?.quantity > 0)) return null;
  const nutrition = item.recipe?.nutrition;
  const value = nutrition?.perYieldUnit?.[key];
  if (value == null || !Number.isFinite(Number(value))) return {grams:null, incomplete:true};
  const incomplete = key === 'energyKcal' && typeof item.recipe.energyKnown === 'boolean'
    ? !item.recipe.energyKnown
    : nutrition.lineIssues?.some(issue => issue.reason !== 'nutrient-data-missing' || issue.missingNutrients?.includes(key)) ?? false;
  return {grams:Number(value) * Number(amount.quantity), incomplete};
}

function sumMacros(amounts) {
  const known = amounts.filter(amount => amount.grams != null);
  return {grams:known.length ? known.reduce((sum, amount) => sum + amount.grams, 0) : null,
    incomplete:amounts.some(amount => amount.incomplete)};
}

export function plannedMacro(meals, personId, date, key) {
  const amounts = [];
  for (const meal of meals.filter(entry => entry.mealDate === date)) {
    if (meal.isOccasion && meal.attendees?.some(person => person.id === personId)) amounts.push({grams:null, incomplete:true});
    for (const item of meal.items ?? []) {
      const amount = itemMacro(item, personId, key);
      if (amount) amounts.push(amount);
    }
  }
  return sumMacros(amounts);
}

export function consumptionParts(meals, personId, date) {
  return meals.filter(meal => meal.mealDate === date && !meal.isOccasion &&
    meal.attendees?.some(person => person.id === personId)).flatMap(meal =>
    (meal.items ?? []).flatMap(item => {
      const amount = item.amounts?.find(entry => entry.personId === personId);
      if (!(amount?.quantity > 0) || !item.id) return [];
      return [{mealId:meal.id, itemId:item.id, slot:meal.slot, name:item.recipe?.name ?? 'Recette supprimée',
        quantity:amount.quantity, unitId:item.recipe?.yield?.unitId ?? null, item}];
    }));
}

export function confirmedMacro(parts, key) {
  if (!parts.length) return {grams:0, incomplete:false};
  return sumMacros(parts.map(part => part[key] ?? {grams:null, incomplete:true}));
}

export const CONSUMPTION_NUTRIENTS = Object.freeze({
  energy:'energyKcal', protein:'proteinG', carbohydrate:'carbohydrateG', fat:'fatG', fibre:'fibreG',
});

export function homeConsumptionTotals(parts) {
  return Object.fromEntries(Object.keys(CONSUMPTION_NUTRIENTS).map(key => [key,confirmedMacro(parts,key)]));
}

export function consumptionSelections(parts) {
  return parts.map(({mealId,itemId}) => ({mealId,itemId}));
}

export function preparationStockLabel(recipe, stock, quantityLabel) {
  const parts = recipe.servingParts?.length ? recipe.servingParts : [recipe];
  const tracked = parts.filter(part => part.productionType && part.productionType !== 'none');
  if (!tracked.length) return '';
  return tracked.map(part => {
    const available = stock.get(part.id);
    const quantity = available ? quantityLabel(available.quantity, available.unitId) : 'à préparer';
    if (parts.length === 1) return available ? 'stock libre '+quantity : quantity;
    const label = {main:'Plat', starch:'Féculents', vegetables:'Légumes'}[part.servingPart] ?? part.name;
    return label+' '+(available ? quantity+' libres' : quantity);
  }).join(' / ');
}

export function findDayRecipes(recipes,query) {
  const normalize = value => value.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('fr');
  const words = normalize(query).trim().split(/\s+/);
  return recipes.filter(({name})=>{
    const title=normalize(name);
    return words.every(word=>title.includes(word));
  });
}

export function createDayRecipePicker(slot,label,recipes,onChange,quantityLabel) {
  const element=document.createElement('div'), input=document.createElement('input'), list=document.createElement('ul');
  element.className='day-recipe-picker';
  list.className='day-recipe-options';
  list.id='day-recipes-'+slot;
  list.setAttribute('role','listbox');
  list.setAttribute('aria-label',label);
  input.type='search';input.autocomplete='off';input.placeholder='Rechercher un plat principal…';
  input.setAttribute('role','combobox');
  input.setAttribute('aria-label',label);
  input.setAttribute('aria-autocomplete','list');
  input.setAttribute('aria-controls',list.id);
  element.append(input,list);
  let selected=null, stock=null, options=[], active=-1, query='';

  function close() {
    list.hidden=true;
    input.setAttribute('aria-expanded','false');
    input.removeAttribute('aria-activedescendant');
    input.value=selected?.name??'';
  }
  function choose(recipe) {
    if(input.disabled)return;
    setSelection(recipe);
    onChange(recipe);
  }
  function setSelection(recipe) {
    selected=recipe;
    close();
  }
  function activate(index) {
    active=index;
    options.forEach(({node},i)=>node.classList.toggle('is-active',i===active));
    if(active<0)input.removeAttribute('aria-activedescendant');
    else {
      input.setAttribute('aria-activedescendant',options[active].node.id);
      options[active].node.scrollIntoView({block:'nearest'});
    }
  }
  function show() {
    const results=findDayRecipes(recipes,query);
    const clear=selected?[{recipe:null,label:'Retirer le plat'}]:[];
    const matches=results.map(recipe=>({recipe,label:recipe.name}));
    if(query)matches.push(...clear);
    else matches.unshift(...clear);
    options=matches.map(({recipe,label},i)=>{
      const node=document.createElement('li');node.id=list.id+'-'+i;
      node.setAttribute('role','option');
      node.setAttribute('aria-selected',String(Boolean(recipe&&recipe.id===selected?.id)));
      node.textContent=label;
      const detail=recipe&&stock?preparationStockLabel(recipe,stock,quantityLabel):'';
      if(detail){const note=document.createElement('small');note.textContent=detail;node.append(note);}
      node.addEventListener('pointerdown',event=>event.preventDefault());
      node.addEventListener('click',()=>choose(recipe));
      return {node,recipe};
    });
    list.replaceChildren(...options.map(option=>option.node));
    if(!results.length){
      const empty=document.createElement('li');empty.setAttribute('role','presentation');empty.textContent='Aucun plat trouvé.';
      list.prepend(empty);
    }
    list.hidden=false;
    input.setAttribute('aria-expanded','true');
    activate(-1);
  }
  close();
  const open=()=>{query='';show();};
  input.addEventListener('focus',open);
  input.addEventListener('click',()=>{if(list.hidden)open();});
  input.addEventListener('input',()=>{query=input.value;show();});
  input.addEventListener('blur',close);
  input.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&!list.hidden){event.preventDefault();close();return;}
    if(event.key==='Enter'){
      event.preventDefault();
      const option=active>=0?options[active]:options.find(entry=>entry.recipe);
      if(!list.hidden&&option)choose(option.recipe);
      return;
    }
    if(!['ArrowDown','ArrowUp'].includes(event.key))return;
    event.preventDefault();
    if(list.hidden)open();
    if(!options.length)return;
    const next=event.key==='ArrowDown'?Math.min(active+1,options.length-1):active<0?options.length-1:Math.max(active-1,0);
    activate(next);
  });
  return {element,get value(){return selected?.id??'';},setSelection,setStock(value){stock=value;if(!list.hidden)show();}};
}

export function fitsDayExtra(target, used, incomplete, extra) {
  return target != null && !incomplete && Number.isFinite(used) &&
    Number.isFinite(extra) && extra >= 0 && used + extra <= target + 1e-6;
}

export function expandDayMealPortions(meals, { targets, used, incomplete, energy, propose }) {
  for (const meal of meals) {
    if (meal.slot !== 'lunch' && meal.slot !== 'dinner') continue;
    for (const personId of meal.attendeeIds) {
      const balance = targets.get(personId) - used.get(personId);
      if (incomplete.has(personId) || !(balance > 1e-6)) continue;
      const current = meal.items.map(item => item.amounts.find(amount => amount.personId === personId));
      const kcal = meal.items.map(energy);
      if (current.some(amount => !(amount?.quantity > 0)) || kcal.some(value => !Number.isFinite(value))) continue;
      const before = current.reduce((sum, amount, i) => sum + amount.quantity * kcal[i], 0);
      let budget = before + balance;
      for (let attempt = 0; attempt < 2; attempt++) {
        const quantities = propose(meal, personId, budget);
        if (quantities.length !== current.length ||
            quantities.some((quantity, i) => !Number.isFinite(quantity) || quantity < current[i].quantity)) break;
        const added = quantities.reduce((sum, quantity, i) => sum + (quantity - current[i].quantity) * kcal[i], 0);
        if (added <= 1e-6) break;
        if (added > balance + 1e-6) {
          budget -= added - balance + 1e-6;
          continue;
        }
        current.forEach((amount, i) => { amount.quantity = quantities[i]; });
        used.set(personId, used.get(personId) + added);
        break;
      }
    }
  }
}
