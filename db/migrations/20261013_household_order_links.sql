CREATE TABLE IF NOT EXISTS household_order_links (
  id uuid PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (length(label) BETWEEN 1 AND 100),
  url text NOT NULL CHECK (url ~ '^https://'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS household_order_links_household_idx
  ON household_order_links (household_id, created_at, id);
