INSERT INTO units(id,name,dimension,is_food_specific) VALUES ('slice','tranche','count',true) ON CONFLICT(id) DO NOTHING;

ALTER TABLE recipes ADD COLUMN output_units jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE recipe_lines ALTER COLUMN food_id DROP NOT NULL;
ALTER TABLE recipe_lines ADD COLUMN ingredient_recipe_id uuid REFERENCES recipes(id) ON DELETE RESTRICT;
ALTER TABLE recipe_lines ADD CONSTRAINT recipe_line_one_source CHECK ((food_id IS NULL) <> (ingredient_recipe_id IS NULL));
ALTER TABLE recipe_lines ADD CONSTRAINT recipe_line_not_self CHECK (ingredient_recipe_id IS DISTINCT FROM recipe_id);
CREATE INDEX recipe_lines_ingredient_recipe_idx ON recipe_lines(ingredient_recipe_id);

-- Finished preparations consumed when assembling another preparation. Raw food
-- movements remain in ingredient_stock_movements, so flour is deducted only once.
CREATE TABLE recipe_stock_uses (
  id uuid PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  recipe_id uuid NOT NULL REFERENCES recipes(id) ON DELETE RESTRICT,
  quantity numeric(18,8) NOT NULL CHECK(quantity>0),
  stock_lot_id uuid REFERENCES stock_lots(id) ON DELETE RESTRICT,
  meal_id uuid REFERENCES planned_meals(id) ON DELETE CASCADE,
  cancelled_at timestamptz,
  CHECK ((stock_lot_id IS NULL) <> (meal_id IS NULL))
);
CREATE INDEX recipe_stock_uses_recipe_idx ON recipe_stock_uses(household_id,recipe_id) WHERE cancelled_at IS NULL;
