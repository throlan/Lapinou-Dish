ALTER TABLE recipes
  ADD COLUMN recipe_type text NOT NULL DEFAULT 'dish',
  ADD COLUMN meal_moments text[] NOT NULL DEFAULT '{}',
  ADD CONSTRAINT recipes_recipe_type_check
    CHECK (recipe_type IN ('dish', 'beverage', 'accompaniment', 'dessert', 'snack', 'other')),
  ADD CONSTRAINT recipes_meal_moments_check
    CHECK (meal_moments <@ ARRAY['breakfast', 'lunch', 'dinner', 'snack']::text[]);

UPDATE recipes
   SET recipe_type = 'beverage', meal_moments = ARRAY['breakfast']::text[]
 WHERE name ILIKE '%cappuccino%'
    OR name ILIKE '%nesquik%'
    OR name ILIKE '%chocolat chaud%';
