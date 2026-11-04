-- New households start with four meal slots. Existing household settings and
-- historical evening meals remain untouched.
ALTER TABLE households ALTER COLUMN meal_ratios SET DEFAULT
  '{"breakfast":0.2,"lunch":0.4,"snack":0.1,"dinner":0.3,"evening_snack":0}'::jsonb;
