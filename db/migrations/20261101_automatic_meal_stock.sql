ALTER TABLE stock_lots ADD COLUMN planned_start date;
ALTER TABLE stock_lots ADD COLUMN planned_end date;
ALTER TABLE stock_lots ADD CONSTRAINT stock_lot_planning_period CHECK (
 (planned_start IS NULL AND planned_end IS NULL) OR
 (planned_start IS NOT NULL AND planned_end IS NOT NULL AND planned_end>=planned_start AND planned_end-planned_start<=62)
);
ALTER TABLE households ADD COLUMN auto_stock_start_date date;
ALTER TABLE planned_meals ADD COLUMN stock_auto_disabled boolean NOT NULL DEFAULT false;
ALTER TABLE recipe_stock_uses ADD COLUMN automatic boolean NOT NULL DEFAULT false;
ALTER TABLE recipe_stock_uses ADD COLUMN planned_item_id uuid REFERENCES planned_meal_items(id) ON DELETE SET NULL;
ALTER TABLE recipe_stock_uses ADD COLUMN source_allocations jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE recipe_stock_uses ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE recipe_stock_uses ADD CONSTRAINT automatic_meal_use CHECK (
 NOT automatic OR (meal_id IS NOT NULL AND stock_lot_id IS NULL AND (cancelled_at IS NOT NULL OR planned_item_id IS NOT NULL))
);
CREATE UNIQUE INDEX automatic_meal_use_once ON recipe_stock_uses(planned_item_id) WHERE automatic AND cancelled_at IS NULL;
