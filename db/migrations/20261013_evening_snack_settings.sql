ALTER TABLE planned_meals DROP CONSTRAINT IF EXISTS planned_meals_slot_check;
ALTER TABLE planned_meals ADD CONSTRAINT planned_meals_slot_check CHECK (slot IN ('breakfast','lunch','snack','dinner','evening_snack'));
ALTER TABLE households ADD COLUMN IF NOT EXISTS meal_ratios jsonb NOT NULL DEFAULT '{"breakfast":0.15,"lunch":0.4,"snack":0.1,"dinner":0.25,"evening_snack":0.1}'::jsonb;
