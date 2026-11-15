ALTER TABLE stock_lots ADD COLUMN planned_meal_id uuid REFERENCES planned_meals(id) ON DELETE SET NULL;
CREATE INDEX stock_lots_planned_meal ON stock_lots(planned_meal_id) WHERE planned_meal_id IS NOT NULL;
