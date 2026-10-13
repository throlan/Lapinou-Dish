import { DEFAULT_MEAL_RATIOS } from './meal-config.js';
export const SLOT_RATIOS = DEFAULT_MEAL_RATIOS;

export function breakfastServingLimit(recipe,parent) {
  if(recipe?.yield?.unitId==='piece')return 2;
  if(recipe?.yield?.unitId==='portion')return 1;
  if(recipe?.yield?.unitId==='g' && parent?.yield?.unitId==='piece' && Number(parent.yield.amount)>0) {
    const weight=2*Number(recipe.yield.amount)/Number(parent.yield.amount);
    return Math.floor(weight/10)*10 || weight;
  }
  return Infinity;
}

const NATURAL_STEPS = Object.freeze({ piece: 1, portion: 0.5, g: 10 });

// A calorie envelope is a ceiling, not a reason to enlarge a batch serving.
export function mainServingLimit(recipe, parent) {
  if (!['main','vegetables'].includes(recipe?.servingPart) || recipe?.yield?.unitId !== 'g' ||
      parent?.yield?.unitId !== 'portion' || !(Number(parent.yield.amount) > 0)) return Infinity;
  const average = Number(recipe.yield.amount) / Number(parent.yield.amount);
  if (!Number.isFinite(average) || average <= 0) return Infinity;
  return Math.floor(average / NATURAL_STEPS.g) * NATURAL_STEPS.g || average;
}

export function suggestQuantity({ dailyTargetKcal, slot, plannedOtherKcal = 0, recipeKcal, recipeUnit = 'portion', recipeCount = 1, budgetShare = 1, slotRatios = SLOT_RATIOS }) {
  const target = Number(dailyTargetKcal);
  const recipeEnergy = Number(recipeKcal);
  if (!Number.isFinite(target) || target <= 0) return { quantity: null, reason: 'daily-target-missing' };
  if (!Number.isFinite(recipeEnergy) || recipeEnergy <= 0) return { quantity: null, reason: 'recipe-energy-missing' };
  if (!Object.hasOwn(slotRatios, slot)) return { quantity: null, reason: 'invalid-slot' };
  if (!(slotRatios[slot]>0)) return {quantity:null,reason:'no-slot-budget',slotBudgetKcal:0};
  const remaining = Math.max(0, target - Math.max(0, Number(plannedOtherKcal) || 0));
  if (!remaining) return { quantity: null, reason: 'daily-budget-used' };
  const slotBudget = Math.min(target * slotRatios[slot] + 100, remaining);
  const count = Math.max(1, Math.floor(Number(recipeCount) || 1));
  const share = Math.max(0, Math.min(1, Number(budgetShare) || 0));
  const energyPerRecipe = slotBudget * share / count;
  const step = NATURAL_STEPS[recipeUnit] ?? 0.5;
  const raw = energyPerRecipe / recipeEnergy;
  const quantity = Math.floor((raw + 1e-9) / step) * step;
  if (quantity < step) return { quantity: null, reason: 'no-natural-portion-fits', slotBudgetKcal: slotBudget };
  return { quantity: Number(quantity.toFixed(4)), slotBudgetKcal: slotBudget, estimatedKcal: quantity * recipeEnergy };
}


export const MIN_PROTEIN_G_PER_MEAL = 40;

export function calculateDailyEnergy(meals, personId, date) {
  let kcal=0, knownAmounts=0, incomplete=false, hasPlan=false;
  for(const meal of meals.filter(meal=>meal.mealDate===date)) {
    for(const item of meal.items ?? []) {
      const amount=item.amounts?.find(amount=>amount.personId===personId);
      if(!amount)continue;
      hasPlan=true;
      const quantity=Number(amount.quantity),energy=item.recipe?.nutrition?.perYieldUnit?.energyKcal;
      if(!Number.isFinite(quantity) || quantity<0){incomplete=true;continue;}
      if(!quantity)continue;
      if(energy==null || !Number.isFinite(Number(energy))){incomplete=true;continue;}
      kcal+=quantity*Number(energy);knownAmounts++;
      if(item.recipe?.nutrition?.complete===false)incomplete=true;
    }
  }
  return {kcal:incomplete && !knownAmounts ? null : kcal,incomplete,hasPlan};
}

