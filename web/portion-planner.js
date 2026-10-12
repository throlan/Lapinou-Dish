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


export function rebalanceNaturalPortions(proposals, slotBudgetKcal) {
  const rows = proposals.map((item) => ({ ...item }));
  const budget = Number(slotBudgetKcal);
  if (!Number.isFinite(budget) || budget < 0) return { proposals: rows, beverageAdded: false, withinBudget: false };
  let beverageAdded = false;
  const total = () => rows.reduce((sum, item) => sum + (Number(item.quantity) || 0) * item.recipeKcal, 0);
  for (const beverage of rows.filter((item) => item.role === 'beverage' && item.quantity == null && item.reason === 'no-natural-portion-fits')) {
    const snapshot = rows.map((item) => item.quantity);
    beverage.quantity = beverage.step;
    while (total() > budget + 1e-9) {
      const candidate = ['main', 'accompaniment']
        .flatMap((role) => rows.filter((item) => item.role === role && item.quantity != null && item.quantity - item.step >= item.step))
        .sort((a, b) => b.recipeKcal - a.recipeKcal)[0];
      if (!candidate) break;
      candidate.quantity = Number((candidate.quantity - candidate.step).toFixed(4));
    }
    if (total() <= budget + 1e-9) beverageAdded = true;
    else rows.forEach((item, index) => { item.quantity = snapshot[index]; });
  }
  return { proposals: rows, beverageAdded, withinBudget: total() <= budget + 1e-9, estimatedKcal: total() };
}
