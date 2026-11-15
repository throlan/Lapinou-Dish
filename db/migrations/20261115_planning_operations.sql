-- Durable idempotency for atomic planning additions and day/week copies.
CREATE TABLE planning_operations (
 household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
 request_id uuid NOT NULL,
 payload jsonb NOT NULL,
 result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (household_id, request_id)
);
ALTER TABLE planning_operations ENABLE ROW LEVEL SECURITY;
CREATE POLICY household_scope ON planning_operations
 USING (household_id=NULLIF(current_setting('app.household_id',true),'')::uuid)
 WITH CHECK (household_id=NULLIF(current_setting('app.household_id',true),'')::uuid
             AND current_setting('app.is_manager',true)='true');
GRANT SELECT,INSERT ON planning_operations TO lapinou_request;
