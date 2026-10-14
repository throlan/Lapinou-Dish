ALTER TABLE households ADD COLUMN plate_ratios jsonb NOT NULL DEFAULT
  '{"whole":{"main":1},"separate":{"main":0.7,"starch":0.3},"three":{"main":0.25,"starch":0.25,"vegetables":0.5}}'::jsonb;
