ALTER TABLE recipes DROP CONSTRAINT IF EXISTS recipes_recipe_type_check;
ALTER TABLE recipes ADD CONSTRAINT recipes_recipe_type_check
  CHECK (recipe_type IN ('dish','salad','sauce','beverage','accompaniment','dessert'));

ALTER TABLE planned_meal_items DROP CONSTRAINT IF EXISTS planned_meal_items_role_check;
ALTER TABLE planned_meal_items ADD CONSTRAINT planned_meal_items_role_check
  CHECK (role IN ('main','accompaniment','beverage','dessert','sauce'));
