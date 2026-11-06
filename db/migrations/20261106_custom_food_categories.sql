CREATE TABLE custom_food_categories (
  name text PRIMARY KEY CHECK (char_length(name) BETWEEN 1 AND 80 AND name = btrim(name) AND name <> '__none__')
);
CREATE UNIQUE INDEX custom_food_categories_name_ci ON custom_food_categories (lower(name));
