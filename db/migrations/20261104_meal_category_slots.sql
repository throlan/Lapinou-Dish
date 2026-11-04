-- Keep historical meals unchanged. Add optional categories only when absent.
ALTER TABLE households ALTER COLUMN meal_additions SET DEFAULT '[{"id":"accompaniment","label":"Accompagnement","recipeType":"accompaniment","role":"accompaniment","slots":["lunch","dinner"],"sharedSlots":[]},{"id":"beverage","label":"Boisson","recipeType":"beverage","role":"beverage","slots":["breakfast","lunch","snack","dinner"],"sharedSlots":[]},{"id":"sauce","label":"Sauce","recipeType":"sauce","role":"sauce","slots":["lunch","dinner"],"sharedSlots":[]},{"id":"dessert","label":"Dessert","recipeType":"dessert","role":"dessert","slots":["lunch","dinner"],"sharedSlots":[]},{"id":"pastry","label":"Pâtisserie","recipeType":"dessert","role":"dessert","slots":["breakfast","snack"],"sharedSlots":["breakfast"]},{"id":"starter","label":"Entrée","recipeType":"custom-starter","role":"accompaniment","slots":["lunch","dinner"],"sharedSlots":[]},{"id":"dairy","label":"Laitage","recipeType":"custom-dairy","role":"dessert","slots":["breakfast"],"sharedSlots":[]}]'::jsonb;

UPDATE households h SET meal_additions = (
  SELECT jsonb_agg(CASE WHEN item->>'id'='pastry' THEN item || '{"sharedSlots":["breakfast"]}'::jsonb ELSE item END ORDER BY ord)
  FROM jsonb_array_elements(h.meal_additions) WITH ORDINALITY AS entry(item,ord)
)
WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(h.meal_additions) item WHERE item->>'id'='pastry' AND NOT (item ? 'sharedSlots'));

UPDATE households h SET meal_additions = h.meal_additions || additions.extra
FROM (SELECT h2.id,
  COALESCE((SELECT jsonb_agg(item) FROM jsonb_array_elements('[{"id":"starter","label":"Entrée","recipeType":"custom-starter","role":"accompaniment","slots":["lunch","dinner"],"sharedSlots":[]},{"id":"dairy","label":"Laitage","recipeType":"custom-dairy","role":"dessert","slots":["breakfast"],"sharedSlots":[]}]'::jsonb) item
    WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(h2.meal_additions) existing WHERE existing->>'id'=item->>'id')), '[]'::jsonb) AS extra
  FROM households h2) additions
WHERE h.id=additions.id AND additions.extra <> '[]'::jsonb;
