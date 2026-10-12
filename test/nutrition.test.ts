import { strict as assert } from "node:assert";
import { test } from "node:test";
import { calculateRecipeNutrition, searchFoods, toGrams } from "../src/domain/foods.ts";
import type { Food, RecipeLine } from "../src/domain/types.ts";

const chicken: Food = {
  id: "food-chicken",
  name: "Poulet, filet sans peau cru",
  aliases: ["blanc de poulet", "filet de poulet"],
  brand: null,
  source: "ciqual",
  sourceReference: "ciqual:test-chicken",
  nutrientsPer100g: { energyKcal: 110, proteinG: 23.4, carbohydrateG: 0, fatG: 1.5, fibreG: null },
  gramsPerUnit: {},
  gramsPerMillilitre: null,
};
const rice: Food = {
  id: "food-rice",
  name: "Riz basmati, cuit",
  aliases: ["riz basmati cuit"],
  brand: null,
  source: "ciqual",
  sourceReference: "ciqual:test-rice",
  nutrientsPer100g: { energyKcal: 130, proteinG: 2.7, carbohydrateG: 28, fatG: 0.3, fibreG: 0.4 },
  gramsPerUnit: {},
  gramsPerMillilitre: null,
};

const recipeLine = (foodId: string, quantity: number, unitId = "g"): RecipeLine => ({
  foodId, quantity, unitId, componentId: null, variantId: null,
});

test("recipe lines refer to one canonical food record; aliases search that record", () => {
  const results = searchFoods([chicken, rice], "blanc de poulet");
  assert.equal(results.length, 1);
  assert.equal(results[0]?.id, chicken.id);
  assert.equal(results[0]?.name, "Poulet, filet sans peau cru");
});

test("common ingredient wording finds a canonical food without creating another record", () => {
  const results = searchFoods([{ ...chicken, aliases: [] }, rice], "blanc de poulet");
  assert.equal(results[0]?.id, chicken.id);
  const egg: Food = { ...chicken, id: "food-egg", name: "Œuf entier, cru", aliases: [] };
  assert.equal(searchFoods([egg], "oeuf moyen")[0]?.id, egg.id);
});

test("calculates batch and per-yield nutrition from food IDs and ingredient quantities", () => {
  const result = calculateRecipeNutrition(
    [recipeLine(chicken.id, 480), recipeLine(rice.id, 600)],
    [chicken, rice],
    4,
  );
  assert.equal(result.complete, true);
  assert.deepEqual(result.batch, {
    energyKcal: 1308,
    proteinG: 128.52,
    carbohydrateG: 168,
    fatG: 9,
    fibreG: null,
  });
  assert.deepEqual(result.perYieldUnit, {
    energyKcal: 327,
    proteinG: 32.13,
    carbohydrateG: 42,
    fatG: 2.25,
    fibreG: null,
  });
});

test("converts mass exactly but requires a food conversion for pieces and volume", () => {
  const egg: Food = {
    ...chicken,
    id: "food-egg",
    name: "Œuf entier cru",
    gramsPerUnit: { piece: 50 },
    gramsPerMillilitre: null,
  };
  assert.equal(toGrams(0.25, "kg", egg), 250);
  assert.equal(toGrams(2, "piece", egg), 100);
  assert.equal(toGrams(2, "c. à café", egg), null);
  assert.equal(toGrams(100, "ml", egg), null);
  assert.equal(toGrams(2, "c. à café", { ...egg, gramsPerMillilitre: 1.05 }), 10.5);
});

