CREATE TABLE food_change_log (
  id uuid PRIMARY KEY,
  food_id uuid NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  changed_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL,
  before_state jsonb NOT NULL,
  after_state jsonb NOT NULL
);
CREATE INDEX food_change_log_food_date_idx ON food_change_log (food_id, changed_at DESC);
