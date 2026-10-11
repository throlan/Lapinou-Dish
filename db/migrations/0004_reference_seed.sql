CREATE TABLE reference_data_versions (
  dataset_id text PRIMARY KEY,
  version text NOT NULL,
  record_count integer NOT NULL CHECK (record_count >= 0),
  applied_at timestamptz NOT NULL DEFAULT now()
);
