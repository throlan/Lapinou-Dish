-- All food definitions are common; shopping settings and inventories stay private.
UPDATE foods SET official=true;
ALTER TABLE foods ALTER COLUMN official SET DEFAULT true;
DROP POLICY food_read ON foods;
CREATE POLICY food_read ON foods FOR SELECT USING(true);
DROP POLICY food_create ON foods;
CREATE POLICY food_create ON foods FOR INSERT WITH CHECK (
 current_setting('app.is_admin',true)='true' OR
 (owner_household_id=NULLIF(current_setting('app.household_id',true),'')::uuid AND official)
);
DROP POLICY food_update ON foods;
CREATE POLICY food_update ON foods FOR UPDATE USING(current_setting('app.is_admin',true)='true')
 WITH CHECK(current_setting('app.is_admin',true)='true');
DROP POLICY food_delete ON foods;
CREATE POLICY food_delete ON foods FOR DELETE USING(current_setting('app.is_admin',true)='true');
DO $$
DECLARE item text; rule text;
BEGIN
 FOREACH item IN ARRAY ARRAY['food_aliases','food_nutrients','food_unit_conversions','food_change_log'] LOOP
  EXECUTE format('DROP POLICY food_create ON %I',item);
  EXECUTE format('DROP POLICY food_update ON %I',item);
  EXECUTE format('DROP POLICY food_delete ON %I',item);
  rule:=format('EXISTS(SELECT 1 FROM foods f WHERE f.id=%I.food_id AND (current_setting(''app.is_admin'',true)=''true'' OR (f.owner_household_id=NULLIF(current_setting(''app.household_id'',true),'''')::uuid AND f.created_at>=transaction_timestamp())))',item);
  EXECUTE format('CREATE POLICY food_create ON %I FOR INSERT WITH CHECK(%s)',item,rule);
  rule:=format('EXISTS(SELECT 1 FROM foods f WHERE f.id=%I.food_id AND current_setting(''app.is_admin'',true)=''true'')',item);
  EXECUTE format('CREATE POLICY food_update ON %I FOR UPDATE USING(%s) WITH CHECK(%s)',item,rule,rule);
  EXECUTE format('CREATE POLICY food_delete ON %I FOR DELETE USING(%s)',item,rule);
 END LOOP;
END $$;

CREATE TABLE food_correction_proposals (
 id uuid PRIMARY KEY, food_id uuid NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
 account_id uuid REFERENCES app_accounts(id) ON DELETE SET NULL,
 household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
 before_state jsonb NOT NULL, proposed_state jsonb NOT NULL,
 reason text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'pending'
 CHECK(status IN('pending','approved','rejected')),
 created_at timestamptz NOT NULL DEFAULT now(), reviewed_at timestamptz,
 reviewed_by uuid REFERENCES app_accounts(id) ON DELETE SET NULL
);

ALTER TABLE recipes ADD COLUMN review_key uuid NOT NULL DEFAULT gen_random_uuid();
UPDATE recipes SET review_key=id;
-- Existing imported roots keep the identity of the original, including re-shares.
WITH RECURSIVE mappings AS (
 SELECT i.result_id AS target,(p.payload->>'rootId')::uuid AS source
 FROM household_publication_imports i JOIN shared_publications p ON p.id=i.publication_id
 JOIN recipes r ON r.id=i.result_id WHERE p.kind='recipe'
), lineage AS (
 SELECT target,source,ARRAY[target,source] AS path FROM mappings
 UNION ALL
 SELECT l.target,m.source,l.path||m.source FROM lineage l JOIN mappings m ON m.target=l.source
 WHERE NOT m.source=ANY(l.path)
), resolved AS (
 SELECT DISTINCT ON(target) target,source FROM lineage ORDER BY target,array_length(path,1) DESC
)
UPDATE recipes r SET review_key=resolved.source FROM resolved WHERE r.id=resolved.target;
CREATE TABLE recipe_reviews (
 account_id uuid NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
 meal_id uuid NOT NULL REFERENCES planned_meals(id) ON DELETE CASCADE,
 recipe_id uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
 score integer NOT NULL CHECK(score BETWEEN 1 AND 5),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(account_id,meal_id,recipe_id)
);
CREATE INDEX recipe_reviews_recipe ON recipe_reviews(recipe_id);
CREATE INDEX recipes_review_key ON recipes(review_key);

ALTER TABLE shared_publications ADD COLUMN source_recipe_id uuid;
UPDATE shared_publications SET source_recipe_id=(payload->>'rootId')::uuid WHERE kind='recipe';
-- Preserve old publications; future batch publishing reuses the newest one.
CREATE INDEX shared_publications_recipe_source ON shared_publications(author_household_id,source_recipe_id);
ALTER TABLE shared_publications ENABLE ROW LEVEL SECURITY;
CREATE POLICY publication_read ON shared_publications FOR SELECT USING(NOT withdrawn OR author_household_id=NULLIF(current_setting('app.household_id',true),'')::uuid);
CREATE POLICY publication_create ON shared_publications FOR INSERT WITH CHECK(author_household_id=NULLIF(current_setting('app.household_id',true),'')::uuid);
CREATE POLICY publication_update ON shared_publications FOR UPDATE
 USING(author_household_id=NULLIF(current_setting('app.household_id',true),'')::uuid)
 WITH CHECK(author_household_id=NULLIF(current_setting('app.household_id',true),'')::uuid);
GRANT SELECT,INSERT,UPDATE ON shared_publications TO lapinou_request;
