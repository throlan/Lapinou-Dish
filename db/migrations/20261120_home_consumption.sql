CREATE TABLE person_daily_home_consumption (
  person_id uuid NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  consumption_date date NOT NULL,
  parts jsonb NOT NULL CHECK (jsonb_typeof(parts) = 'array'),
  revision uuid NOT NULL,
  PRIMARY KEY (person_id, consumption_date)
);
ALTER TABLE person_daily_home_consumption ENABLE ROW LEVEL SECURITY;
CREATE POLICY person_daily_home_consumption_scope ON person_daily_home_consumption
 USING (
  EXISTS (SELECT 1 FROM people p WHERE p.id=person_id AND p.household_id=NULLIF(current_setting('app.household_id',true),'')::uuid)
  AND (current_setting('app.is_manager',true)='true' OR person_id=NULLIF(current_setting('app.person_id',true),'')::uuid)
 );
GRANT SELECT,INSERT,UPDATE ON person_daily_home_consumption TO lapinou_request;
