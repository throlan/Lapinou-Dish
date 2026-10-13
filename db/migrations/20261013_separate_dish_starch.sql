-- Raw ingredients and cooked serving weights are kept separate.
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS separate_starch boolean NOT NULL DEFAULT false;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS serving_weights jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS cooking_factors jsonb NOT NULL DEFAULT '{"main":1,"starch":3}'::jsonb;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS parent_recipe_id uuid REFERENCES recipes(id) ON DELETE RESTRICT;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS serving_part text CHECK (serving_part IN ('main','starch'));
CREATE UNIQUE INDEX IF NOT EXISTS recipe_serving_part_unique ON recipes(parent_recipe_id, serving_part);
ALTER TABLE recipe_lines ADD COLUMN IF NOT EXISTS serving_part text NOT NULL DEFAULT 'main' CHECK (serving_part IN ('main','starch'));
ALTER TABLE recipe_lines ADD COLUMN IF NOT EXISTS cooking_factor numeric CHECK (cooking_factor > 0 AND cooking_factor <= 10);
ALTER TABLE stock_lots ADD COLUMN IF NOT EXISTS is_serving_bundle boolean NOT NULL DEFAULT false;
ALTER TABLE stock_lots ADD COLUMN IF NOT EXISTS parent_lot_id uuid REFERENCES stock_lots(id) ON DELETE RESTRICT;
