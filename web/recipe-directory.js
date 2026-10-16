const TYPE_LABELS = { dish: 'Plat', beverage: 'Boisson', accompaniment: 'Accompagnement', dessert: 'Dessert' };
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
    if (filters.missing && filters.missing !== 'any' && !missing.some(item => item.id === filters.missing)) return false;
    return true;
  });
}

export function recipeTypeLabel(type) { return TYPE_LABELS[type] ?? 'Recette'; }
export function recipeMomentLabel(moment) { return MOMENT_LABELS[moment] ?? moment; }
function normalize(value) { return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr'); }
