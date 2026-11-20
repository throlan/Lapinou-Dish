CREATE TABLE person_daily_macro_intake (
 person_id uuid NOT NULL REFERENCES people(id) ON DELETE CASCADE,
 intake_date date NOT NULL,
 carbohydrate_g numeric(7,2) CHECK (carbohydrate_g BETWEEN 0 AND 10000),
 fat_g numeric(7,2) CHECK (fat_g BETWEEN 0 AND 10000),
 PRIMARY KEY (person_id,intake_date),
 CHECK (carbohydrate_g IS NOT NULL OR fat_g IS NOT NULL)
);
ALTER TABLE person_daily_macro_intake ENABLE ROW LEVEL SECURITY;
CREATE POLICY person_daily_macro_intake_scope ON person_daily_macro_intake
 USING (
  EXISTS (SELECT 1 FROM people p WHERE p.id=person_id AND p.household_id=NULLIF(current_setting('app.household_id',true),'')::uuid)
  AND (current_setting('app.is_manager',true)='true' OR person_id=NULLIF(current_setting('app.person_id',true),'')::uuid)
 );
GRANT SELECT,INSERT,UPDATE,DELETE ON person_daily_macro_intake TO lapinou_request;
