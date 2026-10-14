CREATE TABLE IF NOT EXISTS household_food_purchase_units (
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  food_id uuid NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  singular_label text NOT NULL CHECK (length(singular_label) BETWEEN 1 AND 60),
  plural_label text NOT NULL CHECK (length(plural_label) BETWEEN 1 AND 60),
  covered_quantity numeric(14,5) NOT NULL CHECK (covered_quantity > 0),
  covered_unit_id text NOT NULL REFERENCES units(id),
  estimate_note text NOT NULL DEFAULT '' CHECK (length(estimate_note) <= 160),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, food_id)
);
