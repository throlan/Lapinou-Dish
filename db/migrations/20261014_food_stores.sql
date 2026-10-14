ALTER TABLE household_order_links ADD CONSTRAINT household_order_links_household_id_id_key UNIQUE (household_id,id);

CREATE TABLE household_food_stores (
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  food_id uuid NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  order_link_id uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id,food_id),
  FOREIGN KEY (household_id,order_link_id) REFERENCES household_order_links(household_id,id) ON DELETE CASCADE
);

CREATE INDEX household_food_stores_link_idx ON household_food_stores(household_id,order_link_id);
