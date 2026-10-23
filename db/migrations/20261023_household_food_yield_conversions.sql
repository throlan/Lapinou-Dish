CREATE TABLE household_food_yield_conversions (
  id uuid PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  source_food_id uuid NOT NULL REFERENCES foods(id),
  target_food_id uuid NOT NULL REFERENCES foods(id),
  factor numeric(18,8) NOT NULL CHECK (factor > 0 AND factor <= 10),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (source_food_id <> target_food_id),
  UNIQUE (household_id, source_food_id)
);

CREATE INDEX household_food_yield_conversions_target_idx
  ON household_food_yield_conversions(household_id, target_food_id);
