ALTER TABLE recipes
  ADD COLUMN recipe_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN replaced_by_recipe_id uuid REFERENCES recipes(id) ON DELETE SET NULL;
