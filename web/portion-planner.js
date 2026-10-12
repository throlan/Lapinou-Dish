export const SLOT_RATIOS = Object.freeze({ breakfast: 0.2, lunch: 0.4, dinner: 0.3, snack: 0.1 });

const NATURAL_STEPS = Object.freeze({ piece: 1, portion: 0.5, g: 10 });

export function suggestQuantity({ dailyTargetKcal, slot, plannedOtherKcal = 0, recipeKcal, recipeUnit = 'portion', recipeCount = 1 }) {
  const target = Number(dailyTargetKcal);
  const recipeEnergy = Number(recipeKcal);
  if (!Number.isFinite(target) || target <= 0) return { quantity: null, reason: 'daily-target-missing' };
  if (!Number.isFinite(recipeEnergy) || recipeEnergy <= 0) return { quantity: null, reason: 'recipe-energy-missing' };
  if (!Object.hasOwn(SLOT_RATIOS, slot)) return { quantity: null, reason: 'invalid-slot' };
  const remaining = Math.max(0, target - Math.max(0, Number(plannedOtherKcal) || 0));
  if (!remaining) return { quantity: null, reason: 'daily-budget-used' };
  const slotBudget = Math.min(target * SLOT_RATIOS[slot] + 100, remaining);
  const count = Math.max(1, Math.floor(Number(recipeCount) || 1));
  const energyPerRecipe = slotBudget / count;
  const step = NATURAL_STEPS[recipeUnit] ?? 0.5;
  const raw = energyPerRecipe / recipeEnergy;
  const quantity = Math.floor((raw + 1e-9) / step) * step;
  if (quantity < step) return { quantity: null, reason: 'no-natural-portion-fits', slotBudgetKcal: slotBudget };
  return { quantity: Number(quantity.toFixed(4)), slotBudgetKcal: slotBudget, estimatedKcal: quantity * recipeEnergy };
}
