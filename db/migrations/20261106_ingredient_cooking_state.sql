ALTER TABLE recipe_lines ADD COLUMN IF NOT EXISTS cooking_state text NOT NULL DEFAULT 'legacy'
  CHECK (cooking_state IN ('legacy', 'served_raw', 'cooked_from_raw', 'already_cooked'));

-- Existing lines keep their historical calculation until explicitly reviewed.
-- Planned meal quantities are not changed by this migration.
