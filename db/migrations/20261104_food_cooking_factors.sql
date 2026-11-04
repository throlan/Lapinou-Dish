ALTER TABLE foods ADD COLUMN IF NOT EXISTS cooking_factor numeric(12,6)
  CHECK (cooking_factor > 0 AND cooking_factor <= 10);

-- Existing recipes keep their cooked menu quantities. Seed only foods whose
-- effective factor is identical in every gram-based parent recipe.
WITH observed AS (
  SELECT l.food_id,
    COALESCE(l.cooking_factor,(r.cooking_factors ->> COALESCE(l.serving_part,'main'))::numeric,1) AS factor
  FROM recipe_lines l JOIN recipes r ON r.id=l.recipe_id
  WHERE r.parent_recipe_id IS NULL AND r.separate_starch AND l.food_id IS NOT NULL
), unanimous AS (
  SELECT food_id, min(factor) AS factor FROM observed
  GROUP BY food_id HAVING count(DISTINCT factor)=1
)
UPDATE foods f SET cooking_factor=u.factor FROM unanimous u
WHERE f.id=u.food_id AND f.cooking_factor IS NULL;
