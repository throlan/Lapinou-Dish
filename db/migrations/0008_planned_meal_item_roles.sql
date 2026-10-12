ALTER TABLE planned_meal_items
  ADD COLUMN role text NOT NULL DEFAULT 'main'
  CHECK (role IN ('main', 'accompaniment', 'beverage'));
