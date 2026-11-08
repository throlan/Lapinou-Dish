export const MEAL_ORDER = Object.freeze(['breakfast','lunch','snack','dinner','evening_snack']);
export const MEAL_LABELS = Object.freeze({ breakfast:'Petit-déjeuner', lunch:'Déjeuner', snack:'Collation après-midi', dinner:'Dîner', evening_snack:'Collation du soir' });
export const DEFAULT_MEAL_RATIOS = Object.freeze({ breakfast:0.2, lunch:0.4, snack:0.1, dinner:0.3, evening_snack:0 });

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

export const SERVING_CAP_FIELDS = Object.freeze({
  meat:{label:'Viande (g crus)',defaultValue:125,max:5000},
  fish:{label:'Poisson (g crus)',defaultValue:150,max:5000},
  eggs:{label:'Œufs entiers',defaultValue:3,max:100},
  starch:{label:'Féculents (g servis)',defaultValue:200,max:5000},
  mixed:{label:'Plat mélangé (g servis)',defaultValue:750,max:5000},
  vegetables:{label:'Légumes (g servis)',defaultValue:Infinity,max:5000},
});

export function effectiveServingCaps(overrides={}){
  return Object.fromEntries(Object.entries(SERVING_CAP_FIELDS).map(([key,field])=>{
    const value=overrides?.[key];
    return [key,Number.isInteger(value)&&value>=1&&value<=field.max?value:field.defaultValue];
  }));
}
