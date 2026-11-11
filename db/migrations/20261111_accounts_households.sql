CREATE TABLE app_accounts (
 id uuid PRIMARY KEY, login text NOT NULL, display_name text NOT NULL,
 password_hash text NOT NULL, application_admin boolean NOT NULL DEFAULT false,
 active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX app_accounts_login_ci ON app_accounts(lower(login));
CREATE TABLE household_memberships (
 account_id uuid NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
 household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
 person_id uuid REFERENCES people(id) ON DELETE RESTRICT,
 role text NOT NULL CHECK(role IN ('manager','member')),
 PRIMARY KEY(account_id,household_id), UNIQUE(household_id,person_id)
);
CREATE TABLE account_sessions (
 token_hash text PRIMARY KEY, account_id uuid NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
 active_household_id uuid REFERENCES households(id) ON DELETE SET NULL,
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX account_sessions_expiry ON account_sessions(expires_at);
ALTER TABLE foods ADD COLUMN owner_household_id uuid REFERENCES households(id) ON DELETE RESTRICT
 DEFAULT NULLIF(current_setting('app.household_id',true),'')::uuid,
 ADD COLUMN official boolean NOT NULL DEFAULT false;
UPDATE foods SET official=(source='ciqual'),
 owner_household_id=CASE WHEN source<>'ciqual' THEN (SELECT id FROM households ORDER BY created_at,id LIMIT 1) ELSE NULL END;
ALTER TABLE custom_food_categories ADD COLUMN owner_household_id uuid REFERENCES households(id) ON DELETE CASCADE
 DEFAULT NULLIF(current_setting('app.household_id',true),'')::uuid;
UPDATE custom_food_categories SET owner_household_id=(SELECT id FROM households ORDER BY created_at,id LIMIT 1);
DROP INDEX custom_food_categories_name_ci;
ALTER TABLE custom_food_categories DROP CONSTRAINT custom_food_categories_pkey;
ALTER TABLE custom_food_categories ADD COLUMN id uuid PRIMARY KEY DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX custom_food_categories_name_ci ON custom_food_categories
 (COALESCE(owner_household_id,'00000000-0000-0000-0000-000000000000'::uuid),lower(name));
CREATE TABLE shared_publications (
 id uuid PRIMARY KEY, author_household_id uuid REFERENCES households(id) ON DELETE SET NULL,
 kind text NOT NULL CHECK(kind IN ('recipe','food')), name text NOT NULL,
 payload jsonb NOT NULL, published_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE starter_packages (
 id uuid PRIMARY KEY, name text NOT NULL, description text NOT NULL DEFAULT '',
 publication_ids uuid[] NOT NULL DEFAULT '{}', active boolean NOT NULL DEFAULT true
);
CREATE TABLE household_publication_imports (
 household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
 publication_id uuid NOT NULL REFERENCES shared_publications(id) ON DELETE RESTRICT,
 result_id uuid NOT NULL, PRIMARY KEY(household_id,publication_id)
);
DO $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='lapinou_request') THEN
  CREATE ROLE lapinou_request NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
 END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='lapinou_request' AND (rolsuper OR rolbypassrls OR rolcanlogin)) THEN
  RAISE EXCEPTION 'lapinou_request must be a restricted NOLOGIN role';
 END IF;
 EXECUTE format('GRANT lapinou_request TO %I',current_user);
END $$;
GRANT USAGE ON SCHEMA public TO lapinou_request;

DO $$
DECLARE item record; predicate text; ref text; col text;
BEGIN
 FOR item IN SELECT tablename FROM pg_tables WHERE schemaname='public'
  AND tablename NOT IN ('app_accounts','account_sessions','household_memberships','shared_publications','starter_packages','household_publication_imports')
 LOOP
  predicate:=NULL;
  IF item.tablename='households' THEN predicate:='id=NULLIF(current_setting(''app.household_id'',true),'''')::uuid';
  ELSIF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=item.tablename AND column_name='household_id') THEN
   predicate:='household_id=NULLIF(current_setting(''app.household_id'',true),'''')::uuid';
  ELSE
   FOREACH col IN ARRAY ARRAY['person_id','recipe_id','meal_id','planned_item_id','draft_id'] LOOP
    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=item.tablename AND column_name=col) THEN
     ref:=CASE col WHEN 'person_id' THEN 'people' WHEN 'recipe_id' THEN 'recipes'
      WHEN 'meal_id' THEN 'planned_meals' WHEN 'planned_item_id' THEN 'planned_meal_items' ELSE 'recipe_import_drafts' END;
     predicate:=format('EXISTS(SELECT 1 FROM %I linked WHERE linked.id=%I.%I)',ref,item.tablename,col);
     EXIT;
    END IF;
   END LOOP;
  END IF;
  IF predicate IS NOT NULL THEN
   EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',item.tablename);
   EXECUTE format('CREATE POLICY household_scope ON %I USING (%s) WITH CHECK (%s)',item.tablename,predicate,predicate);
   EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON %I TO lapinou_request',item.tablename);
  END IF;
 END LOOP;
