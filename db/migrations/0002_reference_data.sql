-- Reference vocabulary shared by all foods and recipes.
-- Safe to apply more than once.

INSERT INTO units (id, name, dimension, base_unit_id, base_factor, is_food_specific)
VALUES
  ('g', 'gramme', 'mass', NULL, 1, false),
  ('kg', 'kilogramme', 'mass', 'g', 1000, false),
  ('ml', 'millilitre', 'volume', NULL, 1, false),
  ('l', 'litre', 'volume', 'ml', 1000, false),
  ('piece', 'pièce', 'count', NULL, NULL, true),
  ('tsp', 'cuillère à café', 'volume', 'ml', 5, false),
  ('tbsp', 'cuillère à soupe', 'volume', 'ml', 15, false),
  ('cup', 'tasse', 'volume', 'ml', 240, false),
  ('portion', 'portion', 'yield', NULL, NULL, false),
  ('kcal', 'kilocalorie', 'energy', NULL, NULL, false)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  dimension = EXCLUDED.dimension,
  base_unit_id = EXCLUDED.base_unit_id,
  base_factor = EXCLUDED.base_factor,
  is_food_specific = EXCLUDED.is_food_specific;

INSERT INTO nutrients (id, name, unit_id, is_required_for_recipe, sort_order)
VALUES
  ('energy_kcal', 'Énergie', 'kcal', true, 10),
  ('protein_g', 'Protéines', 'g', true, 20),
  ('carbohydrate_g', 'Glucides', 'g', true, 30),
  ('fat_g', 'Lipides', 'g', true, 40),
  ('fibre_g', 'Fibres', 'g', false, 50)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  unit_id = EXCLUDED.unit_id,
  is_required_for_recipe = EXCLUDED.is_required_for_recipe,
  sort_order = EXCLUDED.sort_order;
