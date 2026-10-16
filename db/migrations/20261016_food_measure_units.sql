-- Food-specific recipe measures; their gram equivalence is stored per food.
INSERT INTO units (id, name, dimension, base_unit_id, base_factor, is_food_specific)
VALUES
  ('pinch', 'pincée', 'count', NULL, NULL, true),
  ('scoop', 'scoop', 'count', NULL, NULL, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  dimension = EXCLUDED.dimension,
  base_unit_id = EXCLUDED.base_unit_id,
  base_factor = EXCLUDED.base_factor,
  is_food_specific = EXCLUDED.is_food_specific;
