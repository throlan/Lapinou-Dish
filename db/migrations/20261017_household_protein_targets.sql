ALTER TABLE households ADD COLUMN IF NOT EXISTS protein_targets jsonb NOT NULL DEFAULT '{}'::jsonb;
