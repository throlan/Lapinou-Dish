-- A shop may be a physical store with no website.
ALTER TABLE household_order_links ALTER COLUMN url DROP NOT NULL;
ALTER TABLE household_order_links DROP CONSTRAINT IF EXISTS household_order_links_url_check;
ALTER TABLE household_order_links ADD CONSTRAINT household_order_links_url_check
  CHECK (url IS NULL OR url ~ '^https://');
ALTER TABLE household_order_links ADD COLUMN home_assistant_entity_id text
  CHECK (home_assistant_entity_id IS NULL OR home_assistant_entity_id ~ '^todo\.[a-z0-9_]+$');
