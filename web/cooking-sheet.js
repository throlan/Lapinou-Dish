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

export function cookingYield(recipe) {
  return recipe?.servingParts?.length > 1
    ? {amount:recipe.servingParts.reduce((sum,part)=>sum+Number(part.yield.amount),0),unitId:'g'}
    : productionRecipe(recipe)?.yield;
}

const stockPrecision = quantity => Math.round(quantity * 1000) / 1000;

export function suggestedServingQuantities(group, recipe) {
  return (recipe.servingParts ?? []).map(part=>({recipeId:part.id,servingPart:part.servingPart,
    quantity:stockPrecision(Math.max(0,group?.parts.find(item=>item.recipeId===part.id)?.toMakeQuantity ?? 0))}));
}

export function suggestedProductionQuantity(group, recipe) {
  const target = cookingYield(recipe);
  if (!target?.amount) return 0;
  if (recipe.servingParts?.length > 1) return stockPrecision(suggestedServingQuantities(group,recipe).reduce((sum,part)=>sum+part.quantity,0));
  const needed = Math.max(0, ...group.parts.map(part =>
    Number(part.yieldAmount) > 0
      ? Number(part.toMakeQuantity) / Number(part.yieldAmount) * Number(target.amount)
      : 0));
  if (needed <= 0) return 0;
  return stockPrecision(needed);
}

export function scaledIngredients(recipe, quantity, servingQuantities) {
  const factor = Number(quantity) / Number(cookingYield(recipe).amount);
  return (recipe.lines ?? []).map(line => {
    const part=servingQuantities && recipe.servingParts?.find(part=>part.servingPart===(line.servingPart??'main'));
    const partFactor=servingQuantities ? Number(servingQuantities.find(item=>item.recipeId===part?.id)?.quantity??0)/Number(part?.yield.amount??1) : factor;
    return {...line,scaledQuantity:Number(line.quantity)*partFactor};
  });
}

export function scaledSourceIngredients(recipe, quantity) {
  const factor=Number(quantity)/Number(recipe.yield.amount);
  return (recipe.lines??[]).map(line=>({...line,scaledQuantity:Number(line.quantity)*factor}));
}
