ALTER TABLE planned_meal_items DROP CONSTRAINT IF EXISTS planned_meal_items_role_check;
ALTER TABLE planned_meal_items ADD CONSTRAINT planned_meal_items_role_check
  CHECK (role IN ('main', 'accompaniment', 'beverage', 'dessert'));
