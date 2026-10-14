export const MEAL_ORDER = Object.freeze(['breakfast','lunch','snack','dinner','evening_snack']);
export const MEAL_LABELS = Object.freeze({ breakfast:'Petit-déjeuner', lunch:'Déjeuner', snack:'Collation après-midi', dinner:'Dîner', evening_snack:'Collation du soir' });
export const DEFAULT_MEAL_RATIOS = Object.freeze({ breakfast:0.15, lunch:0.4, snack:0.1, dinner:0.25, evening_snack:0.1 });

export function validMealRatios(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === MEAL_ORDER.length
    && MEAL_ORDER.every(slot => typeof value[slot] === 'number' && Number.isFinite(value[slot]) && value[slot]>=0 && value[slot]<=1)
    && Math.abs(MEAL_ORDER.reduce((sum,slot)=>sum+value[slot],0)-1)<1e-9;
}

export const PLATE_PARTS = Object.freeze({ whole:['main'], separate:['main','starch'], three:['main','starch','vegetables'] });
export const DEFAULT_PLATE_RATIOS = Object.freeze({
  whole:Object.freeze({main:1}),
  separate:Object.freeze({main:0.7,starch:0.3}),
  three:Object.freeze({main:0.25,starch:0.25,vegetables:0.5}),
});

export function validPlateRatios(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === Object.keys(PLATE_PARTS).length
    && Object.entries(PLATE_PARTS).every(([mode,parts]) => {
      const ratios=value[mode];
      return ratios != null && typeof ratios === 'object' && !Array.isArray(ratios)
        && Object.keys(ratios).length === parts.length
        && parts.every(part=>typeof ratios[part]==='number' && Number.isFinite(ratios[part]) && ratios[part]>0 && ratios[part]<=1)
        && Math.abs(parts.reduce((sum,part)=>sum+ratios[part],0)-1)<1e-9;
    });
}
