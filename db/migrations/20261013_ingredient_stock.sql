CREATE TABLE IF NOT EXISTS household_ingredient_stock (
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  food_id uuid NOT NULL REFERENCES foods(id) ON DELETE RESTRICT,
  quantity_g numeric(18,5) NOT NULL CHECK (quantity_g >= 0),
  minimum_g numeric(18,5) NOT NULL CHECK (minimum_g >= 0),
  target_g numeric(18,5) NOT NULL CHECK (target_g >= minimum_g),
  lead_days integer NOT NULL CHECK (lead_days BETWEEN 0 AND 60),
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, food_id)
);

CREATE TABLE IF NOT EXISTS ingredient_stock_movements (
  id uuid PRIMARY KEY,
  household_id uuid NOT NULL,
  food_id uuid NOT NULL,
  delta_g numeric(18,5) NOT NULL,
  reason text NOT NULL CHECK (reason IN ('inventory', 'production')),
  stock_lot_id uuid REFERENCES stock_lots(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (household_id, food_id) REFERENCES household_ingredient_stock(household_id, food_id)
);

ALTER TABLE stock_lots ADD COLUMN IF NOT EXISTS request_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS stock_lots_request_idx ON stock_lots(household_id, request_id) WHERE request_id IS NOT NULL;
