import { strict as assert } from "node:assert";
import { test } from "node:test";
import { loadCiqualCatalog, mapCiqualRow } from "../src/import/ciqual.ts";
import type { CiqualRow } from "../src/import/ciqual.ts";

const codes = ["328", "25000", "31000", "40000", "34100"];

test("maps energy and macros from constituent codes, not fixed guessed offsets", () => {
  const row: CiqualRow = ["food-1", "Œuf entier, cru", "Egg, whole, raw", [147, 12.7, 0.3, 9.8, 0], "ABCDE"];
  const result = mapCiqualRow(row, codes, "2025-11-03");
  assert.equal(result.sourceCode, "food-1");
  assert.equal(result.canonicalName, "Œuf entier, cru");
  assert.deepEqual(result.aliases, ["Egg, whole, raw"]);
  assert.deepEqual(result.nutrientsPer100g, {
    energyKcal: 147,
    proteinG: 12.7,
    carbohydrateG: 0.3,
    fatG: 9.8,
    fibreG: 0,
  });
  assert.equal(result.sourceVersion, "2025-11-03");
});

test("keeps absent Ciqual nutrients unknown rather than replacing them with zero", () => {
  const row: CiqualRow = ["food-2", "Ail, cru", null, [109, 5.31, 18.6, null, null], "DDDDD"];
  const result = mapCiqualRow(row, codes, "2025-11-03");
  assert.equal(result.nutrientsPer100g.energyKcal, 109);
  assert.equal(result.nutrientsPer100g.proteinG, 5.31);
  assert.equal(result.nutrientsPer100g.fatG, null);
  assert.equal(result.nutrientsPer100g.fibreG, null);
});

test("loads the complete bundled Ciqual catalogue with stable source codes", async () => {
  const catalog = await loadCiqualCatalog();
  assert.equal(catalog.version, "2025-11-03");
  assert.equal(catalog.foods.length, 3484);
  assert.equal(new Set(catalog.foods.map((food) => food.sourceCode)).size, 3484);
  assert.ok(catalog.foods.some((food) => food.sourceCode === "22000" && food.canonicalName === "Oeuf cru"));
});