test("uses density for volume and never treats missing nutrients as zero", () => {
  const yoghurt: Food = {
    ...rice,
    id: "food-yoghurt",
    name: "Yaourt nature",
    nutrientsPer100g: { energyKcal: 60, proteinG: 4, carbohydrateG: 5, fatG: null, fibreG: null },
    gramsPerMillilitre: 1.03,
  };
  const result = calculateRecipeNutrition([recipeLine(yoghurt.id, 100, "ml")], [yoghurt], 1);
  assert.equal(result.complete, false);
  assert.equal(result.batch.energyKcal, 61.8);
  assert.equal(result.batch.proteinG, 4.12);
  assert.equal(result.batch.carbohydrateG, 5.15);
  assert.equal(result.batch.fatG, null);
  assert.equal(result.batch.fibreG, null);
  assert.equal(result.unresolvedLineIndexes.length, 0);
  assert.deepEqual(result.lineIssues, [{ lineIndex: 0, reason: "nutrient-data-missing", missingNutrients: ["fatG", "fibreG"] }]);
});

test("an unlinked line is excluded while convertible ingredients remain a clearly incomplete subtotal", () => {
  const draftLine = { ...recipeLine(chicken.id, 100), foodId: "missing-food" };
  const result = calculateRecipeNutrition([recipeLine(chicken.id, 100), draftLine], [chicken], 1);
  assert.equal(result.complete, false);
  assert.equal(result.batch.energyKcal, 110);
  assert.equal(result.batch.proteinG, 23.4);
  assert.deepEqual(result.calculatedLineIndexes, [0]);
  assert.deepEqual(result.unresolvedLineIndexes, [1]);
  assert.deepEqual(result.lineIssues, [
    { lineIndex: 0, reason: "nutrient-data-missing", missingNutrients: ["fibreG"] },
    { lineIndex: 1, reason: "food-not-linked", missingNutrients: [] },
  ]);
});

test("an unknown steak-piece weight does not block nutrition for 2.5 g of basil", () => {
  const steak: Food = {
    ...chicken,
    id: "food-steak-5-percent",
    name: "Steak haché 5 %",
    gramsPerUnit: {},
  };
  const basil: Food = {
    ...rice,
    id: "food-basil",
    name: "Basilic frais",
    nutrientsPer100g: { energyKcal: 23, proteinG: 3.15, carbohydrateG: 2.65, fatG: 0.64, fibreG: 1.6 },
  };
  const result = calculateRecipeNutrition(
    [recipeLine(steak.id, 1, "piece"), recipeLine(basil.id, 2.5, "g")],
    [steak, basil],
    1,
  );

  assert.equal(result.complete, false);
  assert.deepEqual(result.unresolvedLineIndexes, [0]);
  assert.deepEqual(result.calculatedLineIndexes, [1]);
  assert.equal(result.batch.energyKcal, 0.58);
  assert.equal(result.batch.proteinG, 0.08);
  assert.equal(result.perYieldUnit.carbohydrateG, 0.07);
  assert.deepEqual(result.lineIssues, [{ lineIndex: 0, reason: "unit-conversion-missing", missingNutrients: [] }]);
});

test("an unknown piece weight with no other convertible ingredient does not appear as zero", () => {
  const steak: Food = { ...chicken, id: "food-steak", name: "Steak haché 5 %", gramsPerUnit: {} };
  const result = calculateRecipeNutrition([recipeLine(steak.id, 1, "piece")], [steak], 1);
  assert.equal(result.complete, false);
  assert.equal(result.batch.energyKcal, null);
  assert.deepEqual(result.calculatedLineIndexes, []);
});

test("explains which ingredient needs a unit conversion", () => {
  const result = calculateRecipeNutrition([recipeLine(rice.id, 600, "ml")], [rice], 1);
  assert.deepEqual(result.lineIssues, [{ lineIndex: 0, reason: "unit-conversion-missing", missingNutrients: [] }]);
});

test("rejects a missing or invalid recipe yield", () => {
  assert.throws(() => calculateRecipeNutrition([], [], 0), RangeError);
  assert.throws(() => calculateRecipeNutrition([], [], Number.NaN), RangeError);
});

test("an empty recipe never appears as a complete zero-calorie recipe", () => {
  const result = calculateRecipeNutrition([], [], 1);
  assert.equal(result.complete, false);
  assert.equal(result.batch.energyKcal, null);
  assert.equal(result.perYieldUnit.proteinG, null);
});

