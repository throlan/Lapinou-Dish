ALTER TABLE planned_meals ADD COLUMN IF NOT EXISTS prepared_at timestamptz;

ALTER TABLE ingredient_stock_movements ADD COLUMN IF NOT EXISTS request_id uuid;
ALTER TABLE ingredient_stock_movements ADD COLUMN IF NOT EXISTS source_quantity numeric(18,5);
ALTER TABLE ingredient_stock_movements ADD COLUMN IF NOT EXISTS source_unit_id text;
ALTER TABLE ingredient_stock_movements ADD COLUMN IF NOT EXISTS meal_id uuid REFERENCES planned_meals(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX IF NOT EXISTS ingredient_stock_receipt_request_idx
  ON ingredient_stock_movements(household_id,request_id) WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ingredient_stock_history_idx
  ON ingredient_stock_movements(household_id,food_id,created_at DESC);

ALTER TABLE ingredient_stock_movements DROP CONSTRAINT IF EXISTS ingredient_stock_movements_reason_check;
ALTER TABLE ingredient_stock_movements ADD CONSTRAINT ingredient_stock_movements_reason_check
  CHECK (reason IN ('inventory','production','production-cancelled','purchase','meal-preparation','meal-preparation-cancelled'));
