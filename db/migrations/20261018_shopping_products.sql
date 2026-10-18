-- Purchase aliases do not replace the food or its nutritional data in recipes.
CREATE TABLE household_purchase_products (
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  food_id uuid NOT NULL REFERENCES foods(id),
  purchase_food_id uuid NOT NULL REFERENCES foods(id),
  source_unit_id text NOT NULL REFERENCES units(id),
  target_unit_id text NOT NULL REFERENCES units(id),
  factor numeric NOT NULL CHECK (factor > 0 AND factor <= 1000000),
  PRIMARY KEY (household_id,food_id),
  CHECK (food_id <> purchase_food_id)
);
CREATE TABLE household_shopping_exclusions (
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  food_id uuid NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  scope text NOT NULL,
  PRIMARY KEY (household_id,food_id,scope)
);
