CREATE TABLE energy_saving_plans (
  id uuid PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  starts_on date NOT NULL,
  ends_on date NOT NULL CHECK (ends_on >= starts_on),
  daily_kcal numeric(10,2) NOT NULL CHECK (daily_kcal > 0 AND daily_kcal <= 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX energy_saving_plans_person_dates_idx ON energy_saving_plans (person_id, starts_on, ends_on);

ALTER TABLE planned_meals ADD COLUMN is_occasion boolean NOT NULL DEFAULT false;
ALTER TABLE planned_meals ADD COLUMN occasion_title text NOT NULL DEFAULT '';

CREATE TABLE planned_occasion_energy (
  meal_id uuid NOT NULL REFERENCES planned_meals(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  energy_kcal numeric(10,2) NOT NULL CHECK (energy_kcal >= 0 AND energy_kcal <= 100000),
  PRIMARY KEY (meal_id, person_id)
);
