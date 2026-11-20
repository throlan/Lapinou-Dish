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

export function plannedMacro(meals, personId, date, key) {
  let grams = 0, known = false, incomplete = false;
  for (const meal of meals.filter(entry => entry.mealDate === date)) {
    if (meal.isOccasion && meal.attendees?.some(person => person.id === personId)) incomplete = true;
    for (const item of meal.items ?? []) {
      const amount = item.amounts?.find(entry => entry.personId === personId);
      if (!(amount?.quantity > 0)) continue;
      const value = item.recipe?.nutrition?.perYieldUnit?.[key];
      if (value == null || !Number.isFinite(Number(value))) incomplete = true;
      else { known = true; grams += Number(value) * Number(amount.quantity); }
    }
  }
  return {grams: known ? grams : null, incomplete};
}

export function fitsDayExtra(target, used, incomplete, extra) {
  return target != null && !incomplete && Number.isFinite(used) &&
    Number.isFinite(extra) && extra >= 0 && used + extra <= target + 1e-6;
}
