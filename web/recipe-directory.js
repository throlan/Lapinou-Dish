const TYPE_LABELS = { dish: 'Plat', salad: 'Salade', sauce: 'Sauce', beverage: 'Boisson', accompaniment: 'Accompagnement', dessert: 'Dessert' };
const MOMENT_LABELS = { breakfast: 'Petit-déjeuner', lunch: 'Déjeuner', dinner: 'Dîner', snack: 'Collation' };

export function recipeMissingData(recipe) {
  const missing = [];
  if (!recipe?.nutrition?.complete) missing.push({ id: 'nutrition', label: 'Calcul nutritionnel incomplet' });
  if (!recipe?.instructions?.trim()) missing.push({ id: 'instructions', label: 'Instructions absentes' });
  if (!recipe?.imageAvailable) missing.push({ id: 'image', label: 'Photo absente' });
  return missing;
}

export function filterRecipeDirectory(recipes, filters) {
  const query = normalize(filters.query ?? '');
  return recipes.filter(recipe => {
    if (filters.type && (recipe.recipeType ?? 'dish') !== filters.type) return false;
    if (filters.moment === 'untagged' && recipe.mealMoments?.length) return false;
    if (filters.moment && filters.moment !== 'untagged' && !recipe.mealMoments?.includes(filters.moment)) return false;
    if (query && !normalize(recipe.name).includes(query)) return false;
    const missing = recipeMissingData(recipe);
    if (filters.missing === 'any' && !missing.length) return false;
    if (filters.missing && filters.missing !== 'any' && filters.missing !== 'nutrition-planned' && !missing.some(item => item.id === filters.missing)) return false;
    if (filters.missing === 'nutrition-planned') {
      const plannedIds = filters.plannedRecipeIds instanceof Set ? filters.plannedRecipeIds : new Set(filters.plannedRecipeIds ?? []);
      const isPlanned = plannedIds.has(recipe.id)
        || (recipe.parentRecipeId && plannedIds.has(recipe.parentRecipeId))
        || (recipe.servingParts ?? []).some(part => plannedIds.has(part.id));
      if (!isPlanned || !missing.some(item => item.id === 'nutrition')) return false;
    }
    return true;
  });
}

export function recipeCardForSource(recipes, sourceRecipeId) {
  const source = recipes.find(recipe => recipe.id === sourceRecipeId)
    ?? recipes.find(recipe => recipe.servingParts?.some(part => part.id === sourceRecipeId));
  if (!source) return null;
  return source.parentRecipeId
    ? recipes.find(recipe => recipe.id === source.parentRecipeId) ?? source
    : source;
}

export function recipeTypeLabel(type) { return TYPE_LABELS[type] ?? 'Recette'; }
export function recipePlanningLabel(recipe) {
  const unit = recipe.yield.unitId;
  const rawEnergy = recipe.nutrition?.perYieldUnit?.energyKcal;
  const multiplier = ['g', 'ml'].includes(unit) ? 100 : 1;
  const energy = rawEnergy == null ? null : Number(rawEnergy) * multiplier;
  const energyUnit = { piece: 'pièce', slice:'tranche', portion: 'portion', g: '100 g', ml: '100 ml' }[unit] ?? unit;
  const calories = energy != null && Number.isFinite(energy) && energy >= 0
    ? `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(energy)} kcal/${energyUnit}${recipe.nutrition?.complete ? '' : ' (calcul incomplet)'}`
    : 'kcal à compléter';
  const yieldLabel = recipe.servingParts?.length
    ? 'portions en grammes estimés'
    : `${recipe.yield.amount} ${{ slice: Number(recipe.yield.amount) === 1 ? 'tranche' : 'tranches', piece: Number(recipe.yield.amount) === 1 ? 'pièce' : 'pièces', portion: Number(recipe.yield.amount) === 1 ? 'portion' : 'portions', g: 'g', ml: 'ml' }[unit] ?? unit}`;
  return `${recipe.name} · ${calories} · ${yieldLabel}`;
}
export function recipeMomentLabel(moment) { return MOMENT_LABELS[moment] ?? moment; }
function normalize(value) { return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr'); }
