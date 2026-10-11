const REFINEMENTS = [
  { reference: '22000', aliases: ['Oeuf', 'Oeufs', 'Oeuf moyen', 'Oeufs moyens', 'Oeuf entier', 'Oeuf entier cru'], pieceGrams: 50 },
  { reference: '20239', aliases: ['Oignon moyen', 'Oignon jaune'], pieceGrams: 100 },
  { reference: '11000', aliases: ['Gousse d’ail', 'Gousses d’ail'], pieceGrams: 3 },
  { reference: '25930', aliases: ['Bouillon de boeuf', 'Bouillon de boeuf déshydraté', 'Bouillon de boeuf reconstitué', 'Bouillon de boeuf prêt à consommer'], density: 1 },
];

export async function applyCommonFoodRefinements(connection) {
  for (const refinement of REFINEMENTS) {
    const found = await connection.query("SELECT id FROM foods WHERE source = 'ciqual' AND source_reference = $1 AND manual_override = false", [refinement.reference]);
    const foodId = found.rows[0]?.id;
    if (!foodId) continue;
    for (const alias of refinement.aliases) {
      const normalized = normalizeAlias(alias);
      await connection.query(
        `INSERT INTO food_aliases (id, food_id, alias, normalized_alias, source)
         VALUES (md5('lapinou-ciqual-refinement:' || $1 || ':' || $2)::uuid, $3, $4, $5, 'manual')
         ON CONFLICT (food_id, normalized_alias) DO NOTHING`,
        [refinement.reference, normalized, foodId, alias, normalized],
      );
    }
    if (refinement.pieceGrams) {
      await connection.query(
        `INSERT INTO food_unit_conversions (food_id, unit_id, grams_per_unit, source_note)
         VALUES ($1, 'piece', $2, 'Estimation : un oeuf entier moyen représente environ 50 g comestibles.')
         ON CONFLICT (food_id, unit_id) DO NOTHING`, [foodId, refinement.pieceGrams],
      );
    }
    if (refinement.density) {
      await connection.query(
        `UPDATE foods SET grams_per_millilitre = COALESCE(grams_per_millilitre, $2),
             source_note = CASE WHEN source_note LIKE '%densité estimée à 1 g/ml%'
                                THEN source_note ELSE concat_ws('; ', source_note, 'densité estimée à 1 g/ml pour le bouillon reconstitué') END
         WHERE id = $1 AND manual_override = false`, [foodId, refinement.density],
      );
    }
  }
}

export function normalizeAlias(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/[^a-z0-9]+/g, ' ').trim();
}
