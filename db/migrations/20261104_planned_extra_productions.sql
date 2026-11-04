CREATE TABLE IF NOT EXISTS planned_extra_productions (
  id uuid PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  recipe_id uuid NOT NULL REFERENCES recipes(id) ON DELETE RESTRICT,
  planned_on date NOT NULL,
  quantity numeric(12,3) NOT NULL CHECK (quantity > 0),
  storage text NOT NULL CHECK (storage IN ('pantry', 'fridge', 'freezer')),
  note text NOT NULL DEFAULT '',
  stock_lot_id uuid UNIQUE REFERENCES stock_lots(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS planned_extra_productions_household_date_idx
  ON planned_extra_productions(household_id,planned_on) WHERE stock_lot_id IS NULL;
