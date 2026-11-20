ALTER TABLE households ADD COLUMN common_protein_portion_g integer NOT NULL DEFAULT 200
  CHECK (common_protein_portion_g BETWEEN 1 AND 5000);
