const columns = [
  'id', 'nom', 'marque', 'autres_noms', 'source', 'reference_source', 'note_source',
  'kcal_100g', 'proteines_100g', 'glucides_100g', 'lipides_100g', 'fibres_100g',
  'poids_cuit_pour_1g_cru', 'densite_g_ml', 'poids_cac_g', 'poids_cas_g',
  'poids_pincee_g', 'poids_scoop_g', 'poids_piece_g',
  'achat_unite', 'achat_unites', 'achat_quantite', 'achat_unite_quantite',
  'achat_precision', 'version', 'modifie_le',
];

function csvCell(value, { text = false } = {}) {
  if (value == null) return '';
  let cell = String(value);
  // A downloaded catalogue may be opened in a spreadsheet: never run text as a formula.
  if (text && /^[\s\uFEFF]*[=+\-@]/u.test(cell)) cell = `'${cell}`;
  return /[;"\r\n]/u.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell;
}

export async function exportFoodCatalog(pool, householdId) {
  const household = await pool.query('SELECT id FROM households WHERE id=$1', [householdId]);
  if (!household.rows.length) return null;
  const [foods, aliases, nutrients, conversions, purchases] = await Promise.all([
    pool.query(`SELECT id,canonical_name,brand,source,source_reference,source_note,
      cooking_factor,grams_per_millilitre,version,updated_at
      FROM foods ORDER BY lower(canonical_name),id`),
    pool.query('SELECT food_id,alias FROM food_aliases ORDER BY food_id,alias'),
    pool.query(`SELECT food_id,nutrient_id,value_per_100g FROM food_nutrients
      WHERE nutrient_id IN ('energy_kcal','protein_g','carbohydrate_g','fat_g','fibre_g')`),
    pool.query("SELECT food_id,unit_id,grams_per_unit FROM food_unit_conversions WHERE unit_id IN ('tsp','tbsp','pinch','scoop','piece')"),
    pool.query(`SELECT food_id,singular_label,plural_label,covered_quantity,covered_unit_id,estimate_note
      FROM household_food_purchase_units WHERE household_id=$1`, [householdId]),
  ]);
  const byFood = rows => {
    const map = new Map();
    for (const row of rows) {
      if (!map.has(row.food_id)) map.set(row.food_id, []);
      map.get(row.food_id).push(row);
    }
    return map;
  };
  const aliasMap = byFood(aliases.rows);
  const nutrientMap = byFood(nutrients.rows);
  const conversionMap = byFood(conversions.rows);
  const purchaseMap = new Map(purchases.rows.map(row => [row.food_id, row]));
  const lines = [columns.join(';')];
  for (const food of foods.rows) {
    const values = new Map((nutrientMap.get(food.id) ?? []).map(row => [row.nutrient_id, row.value_per_100g]));
    const units = new Map((conversionMap.get(food.id) ?? []).map(row => [row.unit_id, row.grams_per_unit]));
    const purchase = purchaseMap.get(food.id);
    const row = [
      food.id, food.canonical_name, food.brand, (aliasMap.get(food.id) ?? []).map(item => item.alias).join(' | '),
      food.source, food.source_reference, food.source_note,
      values.get('energy_kcal'), values.get('protein_g'), values.get('carbohydrate_g'),
      values.get('fat_g'), values.get('fibre_g'), food.cooking_factor, food.grams_per_millilitre,
      units.get('tsp'), units.get('tbsp'), units.get('pinch'), units.get('scoop'), units.get('piece'),
      purchase?.singular_label, purchase?.plural_label, purchase?.covered_quantity,
      purchase?.covered_unit_id, purchase?.estimate_note, food.version,
      food.updated_at instanceof Date ? food.updated_at.toISOString() : food.updated_at,
    ];
    lines.push(row.map((value, index) => csvCell(value, { text: [1, 2, 3, 4, 5, 6, 19, 20, 22, 23].includes(index) })).join(';'));
  }
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
