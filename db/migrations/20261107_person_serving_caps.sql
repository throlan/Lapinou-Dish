ALTER TABLE households ADD COLUMN serving_caps jsonb NOT NULL DEFAULT '{}'::jsonb;
