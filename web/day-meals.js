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
  const incomplete = nutrition.lineIssues?.some(issue => issue.reason !== 'nutrient-data-missing') ?? false;
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
  return sumMacros(parts.map(part => part[key]));
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
