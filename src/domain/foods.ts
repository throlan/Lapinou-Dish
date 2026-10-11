import type { Food, RecipeLine } from "./types.ts";

const EXACT_MASS_FACTORS: Readonly<Record<string, number>> = {
  g: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  ml: 1,
  millilitre: 1,
  millilitres: 1,
  l: 1000,
  litre: 1000,
  litres: 1000,
};

const MILLILITRES_PER_UNIT: Readonly<Record<string, number>> = {
  tsp: 5,
  teaspoon: 5,
  "c. a cafe": 5,
  tbsp: 15,
  tablespoon: 15,
  "c. a soupe": 15,
  cup: 240,
  tasse: 240,
};

function key(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("fr-FR")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Convert a recipe quantity to grams only when the food/unit relation is known. */
export function toGrams(quantity: number, unitId: string, food: Food): number | null {
  if (!Number.isFinite(quantity) || quantity < 0) return null;
  const unit = key(unitId);
  const directFactor = EXACT_MASS_FACTORS[unit];
  if (directFactor != null && (unit === "g" || unit === "gram" || unit === "grams" || unit === "kg")) {
    return quantity * directFactor;
  }

  const byFoodUnit = food.gramsPerUnit[unitId] ?? Object.entries(food.gramsPerUnit)
    .find(([foodUnit]) => key(foodUnit) === unit)?.[1];
  if (byFoodUnit != null && Number.isFinite(byFoodUnit) && byFoodUnit > 0) {
    return quantity * byFoodUnit;
  }

  const millilitres = MILLILITRES_PER_UNIT[unit];
  const volumeFactor = millilitres ?? directFactor;
  if (volumeFactor == null || food.gramsPerMillilitre == null) return null;
  if (!Number.isFinite(food.gramsPerMillilitre) || food.gramsPerMillilitre <= 0) return null;
  return quantity * volumeFactor * food.gramsPerMillilitre;
}

const REQUIRED_NUTRIENTS = ["energyKcal", "proteinG", "carbohydrateG", "fatG"] as const;
const ALL_NUTRIENTS = [...REQUIRED_NUTRIENTS, "fibreG"] as const;
type NutrientKey = (typeof ALL_NUTRIENTS)[number];

/** Deterministic ingredient-based nutrition. A nutrient is null if any line lacks it. */
export function calculateRecipeNutrition(
  lines: readonly RecipeLine[],
  foods: readonly Food[],
  yieldAmount: number
) {
  if (!Number.isFinite(yieldAmount) || yieldAmount <= 0) {
    throw new RangeError("Recipe yield must be a positive finite amount");
  }

  const foodById = new Map(foods.map((food) => [food.id, food]));
  const unresolvedLineIndexes: number[] = [];
  const lineIssues: Array<{ lineIndex: number; reason: string; missingNutrients: NutrientKey[] }> = [];
  const totals: Record<NutrientKey, number> = {
    energyKcal: 0,
    proteinG: 0,
    carbohydrateG: 0,
    fatG: 0,
    fibreG: 0,
  };
  const known: Record<NutrientKey, boolean> = {
    energyKcal: true,
    proteinG: true,
    carbohydrateG: true,
    fatG: true,
    fibreG: true,
  };
  if (lines.length === 0) {
    for (const nutrient of ALL_NUTRIENTS) known[nutrient] = false;
  }

  lines.forEach((line, index) => {
    const food = foodById.get(line.foodId);
    const grams = food ? toGrams(line.quantity, line.unitId, food) : null;
    if (!food || grams == null) {
      unresolvedLineIndexes.push(index);
      lineIssues.push({ lineIndex: index, reason: food ? "unit-conversion-missing" : "food-not-linked", missingNutrients: [] });
      for (const nutrient of ALL_NUTRIENTS) known[nutrient] = false;
      return;
    }

    const missingNutrients: NutrientKey[] = [];
    for (const nutrient of ALL_NUTRIENTS) {
      const value = food.nutrientsPer100g[nutrient];
      if (value == null || !Number.isFinite(value)) {
        known[nutrient] = false;
        missingNutrients.push(nutrient);
      } else {
        totals[nutrient] += (value * grams) / 100;
      }
    }
    if (missingNutrients.length) lineIssues.push({ lineIndex: index, reason: "nutrient-data-missing", missingNutrients });
  });

  const batch = Object.fromEntries(
    ALL_NUTRIENTS.map((nutrient) => [nutrient, known[nutrient] ? round(totals[nutrient]) : null])
  ) as Record<NutrientKey, number | null>;
  const perYieldUnit = Object.fromEntries(
    ALL_NUTRIENTS.map((nutrient) => [
      nutrient,
      known[nutrient] ? round(totals[nutrient] / yieldAmount) : null,
    ])
  ) as Record<NutrientKey, number | null>;
  const complete = REQUIRED_NUTRIENTS.every((nutrient) => batch[nutrient] != null);

  return { batch, perYieldUnit, complete, unresolvedLineIndexes, lineIssues };
}

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Search canonical names and aliases while returning each catalogue record once. */
export function searchFoods(foods: readonly Food[], query: string): Food[] {
  const normalized = key(query);
  if (!normalized) return [...foods];
  const ignored = new Set(["de", "du", "des", "la", "le", "les", "d", "l", "un", "une"]);
  const queryTerms = normalized.split(/\s+/).filter((term) => term.length > 1 && !ignored.has(term));
  return foods
    .map((food) => {
      const labels = [food.name, ...food.aliases, food.brand ?? ""].map(key);
      const exact = labels.some((label) => label === normalized);
      const startsWith = labels.some((label) => label.startsWith(normalized));
      const matchCount = queryTerms.filter((term) => labels.some((label) => label.includes(term))).length;
      const enoughTerms = queryTerms.length > 0 && matchCount / queryTerms.length >= 0.5;
      const score = exact ? 1000 : startsWith ? 500 : enoughTerms ? matchCount * 100 : 0;
      return { food, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.food.name.localeCompare(b.food.name, "fr"))
    .map(({ food }) => food);
}
