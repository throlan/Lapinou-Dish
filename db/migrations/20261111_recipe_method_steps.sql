ALTER TABLE recipes ADD COLUMN cooking_details jsonb NOT NULL DEFAULT '{}'::jsonb,
 ADD COLUMN instruction_steps jsonb,
 ADD COLUMN review_validated boolean NOT NULL DEFAULT false;
-- Legacy instruction text stays intact; it is presented as ordered steps on read.
