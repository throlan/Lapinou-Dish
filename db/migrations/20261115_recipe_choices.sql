CREATE TABLE recipe_choice_lists (
 id uuid PRIMARY KEY, household_id uuid NOT NULL REFERENCES households(id),
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 100),
 food_ids uuid[] NOT NULL, version integer NOT NULL DEFAULT 0,
 archived boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE recipe_choice_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_choice_lists FORCE ROW LEVEL SECURITY;
CREATE POLICY household_scope ON recipe_choice_lists
 USING (household_id::text=current_setting('app.household_id',true))
 WITH CHECK (household_id::text=current_setting('app.household_id',true));
GRANT SELECT,INSERT,UPDATE,DELETE ON recipe_choice_lists TO lapinou_request;
ALTER TABLE recipes ADD COLUMN choice_groups jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE recipes ADD COLUMN choice_instance boolean NOT NULL DEFAULT false;
ALTER TABLE recipes ADD COLUMN choice_origin jsonb;
CREATE INDEX recipe_choice_instances ON recipes(household_id,((choice_origin->>'key'))) WHERE choice_instance;
CREATE TABLE recipe_choice_food_refs (
 recipe_id uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
 food_id uuid NOT NULL REFERENCES foods(id) ON DELETE RESTRICT,
 PRIMARY KEY(recipe_id,food_id)
);
ALTER TABLE recipe_choice_food_refs ENABLE ROW LEVEL SECURITY;
CREATE POLICY household_scope ON recipe_choice_food_refs
 USING (EXISTS(SELECT 1 FROM recipes WHERE id=recipe_id))
 WITH CHECK (EXISTS(SELECT 1 FROM recipes WHERE id=recipe_id));
GRANT SELECT,INSERT,DELETE ON recipe_choice_food_refs TO lapinou_request;
CREATE TABLE recipe_choice_list_food_refs (
 list_id uuid NOT NULL REFERENCES recipe_choice_lists(id) ON DELETE CASCADE,
 food_id uuid NOT NULL REFERENCES foods(id) ON DELETE RESTRICT,
 PRIMARY KEY(list_id,food_id)
);
ALTER TABLE recipe_choice_list_food_refs ENABLE ROW LEVEL SECURITY;
CREATE POLICY household_scope ON recipe_choice_list_food_refs
 USING (EXISTS(SELECT 1 FROM recipe_choice_lists WHERE id=list_id))
 WITH CHECK (EXISTS(SELECT 1 FROM recipe_choice_lists WHERE id=list_id));
GRANT SELECT,INSERT,DELETE ON recipe_choice_list_food_refs TO lapinou_request;
