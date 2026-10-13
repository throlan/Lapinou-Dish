-- Preserve the previous classification when removing ambiguous recipe types.
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS legacy_recipe_type text;
UPDATE recipes SET legacy_recipe_type=COALESCE(legacy_recipe_type,recipe_type),
  recipe_type='dish', version=version+1, updated_at=now()
WHERE recipe_type IN ('snack','other');
ALTER TABLE recipes DROP CONSTRAINT IF EXISTS recipes_recipe_type_check;
ALTER TABLE recipes ADD CONSTRAINT recipes_recipe_type_check
  CHECK (recipe_type IN ('dish','beverage','accompaniment','dessert'));
