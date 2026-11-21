ALTER TABLE people ADD COLUMN breakfast_drink_recipe_id uuid REFERENCES recipes(id) ON DELETE SET NULL;
