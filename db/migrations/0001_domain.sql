-- Lapinou Dish initial domain schema. PostgreSQL 16+.
-- No Norish tables or identifiers are reused.

CREATE TABLE households (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE people (
  id uuid PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  birth_date date,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (household_id, display_name)
);

CREATE TABLE nutrition_targets (
  id uuid PRIMARY KEY,
  person_id uuid NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  nutrient_id text NOT NULL,
  value numeric(12, 3) NOT NULL CHECK (value > 0),
  unit_id text NOT NULL,
  effective_from date NOT NULL,
  origin text NOT NULL CHECK (origin IN ('manual', 'clinician', 'estimate')),
  method text,
  status text NOT NULL CHECK (status IN ('active', 'superseded', 'review-needed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX nutrition_targets_person_date_idx ON nutrition_targets (person_id, effective_from DESC);

CREATE TABLE foods (
  id uuid PRIMARY KEY,
  canonical_name text NOT NULL,
  brand text,
  source text NOT NULL CHECK (source IN ('ciqual', 'label', 'manual', 'reviewed-import')),
  source_reference text,
  source_note text,
  grams_per_millilitre numeric(12, 6) CHECK (grams_per_millilitre > 0),
  manual_override boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX foods_ciqual_reference_idx ON foods (source_reference) WHERE source = 'ciqual';
CREATE INDEX foods_name_idx ON foods (lower(canonical_name));

CREATE TABLE food_aliases (
  id uuid PRIMARY KEY,
  food_id uuid NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  alias text NOT NULL,
  normalized_alias text NOT NULL,
  source text NOT NULL CHECK (source IN ('ciqual', 'manual', 'reviewed-import')),
  UNIQUE (food_id, normalized_alias)
);
CREATE INDEX food_alias_search_idx ON food_aliases (normalized_alias);

CREATE TABLE nutrients (
  id text PRIMARY KEY,
  name text NOT NULL,
  unit_id text NOT NULL,
  is_required_for_recipe boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE food_nutrients (
  food_id uuid NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  nutrient_id text NOT NULL REFERENCES nutrients(id) ON DELETE RESTRICT,
  value_per_100g numeric(14, 5) CHECK (value_per_100g >= 0),
  source_note text,
  PRIMARY KEY (food_id, nutrient_id)
);
-- A NULL value is explicitly unknown; zero is a known measured/composition value.

CREATE TABLE units (
  id text PRIMARY KEY,
  name text NOT NULL,
  dimension text NOT NULL CHECK (dimension IN ('mass', 'volume', 'count', 'yield', 'energy')),
  base_unit_id text REFERENCES units(id),
  base_factor numeric(18, 8) CHECK (base_factor > 0),
  is_food_specific boolean NOT NULL DEFAULT false
);

CREATE TABLE food_unit_conversions (
  food_id uuid NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  unit_id text NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
  grams_per_unit numeric(14, 5) NOT NULL CHECK (grams_per_unit > 0),
  source_note text NOT NULL,
  PRIMARY KEY (food_id, unit_id)
);

CREATE TABLE recipes (
  id uuid PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  yield_amount numeric(14, 5) NOT NULL CHECK (yield_amount > 0),
  yield_unit_id text NOT NULL REFERENCES units(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0)
);

CREATE TABLE recipe_variants (
  id uuid PRIMARY KEY,
  recipe_id uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  name text NOT NULL,
  UNIQUE (recipe_id, name)
);

CREATE TABLE recipe_components (
  id uuid PRIMARY KEY,
  recipe_id uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  UNIQUE (recipe_id, name)
);

CREATE TABLE recipe_lines (
  id uuid PRIMARY KEY,
  recipe_id uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  food_id uuid NOT NULL REFERENCES foods(id) ON DELETE RESTRICT,
  quantity numeric(14, 5) NOT NULL CHECK (quantity > 0),
  unit_id text NOT NULL REFERENCES units(id),
  food_state text,
  component_id uuid REFERENCES recipe_components(id) ON DELETE SET NULL,
  variant_id uuid REFERENCES recipe_variants(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  note text
);
CREATE INDEX recipe_lines_recipe_idx ON recipe_lines (recipe_id, sort_order);
CREATE INDEX recipe_lines_food_idx ON recipe_lines (food_id);

-- Imported text remains an untrusted, reviewable draft until every line is
-- linked to a canonical food and the user saves the structured recipe.
CREATE TABLE recipe_import_drafts (
  id uuid PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  source_kind text NOT NULL CHECK (source_kind IN ('clipboard', 'url', 'file', 'manual')),
  source_reference text,
  raw_payload jsonb NOT NULL,
  state text NOT NULL CHECK (state IN ('draft', 'reviewed', 'converted', 'discarded')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE recipe_import_draft_lines (
  id uuid PRIMARY KEY,
  draft_id uuid NOT NULL REFERENCES recipe_import_drafts(id) ON DELETE CASCADE,
  raw_text text NOT NULL,
  suggested_quantity numeric(14, 5),
  suggested_unit_id text REFERENCES units(id),
  suggested_food_id uuid REFERENCES foods(id) ON DELETE SET NULL,
  sort_order integer NOT NULL DEFAULT 0
);