export function calculatePersonEnergy(meal, personId) {
  let kcal = 0, hasPortions = false;
  for (const item of meal?.items ?? []) {
    const amount = item.amounts?.find(entry => entry.personId === personId);
    if (!amount) continue;
    const quantity = Number(amount.quantity), energy = item.recipe?.nutrition?.perYieldUnit?.energyKcal;
    if (!Number.isFinite(quantity) || quantity < 0) return { kcal:null, known:false };
    if (!quantity) continue;
    hasPortions = true;
    if (energy == null || !Number.isFinite(Number(energy))) return { kcal:null, known:false };
    kcal += quantity * Number(energy);
  }
  return { kcal:hasPortions ? kcal : null, known:hasPortions };
}

export function calculatePersonProtein(meal, personId) {
  let grams = 0;
  let hasPortions = false;
  for (const item of meal?.items ?? []) {
    const amount = item.amounts?.find((entry) => entry.personId === personId);
    if (!amount || !(Number(amount.quantity) > 0)) continue;
    hasPortions = true;
    const protein = item.recipe?.nutrition?.perYieldUnit?.proteinG;
    if (protein == null || !Number.isFinite(Number(protein))) return { grams: null, known: false, hasPortions };
    grams += Number(amount.quantity) * Number(protein);
  }
  return { grams: hasPortions ? Number(grams.toFixed(2)) : null, known: hasPortions, hasPortions };
}

export function capAccompanimentQuantity(quantity, { recipeUnit, recipeYieldAmount }) {
  if (recipeUnit !== 'g' || !Number.isFinite(Number(quantity)) || !Number.isFinite(Number(recipeYieldAmount)) || Number(recipeYieldAmount) <= 0) return quantity;
  const maxGrams = Math.min(200, Number(recipeYieldAmount) * 1.5);
  return Math.min(Number(quantity), maxGrams);
}

export function rebalanceNaturalPortions(proposals, slotBudgetKcal, { minProteinG = MIN_PROTEIN_G_PER_MEAL } = {}) {
  const rows = proposals.map((item) => ({ ...item }));
  const budget = Number(slotBudgetKcal);
  if (!Number.isFinite(budget) || budget < 0) return { proposals: rows, withinBudget: false, proteinKnown: false, proteinTargetMet: false };
  const total = () => rows.reduce((sum, item) => sum + Math.max(0, Number(item.quantity) || 0) * item.recipeKcal, 0);
  while (total() > budget + 1e-9) {
    const candidate = ['main', 'accompaniment']
      .flatMap((role) => rows.filter((item) => item.role === role && item.quantity != null && item.quantity - item.step >= item.step))
      .sort((a, b) => b.recipeKcal / b.step - a.recipeKcal / a.step)[0];
    if (!candidate) break;
    candidate.quantity = Number((candidate.quantity - candidate.step).toFixed(4));
  }

  const proteinKnown = rows.every((item) => (Number(item.quantity) || 0) <= 0 || (item.proteinG != null && Number.isFinite(Number(item.proteinG))));
  const totalProtein = () => rows.reduce((sum, item) => sum + Math.max(0, Number(item.quantity) || 0) * (Number(item.proteinG) || 0), 0);
  if (proteinKnown) {
    while (totalProtein() < minProteinG - 1e-9) {
      const candidate = rows
        .filter((item) => ['main', 'accompaniment'].includes(item.role)
          && Number(item.proteinG) > 0
          && Number.isFinite(Number(item.recipeKcal))
          && Number(item.step) > 0
          && (Number(item.quantity) || 0) + item.step <= (Number(item.maxQuantity) || Infinity) + 1e-9)
        .filter((item) => total() + item.recipeKcal * item.step <= budget + 1e-9)
        .sort((a, b) => (b.proteinG / b.recipeKcal) - (a.proteinG / a.recipeKcal))[0];
      if (!candidate) break;
      candidate.quantity = Number(((Number(candidate.quantity) || 0) + candidate.step).toFixed(4));
    }
  }
  return {
    proposals: rows,
    withinBudget: total() <= budget + 1e-9,
    estimatedKcal: total(),
    estimatedProteinG: proteinKnown ? totalProtein() : null,
    proteinKnown,
    proteinTargetMet: proteinKnown && totalProtein() >= minProteinG - 1e-9,
  };
}
