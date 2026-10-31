ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS serving_part_active boolean NOT NULL DEFAULT true;

DROP INDEX IF EXISTS recipe_serving_part_unique;
CREATE UNIQUE INDEX recipe_serving_part_unique
  ON recipes(parent_recipe_id, serving_part)
  WHERE parent_recipe_id IS NOT NULL AND serving_part_active;
