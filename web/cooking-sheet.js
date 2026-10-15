export function groupPreparations(items) {
  const groups = new Map();
  for (const item of items) {
    const id = item.parentRecipeId ?? item.recipeId;
    if (!groups.has(id)) groups.set(id, { recipeId: id, parts: [] });
    groups.get(id).parts.push(item);
  }
  return [...groups.values()];
}

export function suggestedProductionQuantity(group, recipe) {
  if (!recipe?.yield?.amount) return 0;
  const needed = Math.max(0, ...group.parts.map(part =>
    Number(part.yieldAmount) > 0
      ? Number(part.toMakeQuantity) / Number(part.yieldAmount) * Number(recipe.yield.amount)
      : 0));
  if (needed <= 0) return 0;
  return ['g', 'ml'].includes(recipe.yield.unitId)
    ? Math.ceil(needed * 100) / 100
    : Math.ceil(needed);
}

export function scaledIngredients(recipe, quantity) {
  const factor = Number(quantity) / Number(recipe.yield.amount);
  return (recipe.lines ?? []).map(line => ({ ...line, scaledQuantity: Number(line.quantity) * factor }));
}
