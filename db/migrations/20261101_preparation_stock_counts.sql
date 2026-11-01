CREATE TABLE preparation_stock_counts (
  id uuid PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  recipe_id uuid NOT NULL REFERENCES recipes(id),
  previous_quantity numeric(15,3) NOT NULL,
  counted_quantity numeric(15,3) NOT NULL CHECK (counted_quantity >= 0),
  delta numeric(15,3) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (delta = counted_quantity - previous_quantity)
);
CREATE INDEX preparation_stock_counts_recipe_idx ON preparation_stock_counts(household_id,recipe_id);
