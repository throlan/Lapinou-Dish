ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS minimum_production_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS minimum_production_unit_id text NOT NULL DEFAULT 'portion';

ALTER TABLE recipes DROP CONSTRAINT IF EXISTS recipes_minimum_production_unit_check;
ALTER TABLE recipes ADD CONSTRAINT recipes_minimum_production_unit_check
  CHECK (minimum_production_unit_id IN ('piece','slice','portion','g','ml'));
ALTER TABLE recipes DROP CONSTRAINT IF EXISTS recipes_minimum_production_amount_check;
ALTER TABLE recipes ADD CONSTRAINT recipes_minimum_production_amount_check
  CHECK (minimum_production_amount >= 0 AND minimum_production_amount <= 100000);

-- Preserve the previous household-wide minimum by copying it to each recipe
-- currently assigned to that production category. Future settings are per recipe.
UPDATE recipes r
SET minimum_production_amount=COALESCE((
      SELECT NULLIF(item->>'minimumAmount','')::numeric
      FROM households h CROSS JOIN LATERAL jsonb_array_elements(h.production_types) AS production_types(item)
      WHERE h.id=r.household_id AND item->>'id'=r.production_type
        AND (SELECT count(*) FROM recipes members WHERE members.household_id=r.household_id AND members.production_type=r.production_type AND members.parent_recipe_id IS NULL)=1
    ),0),
    minimum_production_unit_id=COALESCE((
      SELECT item->>'minimumUnitId'
      FROM households h CROSS JOIN LATERAL jsonb_array_elements(h.production_types) AS production_types(item)
      WHERE h.id=r.household_id AND item->>'id'=r.production_type AND COALESCE(NULLIF(item->>'minimumAmount','')::numeric,0)>0
        AND (SELECT count(*) FROM recipes members WHERE members.household_id=r.household_id AND members.production_type=r.production_type AND members.parent_recipe_id IS NULL)=1
    ),'portion')
WHERE r.parent_recipe_id IS NULL;
