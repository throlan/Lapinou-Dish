ALTER TABLE recipes ADD COLUMN IF NOT EXISTS production_type text NOT NULL DEFAULT 'none'
  CHECK (production_type IN ('none', 'batch_cooking', 'pasta', 'pastry', 'bread'));

CREATE TABLE IF NOT EXISTS household_routines (
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  routine_id text NOT NULL CHECK (routine_id IN (
    'bulk_shopping', 'fresh_shopping', 'whey_flour_order',
    'pasta_pastry_production', 'bread_production', 'batch_cooking'
  )),
  frequency text NOT NULL CHECK (frequency IN ('weekly', 'biweekly', 'monthly')),
  next_date date NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, routine_id)
);

CREATE TABLE IF NOT EXISTS stock_lots (
  id uuid PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  recipe_id uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  produced_on date NOT NULL,
  quantity numeric(12,3) NOT NULL CHECK (quantity > 0),
  storage text NOT NULL DEFAULT 'freezer' CHECK (storage IN ('pantry', 'fridge', 'freezer')),
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stock_lots_household_recipe_idx ON stock_lots (household_id, recipe_id, produced_on);

CREATE TABLE IF NOT EXISTS household_food_shopping_groups (
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  food_id uuid NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  unit_id text NOT NULL,
  group_id text NOT NULL CHECK (group_id IN ('bulk', 'fresh', 'whey_flour', 'other')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, food_id, unit_id)
);

CREATE TABLE IF NOT EXISTS household_shopping_checks (
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  food_id uuid NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  unit_id text NOT NULL,
  checked boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start),
  PRIMARY KEY (household_id, period_start, period_end, food_id, unit_id)
);
