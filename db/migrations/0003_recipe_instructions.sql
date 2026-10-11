ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS instructions text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS source_url text;

ALTER TABLE recipe_import_draft_lines
  ADD COLUMN IF NOT EXISTS suggested_food_name text;

CREATE UNIQUE INDEX IF NOT EXISTS recipe_import_file_source_idx
  ON recipe_import_drafts (household_id, source_reference)
  WHERE source_kind = 'file' AND source_reference IS NOT NULL;
