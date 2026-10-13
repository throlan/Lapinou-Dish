CREATE TABLE IF NOT EXISTS planned_meal_duplications (
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  source_meal_id uuid NOT NULL,
  target_dates date[] NOT NULL,
  slot text NOT NULL,
  meal_ids uuid[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, request_id)
);
