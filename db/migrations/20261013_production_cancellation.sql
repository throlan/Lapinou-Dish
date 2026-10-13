ALTER TABLE stock_lots ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE ingredient_stock_movements DROP CONSTRAINT IF EXISTS ingredient_stock_movements_reason_check;
ALTER TABLE ingredient_stock_movements ADD CONSTRAINT ingredient_stock_movements_reason_check
  CHECK (reason IN ('inventory', 'production', 'production-cancelled'));
