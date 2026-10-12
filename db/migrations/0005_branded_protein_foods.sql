-- Manufacturer-label entries for popular protein products.
-- Values are per 100 g of product as sold. Nutrients absent from the label
-- (fiber) stay NULL. Product protein values use the EU label basis (Nx6.25,
-- wet matter) where the manufacturer publishes both dry and wet matter.
-- Re-running this migration is safe and does not overwrite user-edited foods.

WITH product_data (
  id, canonical_name, brand, source_reference, source_note,
  energy_kcal, protein_g, carbohydrate_g, fat_g
) AS (
  VALUES
    ('b13f0001-1010-4010-8010-000000000001'::uuid, 'Whey isolate native, goût neutre', 'Nutripure',
     'https://www.nutripure.fr/fr/musculation/13-whey-isolate-native.html',
     'Valeurs fabricant pour 100 g. Protéines Nx6.25, matière humide : 86,8 g. Les 94 g annoncés correspondent à la matière sèche.',
     382.1::numeric, 86.8::numeric, 3.1::numeric, 1.8::numeric),
    ('b13f0001-1010-4010-8010-000000000002'::uuid, 'Whey isolate native, goût vanille', 'Nutripure',
     'https://www.nutripure.fr/fr/musculation/148-whey-vanille-isolate.html',
     'Valeurs fabricant pour 100 g. Protéines Nx6.25, matière humide : 79,5 g.',
     378::numeric, 79.5::numeric, 9.8::numeric, 1.5::numeric),
    ('b13f0001-1010-4010-8010-000000000003'::uuid, 'Whey isolate native, goût chocolat', 'Nutripure',
     'https://www.nutripure.fr/fr/musculation/147-whey-chocolat-isolate.html',
     'Valeurs fabricant pour 100 g. Protéines Nx6.25, matière humide : 71,2 g.',
     371::numeric, 71.2::numeric, 11.2::numeric, 2.2::numeric),
    ('b13f0001-1010-4010-8010-000000000004'::uuid, 'Whey isolate, goût fraise', 'Nutripure',
     'https://www.nutripure.fr/fr/musculation/150-whey-fraise-isolate.html',
     'Valeurs fabricant pour 100 g. Protéines Nx6.25, matière humide : 80 g.',
     383::numeric, 80::numeric, 9.2::numeric, 1.4::numeric),
    ('b13f0001-1010-4010-8010-000000000005'::uuid, 'Skyr nature', 'Danone',
     'https://www.danone.com/fr/fr/marques/produits-laitiers-frais-et-d-origine-vegetale/100-pour-100-transparent.html',
     'Danone Skyr Nature, valeurs fabricant pour 100 g.',
     57::numeric, 10::numeric, 3.9::numeric, 0.2::numeric),
    ('b13f0001-1010-4010-8010-000000000006'::uuid, 'Skyr nature', 'Arla',
     'https://www.arlafoods.fr/nos-marques/arla-skyr/nature-1kg-388857/',
     'Arla Skyr Nature 1 kg, valeurs fabricant pour 100 g.',
     60::numeric, 10::numeric, 4::numeric, 0.2::numeric),
    ('b13f0001-1010-4010-8010-000000000007'::uuid, 'Fromage blanc nature', 'Danone',
     'https://www.danone.com/fr/fr/marques/produits-laitiers-frais-et-d-origine-vegetale/100-pour-100-transparent.html',
     'Danone Fromage Blanc Nature, valeurs fabricant pour 100 g.',
     75::numeric, 7.7::numeric, 3.9::numeric, 3.2::numeric)
),
upserted_foods AS (
  INSERT INTO foods (id, canonical_name, brand, source, source_reference, source_note)
  SELECT id, canonical_name, brand, 'label', source_reference, source_note
  FROM product_data
  ON CONFLICT (id) DO UPDATE SET
    canonical_name = EXCLUDED.canonical_name,
    brand = EXCLUDED.brand,
    source = EXCLUDED.source,
    source_reference = EXCLUDED.source_reference,
    source_note = EXCLUDED.source_note,
    updated_at = now()
  WHERE foods.manual_override = false
  RETURNING id
)
INSERT INTO food_nutrients (food_id, nutrient_id, value_per_100g, source_note)
SELECT p.id, n.nutrient_id, n.value_per_100g, p.source_reference
FROM product_data p
CROSS JOIN LATERAL (
  VALUES
    ('energy_kcal', p.energy_kcal),
    ('protein_g', p.protein_g),
    ('carbohydrate_g', p.carbohydrate_g),
    ('fat_g', p.fat_g),
    ('fibre_g', NULL::numeric)
) AS n(nutrient_id, value_per_100g)
WHERE EXISTS (SELECT 1 FROM upserted_foods u WHERE u.id = p.id)
ON CONFLICT (food_id, nutrient_id) DO UPDATE SET
  value_per_100g = EXCLUDED.value_per_100g,
  source_note = EXCLUDED.source_note
WHERE NOT (SELECT manual_override FROM foods WHERE id = EXCLUDED.food_id);

INSERT INTO food_aliases (id, food_id, alias, normalized_alias, source)
VALUES
  ('b13f0002-1010-4010-8010-000000000001', 'b13f0001-1010-4010-8010-000000000001', 'Whey nature Nutripure', 'whey nature nutripure', 'manual'),
  ('b13f0002-1010-4010-8010-000000000002', 'b13f0001-1010-4010-8010-000000000001', 'Isolate neutre Nutripure', 'isolate neutre nutripure', 'manual'),
  ('b13f0002-1010-4010-8010-000000000003', 'b13f0001-1010-4010-8010-000000000002', 'Whey vanille Nutripure', 'whey vanille nutripure', 'manual'),
  ('b13f0002-1010-4010-8010-000000000004', 'b13f0001-1010-4010-8010-000000000003', 'Whey chocolat Nutripure', 'whey chocolat nutripure', 'manual'),
  ('b13f0002-1010-4010-8010-000000000005', 'b13f0001-1010-4010-8010-000000000004', 'Whey fraise Nutripure', 'whey fraise nutripure', 'manual'),
  ('b13f0002-1010-4010-8010-000000000006', 'b13f0001-1010-4010-8010-000000000005', 'Skyr Danone nature', 'skyr danone nature', 'manual'),
  ('b13f0002-1010-4010-8010-000000000007', 'b13f0001-1010-4010-8010-000000000006', 'Skyr Arla nature', 'skyr arla nature', 'manual'),
  ('b13f0002-1010-4010-8010-000000000008', 'b13f0001-1010-4010-8010-000000000007', 'Fromage blanc Danone nature', 'fromage blanc danone nature', 'manual')
ON CONFLICT (food_id, normalized_alias) DO UPDATE SET
  alias = EXCLUDED.alias,
  source = EXCLUDED.source;
