-- Food classification is separate from household shopping groups.
ALTER TABLE foods ADD COLUMN IF NOT EXISTS food_category text;
CREATE INDEX IF NOT EXISTS foods_category_idx ON foods (food_category);
