export const MEAL_ORDER = Object.freeze(['breakfast','lunch','snack','dinner','evening_snack']);
export const MEAL_LABELS = Object.freeze({ breakfast:'Petit-déjeuner', lunch:'Déjeuner', snack:'Collation après-midi', dinner:'Dîner', evening_snack:'Collation du soir' });
export const DEFAULT_MEAL_RATIOS = Object.freeze({ breakfast:0.15, lunch:0.4, snack:0.1, dinner:0.25, evening_snack:0.1 });

export function validMealRatios(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === MEAL_ORDER.length
    && MEAL_ORDER.every(slot => typeof value[slot] === 'number' && Number.isFinite(value[slot]) && value[slot]>=0 && value[slot]<=1)
    && Math.abs(MEAL_ORDER.reduce((sum,slot)=>sum+value[slot],0)-1)<1e-9;
}
