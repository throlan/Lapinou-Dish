ALTER TABLE households ADD COLUMN IF NOT EXISTS catalogue_review_exclusions jsonb NOT NULL
  DEFAULT '{"categories":[],"foodIds":[]}'::jsonb;

-- These preferences affect only the catalogue review list for cooking factors.
-- Foods, recipes, menus, coefficients and stocks are unchanged.
