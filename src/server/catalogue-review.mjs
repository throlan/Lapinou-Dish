import proposals from './catalogue-proposals.json' with { type: 'json' };

export async function listCatalogueProposals(pool) {
  const codes = [...new Set(proposals.map(item => item.code))];
  const {rows} = await pool.query(`SELECT f.id,f.canonical_name AS name,f.version,f.source_reference AS code,
      f.cooking_factor AS "cookingFactor",f.grams_per_millilitre AS "gramsPerMillilitre",
      COALESCE((SELECT jsonb_object_agg(unit_id,grams_per_unit) FROM food_unit_conversions WHERE food_id=f.id),'{}'::jsonb) AS "gramsPerUnit"
    FROM foods f WHERE f.source='ciqual' AND f.source_reference=ANY($1::text[])
    ORDER BY lower(f.canonical_name),f.id`, [codes]);
  const byCode = new Map(codes.map(code => [code, proposals.filter(item => item.code === code)]));
  return {foods: rows.map(food => ({...food, proposals:byCode.get(food.code)}))};
}

