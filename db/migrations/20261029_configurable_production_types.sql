ALTER TABLE households
  ADD COLUMN IF NOT EXISTS production_types jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE recipes DROP CONSTRAINT IF EXISTS recipes_production_type_check;
ALTER TABLE recipes ADD CONSTRAINT recipes_production_type_check
  CHECK (production_type IN ('none','batch_cooking','pasta','pastry','bread')
    OR production_type ~ '^custom-[a-z0-9_-]{1,33}$');