END $$;
ALTER TABLE foods ENABLE ROW LEVEL SECURITY;
CREATE POLICY food_read ON foods FOR SELECT USING (
 official OR owner_household_id=NULLIF(current_setting('app.household_id',true),'')::uuid
);
CREATE POLICY food_create ON foods FOR INSERT WITH CHECK (
 owner_household_id=NULLIF(current_setting('app.household_id',true),'')::uuid AND NOT official
);
CREATE POLICY food_update ON foods FOR UPDATE
 USING (owner_household_id=NULLIF(current_setting('app.household_id',true),'')::uuid OR (official AND current_setting('app.is_admin',true)='true'))
 WITH CHECK (owner_household_id=NULLIF(current_setting('app.household_id',true),'')::uuid OR (official AND current_setting('app.is_admin',true)='true'));
CREATE POLICY food_delete ON foods FOR DELETE USING (
 owner_household_id=NULLIF(current_setting('app.household_id',true),'')::uuid OR (official AND current_setting('app.is_admin',true)='true')
);
GRANT SELECT,INSERT,UPDATE,DELETE ON foods TO lapinou_request;
DO $$
DECLARE name text; read_rule text; write_rule text;
BEGIN
 FOREACH name IN ARRAY ARRAY['food_aliases','food_nutrients','food_unit_conversions','food_change_log'] LOOP
  read_rule:=format('EXISTS(SELECT 1 FROM foods f WHERE f.id=%I.food_id)',name);
  write_rule:=format('EXISTS(SELECT 1 FROM foods f WHERE f.id=%I.food_id AND (f.owner_household_id=NULLIF(current_setting(''app.household_id'',true),'''')::uuid OR (f.official AND current_setting(''app.is_admin'',true)=''true'')))',name);
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',name);
  EXECUTE format('CREATE POLICY food_read ON %I FOR SELECT USING(%s)',name,read_rule);
  EXECUTE format('CREATE POLICY food_create ON %I FOR INSERT WITH CHECK(%s)',name,write_rule);
  EXECUTE format('CREATE POLICY food_update ON %I FOR UPDATE USING(%s) WITH CHECK(%s)',name,write_rule,write_rule);
  EXECUTE format('CREATE POLICY food_delete ON %I FOR DELETE USING(%s)',name,write_rule);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON %I TO lapinou_request',name);
 END LOOP;
END $$;
ALTER TABLE custom_food_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY category_scope ON custom_food_categories USING (
 owner_household_id IS NULL OR owner_household_id=NULLIF(current_setting('app.household_id',true),'')::uuid
) WITH CHECK(owner_household_id=NULLIF(current_setting('app.household_id',true),'')::uuid);
GRANT SELECT,INSERT ON custom_food_categories TO lapinou_request;
GRANT SELECT ON nutrients,units,reference_data_versions TO lapinou_request;

DO $$
DECLARE item record; predicate text; checks text; col text; target text;
BEGIN
 FOR item IN SELECT c.relname AS name,p.polname,pg_get_expr(p.polqual,p.polrelid) AS predicate
 FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND p.polname='household_scope'
 LOOP
  checks:=item.predicate;
  FOR col,target IN SELECT column_name,
   CASE WHEN column_name IN('person_id') THEN 'people'
    WHEN column_name IN('recipe_id','ingredient_recipe_id') THEN 'recipes'
    WHEN column_name IN('food_id','suggested_food_id','purchase_food_id') THEN 'foods' END
   FROM information_schema.columns WHERE table_schema='public' AND table_name=item.name
    AND column_name IN('person_id','recipe_id','ingredient_recipe_id','food_id','suggested_food_id','purchase_food_id')
  LOOP
   checks:=checks||format(' AND (%I IS NULL OR EXISTS(SELECT 1 FROM %I visible WHERE visible.id=%I.%I))',col,target,item.name,col);
  END LOOP;
  EXECUTE format('ALTER POLICY household_scope ON %I WITH CHECK (%s)',item.name,checks);
 END LOOP;
END $$;


ALTER TABLE shared_publications ADD COLUMN withdrawn boolean NOT NULL DEFAULT false;
ALTER TABLE household_publication_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY import_scope ON household_publication_imports USING (
 household_id=NULLIF(current_setting('app.household_id',true),'')::uuid
) WITH CHECK(household_id=NULLIF(current_setting('app.household_id',true),'')::uuid);
GRANT SELECT,INSERT ON household_publication_imports TO lapinou_request;


-- Preserve the formerly global private catalogue separately for every existing household.
DO $$
DECLARE home record; primary_home uuid; table_row record; column_row record; parent_table text;
BEGIN
 SELECT id INTO primary_home FROM households ORDER BY created_at,id LIMIT 1;
 IF primary_home IS NULL THEN RETURN; END IF;
 CREATE TEMP TABLE legacy_food_map(old_id uuid PRIMARY KEY,new_id uuid NOT NULL) ON COMMIT DROP;
 FOR home IN SELECT id FROM households WHERE id<>primary_home ORDER BY id LOOP
  TRUNCATE legacy_food_map;
  INSERT INTO legacy_food_map SELECT id,gen_random_uuid() FROM foods WHERE NOT official AND owner_household_id=primary_home;
  INSERT INTO foods SELECT (jsonb_populate_record(NULL::foods,to_jsonb(f)||jsonb_build_object(
   'id',mapping.new_id,'owner_household_id',home.id))).*
   FROM foods f JOIN legacy_food_map mapping ON mapping.old_id=f.id;
  INSERT INTO food_aliases(id,food_id,alias,normalized_alias,source)
   SELECT gen_random_uuid(),mapping.new_id,a.alias,a.normalized_alias,a.source
   FROM food_aliases a JOIN legacy_food_map mapping ON mapping.old_id=a.food_id;
  INSERT INTO food_nutrients SELECT mapping.new_id,n.nutrient_id,n.value_per_100g,n.source_note
   FROM food_nutrients n JOIN legacy_food_map mapping ON mapping.old_id=n.food_id;
  INSERT INTO food_unit_conversions(food_id,unit_id,grams_per_unit,source_note)
   SELECT mapping.new_id,c.unit_id,c.grams_per_unit,c.source_note FROM food_unit_conversions c JOIN legacy_food_map mapping ON mapping.old_id=c.food_id;
  FOR table_row IN SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='household_id' LOOP
   FOR column_row IN SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=table_row.table_name
    AND column_name IN('food_id','purchase_food_id','source_food_id','target_food_id') LOOP
    EXECUTE format('UPDATE %I row SET %I=mapping.new_id FROM legacy_food_map mapping WHERE row.household_id=$1 AND row.%I=mapping.old_id',
     table_row.table_name,column_row.column_name,column_row.column_name) USING home.id;
   END LOOP;
  END LOOP;
  UPDATE recipe_lines row SET food_id=mapping.new_id FROM legacy_food_map mapping,recipes recipe
   WHERE row.recipe_id=recipe.id AND recipe.household_id=home.id AND row.food_id=mapping.old_id;
  UPDATE recipe_import_draft_lines row SET suggested_food_id=mapping.new_id FROM legacy_food_map mapping,recipe_import_drafts draft
   WHERE row.draft_id=draft.id AND draft.household_id=home.id AND row.suggested_food_id=mapping.old_id;
  INSERT INTO custom_food_categories(name,owner_household_id)
   SELECT name,home.id FROM custom_food_categories WHERE owner_household_id=primary_home ON CONFLICT DO NOTHING;
 END LOOP;
END $$;
ALTER POLICY household_scope ON person_weight_entries USING (
 EXISTS(SELECT 1 FROM people p WHERE p.id=person_id)
 AND (current_setting('app.is_manager',true)='true' OR person_id=NULLIF(current_setting('app.person_id',true),'')::uuid)
) WITH CHECK (
 EXISTS(SELECT 1 FROM people p WHERE p.id=person_id)
 AND (current_setting('app.is_manager',true)='true' OR person_id=NULLIF(current_setting('app.person_id',true),'')::uuid)
);
ALTER POLICY household_scope ON person_profile_history USING (
 EXISTS(SELECT 1 FROM people p WHERE p.id=person_id)
 AND (current_setting('app.is_manager',true)='true' OR person_id=NULLIF(current_setting('app.person_id',true),'')::uuid)
) WITH CHECK (
 EXISTS(SELECT 1 FROM people p WHERE p.id=person_id)
 AND (current_setting('app.is_manager',true)='true' OR person_id=NULLIF(current_setting('app.person_id',true),'')::uuid)
);


CREATE TABLE household_imported_foods (
 household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
 fingerprint text NOT NULL,food_id uuid NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
 PRIMARY KEY(household_id,fingerprint)
);
ALTER TABLE household_imported_foods ENABLE ROW LEVEL SECURITY;
CREATE POLICY imported_food_scope ON household_imported_foods USING (
 household_id=NULLIF(current_setting('app.household_id',true),'')::uuid
) WITH CHECK (
 household_id=NULLIF(current_setting('app.household_id',true),'')::uuid AND EXISTS(SELECT 1 FROM foods f WHERE f.id=food_id)
);
GRANT SELECT,INSERT ON household_imported_foods TO lapinou_request;


CREATE TABLE household_imported_recipes (
 household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
 fingerprint text NOT NULL,recipe_id uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
 PRIMARY KEY(household_id,fingerprint)
);
ALTER TABLE household_imported_recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY imported_recipe_scope ON household_imported_recipes USING (
 household_id=NULLIF(current_setting('app.household_id',true),'')::uuid
) WITH CHECK (
 household_id=NULLIF(current_setting('app.household_id',true),'')::uuid AND EXISTS(SELECT 1 FROM recipes r WHERE r.id=recipe_id)
);
GRANT SELECT,INSERT ON household_imported_recipes TO lapinou_request;


GRANT DELETE ON household_publication_imports TO lapinou_request;
