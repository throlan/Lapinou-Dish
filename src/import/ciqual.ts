import { readFile } from "node:fs/promises";
import type { NutrientsPer100g } from "../domain/types.ts";

export type CiqualRow = [code: string, frenchName: string, englishName: string | null, values: Array<number | null>, confidence: string];

export interface CiqualImportRecord {
  sourceCode: string;
  sourceVersion: string;
  canonicalName: string;
  aliases: string[];
  nutrientsPer100g: NutrientsPer100g;
  confidence: string;
}

interface CiqualDataset {
  source: string;
  version: string;
  constituents: string[];
  foods: CiqualRow[];
}

const STANDARD_NUTRIENT_CODES = {
  energyKcal: "328",
  proteinG: "25000",
  carbohydrateG: "31000",
  fatG: "40000",
  fibreG: "34100",
} as const;

/** Convert a published Ciqual row into one candidate row for the global Food table. */
export function mapCiqualRow(
  row: CiqualRow,
  constituentCodes: readonly string[],
  sourceVersion: string,
): CiqualImportRecord {
  const valuesByCode = new Map(constituentCodes.map((code, index) => [code, row[3][index] ?? null]));
  const nutrientsPer100g: NutrientsPer100g = {
    energyKcal: numericOrNull(valuesByCode.get(STANDARD_NUTRIENT_CODES.energyKcal)),
    proteinG: numericOrNull(valuesByCode.get(STANDARD_NUTRIENT_CODES.proteinG)),
    carbohydrateG: numericOrNull(valuesByCode.get(STANDARD_NUTRIENT_CODES.carbohydrateG)),
    fatG: numericOrNull(valuesByCode.get(STANDARD_NUTRIENT_CODES.fatG)),
    fibreG: numericOrNull(valuesByCode.get(STANDARD_NUTRIENT_CODES.fibreG)),
  };

  return {
    sourceCode: row[0],
    sourceVersion,
    canonicalName: row[1].trim(),
    aliases: row[2]?.trim() && row[2].trim() !== row[1].trim() ? [row[2].trim()] : [],
    nutrientsPer100g,
    confidence: row[4],
  };
}

/** Load the bundled, attributed Ciqual data and verify stable source identifiers. */
export async function loadCiqualCatalog(): Promise<{ version: string; foods: CiqualImportRecord[] }> {
  const dataUrl = new URL("../../data/ciqual/ciqual-2025.json", import.meta.url);
  const dataset = JSON.parse(await readFile(dataUrl, "utf8")) as CiqualDataset;
  if (dataset.source !== "Anses Ciqual 2025" || !dataset.version || dataset.foods.length === 0) {
    throw new Error("The bundled Ciqual dataset is missing its source, version or food rows");
  }
  const codes = new Set<string>();
  const foods = dataset.foods.map((row) => {
    if (!row[0] || !row[1]?.trim() || codes.has(row[0])) {
      throw new Error(`Invalid or duplicate Ciqual food code: ${row[0]}`);
    }
    codes.add(row[0]);
    return mapCiqualRow(row, dataset.constituents, dataset.version);
  });
  return { version: dataset.version, foods };
}

function numericOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
