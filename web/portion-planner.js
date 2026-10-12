export const SLOT_RATIOS = Object.freeze({ breakfast: 0.2, lunch: 0.4, dinner: 0.3, snack: 0.1 });

const NATURAL_STEPS = Object.freeze({ piece: 1, portion: 0.5, g: 10 });

export function suggestQuantity({ dailyTargetKcal, slot, plannedOtherKcal = 0, recipeKcal, recipeUnit = 'portion', recipeCount = 1, budgetShare = 1 }) {
  const target = Number(dailyTargetKcal);
  const recipeEnergy = Number(recipeKcal);
  if (!Number.isFinite(target) || target <= 0) return { quantity: null, reason: 'daily-target-missing' };
  if (!Number.isFinite(recipeEnergy) || recipeEnergy <= 0) return { quantity: null, reason: 'recipe-energy-missing' };
  if (!Object.hasOwn(SLOT_RATIOS, slot)) return { quantity: null, reason: 'invalid-slot' };
  const remaining = Math.max(0, target - Math.max(0, Number(plannedOtherKcal) || 0));
  if (!remaining) return { quantity: null, reason: 'daily-budget-used' };
  const slotBudget = Math.min(target * SLOT_RATIOS[slot] + 100, remaining);
  const count = Math.max(1, Math.floor(Number(recipeCount) || 1));
  const share = Math.max(0, Math.min(1, Number(budgetShare) || 0));
  const energyPerRecipe = slotBudget * share / count;
  const step = NATURAL_STEPS[recipeUnit] ?? 0.5;
  const raw = energyPerRecipe / recipeEnergy;
  const quantity = Math.floor((raw + 1e-9) / step) * step;
  if (quantity < step) return { quantity: null, reason: 'no-natural-portion-fits', slotBudgetKcal: slotBudget };
  return { quantity: Number(quantity.toFixed(4)), slotBudgetKcal: slotBudget, estimatedKcal: quantity * recipeEnergy };
}


export const MIN_PROTEIN_G_PER_MEAL = 4;

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
