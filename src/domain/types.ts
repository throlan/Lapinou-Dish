/** A missing nutrient value means unknown; it is never interpreted as zero. */
export interface NutrientsPer100g {
  energyKcal: number | null;
  proteinG: number | null;
  carbohydrateG: number | null;
  fatG: number | null;
  fibreG: number | null;
}

export type FoodSource = "ciqual" | "label" | "manual" | "reviewed-import";

/** One canonical food record. Search terms belong in aliases, not recipe lines. */
export interface Food {
  id: string;
  name: string;
  aliases: readonly string[];
  brand: string | null;
  source: FoodSource;
  sourceReference: string | null;
  sourceConfidence?: string | null;
  sourceVersion?: string | null;
  nutrientsPer100g: NutrientsPer100g;
  /** Food-specific mass per unit, e.g. one egg = a documented edible mass. */
  gramsPerUnit: Readonly<Record<string, number>>;
  /** Food-specific density; needed for ml/l and volume spoons. */
  gramsPerMillilitre: number | null;
}

export interface RecipeYield {
  amount: number;
  unitId: string;
}

/** A recipe line has no free-text food name: its food ID is the authority. */
export interface RecipeLine {
  foodId: string;
  quantity: number;
  unitId: string;
  componentId: string | null;
  variantId: string | null;
}

/** An import/editor draft can be unresolved until a catalogue food is selected. */
export interface RecipeDraftLine extends Omit<RecipeLine, "foodId"> {
  foodId: string | null;
  importText: string;
}

export interface RecipeDefinition {
  id: string;
  name: string;
  yield: RecipeYield;
  lines: readonly RecipeLine[];
}

export type NutrientTotals = NutrientsPer100g;

export interface RecipeNutritionResult {
  perYieldUnit: NutrientTotals;
  /** Nutrients for the full recipe batch. */
  batch: NutrientTotals;
  complete: boolean;
  unresolvedLineIndexes: number[];
}

