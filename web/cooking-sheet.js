export function groupPreparations(items) {
  const groups = new Map();
  for (const item of items) {
    const id = item.parentRecipeId ?? item.recipeId;
    if (!groups.has(id)) groups.set(id, { recipeId: id, parts: [] });
    groups.get(id).parts.push(item);
  }
  return [...groups.values()];
}

// A preparation served together has one gram yield, even when the source
// recipe was entered as four portions or 24 pieces. Cook and stock that same
// gram preparation instead of rounding back to whole source portions.
export function productionRecipe(recipe) {
  const parts = recipe?.servingParts ?? [];
  return parts.length === 1 && ['g', 'ml'].includes(parts[0].yield?.unitId)
    ? parts[0] : recipe;
}

export function suggestedProductionQuantity(group, recipe) {
  const target = productionRecipe(recipe);
  if (!target?.yield?.amount) return 0;
  const needed = Math.max(0, ...group.parts.map(part =>
    Number(part.yieldAmount) > 0
      ? Number(part.toMakeQuantity) / Number(part.yieldAmount) * Number(target.yield.amount)
      : 0));
  if (needed <= 0) return 0;
  return ['g', 'ml'].includes(target.yield.unitId)
    ? Math.ceil(Number(needed.toFixed(8)) * 1000) / 1000
    : Math.ceil(needed);
}

export function scaledIngredients(recipe, quantity) {
  const factor = Number(quantity) / Number(productionRecipe(recipe).yield.amount);
  return (recipe.lines ?? []).map(line => ({ ...line, scaledQuantity: Number(line.quantity) * factor }));
}
