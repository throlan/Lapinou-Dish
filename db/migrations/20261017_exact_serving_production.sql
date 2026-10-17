-- Keep the requested per-service quantities for atomic production retries.
-- The bundle itself is not physical stock; its child lots carry the grams.
ALTER TABLE stock_lots ADD COLUMN IF NOT EXISTS serving_quantities jsonb
  CHECK (serving_quantities IS NULL OR jsonb_typeof(serving_quantities) = 'object');
