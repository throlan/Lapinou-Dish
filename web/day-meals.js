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

export function fitsDayExtra(target, used, incomplete, extra) {
  return target != null && !incomplete && Number.isFinite(used) &&
    Number.isFinite(extra) && extra >= 0 && used + extra <= target + 1e-6;
}

export function expandDayMealPortions(meals, { targets, used, incomplete, energy, propose }) {
  for (const meal of meals) {
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
