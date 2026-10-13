CREATE TABLE IF NOT EXISTS household_food_purchase_packs (
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  food_id uuid NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  unit_id text NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
  package_quantity numeric(14,5) NOT NULL CHECK (package_quantity > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, food_id, unit_id)
);
