CREATE TABLE person_weight_entries (
  id uuid PRIMARY KEY,
  person_id uuid NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  measured_on date NOT NULL,
  weight_kg numeric(6, 2) NOT NULL CHECK (weight_kg > 0 AND weight_kg <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (person_id, measured_on)
);
CREATE INDEX person_weight_entries_history_idx ON person_weight_entries (person_id, measured_on DESC);

CREATE TABLE person_profile_history (
  id uuid PRIMARY KEY,
  person_id uuid NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  effective_from date NOT NULL,
  height_cm numeric(5, 1) CHECK (height_cm >= 50 AND height_cm <= 260),
  activity_level text CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  daily_energy_kcal integer CHECK (daily_energy_kcal >= 500 AND daily_energy_kcal <= 10000),
  daily_energy_origin text CHECK (daily_energy_origin IN ('manual', 'clinician', 'estimate')),
  daily_energy_method text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (person_id, effective_from),
  CHECK ((daily_energy_kcal IS NULL AND daily_energy_origin IS NULL) OR (daily_energy_kcal IS NOT NULL AND daily_energy_origin IS NOT NULL))
);
CREATE INDEX person_profile_history_idx ON person_profile_history (person_id, effective_from DESC);

CREATE TABLE planned_meals (
  id uuid PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  meal_date date NOT NULL,
  slot text NOT NULL CHECK (slot IN ('breakfast', 'lunch', 'dinner', 'snack')),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX planned_meals_week_idx ON planned_meals (household_id, meal_date, slot);

CREATE TABLE planned_meal_attendees (
  meal_id uuid NOT NULL REFERENCES planned_meals(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  PRIMARY KEY (meal_id, person_id)
);

CREATE TABLE planned_meal_items (
  id uuid PRIMARY KEY,
  meal_id uuid NOT NULL REFERENCES planned_meals(id) ON DELETE CASCADE,
  recipe_id uuid NOT NULL REFERENCES recipes(id) ON DELETE RESTRICT,
  sort_order integer NOT NULL DEFAULT 0
);
CREATE INDEX planned_meal_items_meal_idx ON planned_meal_items (meal_id, sort_order);

CREATE TABLE planned_amounts (
  planned_item_id uuid NOT NULL REFERENCES planned_meal_items(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  quantity numeric(14, 5) NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (planned_item_id, person_id)
);
