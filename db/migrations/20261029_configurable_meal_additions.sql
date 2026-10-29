ALTER TABLE households
  ADD COLUMN IF NOT EXISTS meal_additions jsonb NOT NULL DEFAULT '[{"id":"accompaniment","label":"Accompagnement","recipeType":"accompaniment","slots":["lunch","dinner"]},{"id":"beverage","label":"Boisson","recipeType":"beverage","slots":["breakfast","lunch","snack","dinner","evening_snack"]},{"id":"sauce","label":"Sauce","recipeType":"sauce","slots":["lunch","dinner"]},{"id":"dessert","label":"Dessert","recipeType":"dessert","slots":["lunch","dinner"]},{"id":"pastry","label":"Pâtisserie","recipeType":"dessert","slots":["breakfast","snack"]}]'::jsonb;

ALTER TABLE planned_meal_items
  ADD COLUMN IF NOT EXISTS category_id text NOT NULL DEFAULT '';

ALTER TABLE recipes DROP CONSTRAINT IF EXISTS recipes_recipe_type_check;
ALTER TABLE recipes ADD CONSTRAINT recipes_recipe_type_check
  CHECK (recipe_type IN ('dish','salad','sauce','beverage','accompaniment','dessert') OR recipe_type ~ '^custom-[a-z0-9_-]{1,33}$');

UPDATE planned_meal_items SET category_id=role WHERE category_id='';
