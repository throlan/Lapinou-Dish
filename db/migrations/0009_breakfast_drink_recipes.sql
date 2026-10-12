-- Starter breakfast drinks for each household that already has the matching Ciqual ingredients.
-- The Nesquik powder composition and serving size come from Nestle Professional's French product label.
INSERT INTO foods (id, canonical_name, brand, source, source_reference, source_note)
VALUES (
  'b13f0003-1010-4010-8010-000000000001',
  'Poudre chocolatée Nesquik',
  'Nestlé',
  'label',
  'https://www.nestleprofessional.fr/nesquik/nesquik-boite-de-1-kg',
  'Valeurs du fabricant pour 100 g de poudre : 386 kcal, 5,1 g protéines, 78,9 g glucides, 3,6 g lipides, 7,7 g fibres. Portion fabricant : 13,5 g dans 200 ml de lait demi-écrémé.'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO food_nutrients (food_id, nutrient_id, value_per_100g, source_note)
VALUES
  ('b13f0003-1010-4010-8010-000000000001', 'energy_kcal', 386, 'Nestlé Professional, valeur pour 100 g'),
  ('b13f0003-1010-4010-8010-000000000001', 'protein_g', 5.1, 'Nestlé Professional, valeur pour 100 g'),
  ('b13f0003-1010-4010-8010-000000000001', 'carbohydrate_g', 78.9, 'Nestlé Professional, valeur pour 100 g'),
  ('b13f0003-1010-4010-8010-000000000001', 'fat_g', 3.6, 'Nestlé Professional, valeur pour 100 g'),
  ('b13f0003-1010-4010-8010-000000000001', 'fibre_g', 7.7, 'Nestlé Professional, valeur pour 100 g')
ON CONFLICT (food_id, nutrient_id) DO NOTHING;

INSERT INTO food_aliases (id, food_id, alias, normalized_alias, source)
VALUES ('b13f0004-1010-4010-8010-000000000001', 'b13f0003-1010-4010-8010-000000000001', 'Nesquik', 'nesquik', 'manual')
ON CONFLICT (food_id, normalized_alias) DO NOTHING;

WITH available AS (
  SELECT h.id AS household_id, milk.id AS milk_id, cocoa.id AS cocoa_id
  FROM households h
  JOIN foods milk ON milk.source = 'ciqual' AND lower(milk.canonical_name) = lower('Lait demi-écrémé, pasteurisé')
  JOIN foods cocoa ON cocoa.id = 'b13f0003-1010-4010-8010-000000000001'
), inserted AS (
  INSERT INTO recipes (id, household_id, name, description, yield_amount, yield_unit_id, instructions, source_url)
  SELECT md5(available.household_id::text || ':breakfast-nesquik')::uuid, available.household_id,
         'Chocolat chaud Nesquik',
         'Un bol : 200 g de lait demi-écrémé et 13,5 g de poudre Nesquik. Environ 145 à 151 kcal selon les valeurs Ciqual du lait.',
         1, 'piece', 'Verser la poudre dans le lait chaud ou froid et mélanger jusqu’à dissolution.',
         'https://www.nestleprofessional.fr/nesquik/nesquik-boite-de-1-kg'
  FROM available
  WHERE NOT EXISTS (SELECT 1 FROM recipes r WHERE r.household_id = available.household_id AND lower(r.name) = lower('Chocolat chaud Nesquik'))
  RETURNING id, household_id
)
INSERT INTO recipe_lines (id, recipe_id, food_id, quantity, unit_id, sort_order)
SELECT md5(inserted.id::text || ':milk')::uuid, inserted.id, milk.id, 200, 'g', 0
FROM inserted JOIN foods milk ON milk.source = 'ciqual' AND lower(milk.canonical_name) = lower('Lait demi-écrémé, pasteurisé')
UNION ALL
SELECT md5(inserted.id::text || ':nesquik')::uuid, inserted.id, cocoa.id, 13.5, 'g', 1
FROM inserted JOIN foods cocoa ON cocoa.id = 'b13f0003-1010-4010-8010-000000000001';

WITH available AS (
  SELECT h.id AS household_id, milk.id AS milk_id, coffee.id AS coffee_id
  FROM households h
  JOIN foods milk ON milk.source = 'ciqual' AND lower(milk.canonical_name) = lower('Lait demi-écrémé, pasteurisé')
  JOIN foods coffee ON coffee.source = 'ciqual' AND coffee.source_reference = '18071'
), inserted AS (
  INSERT INTO recipes (id, household_id, name, description, yield_amount, yield_unit_id, instructions, source_url)
  SELECT md5(available.household_id::text || ':breakfast-cappuccino')::uuid, available.household_id,
         'Cappuccino maison',
         'Une tasse : environ 40 g d’expresso non sucré et 100 g de lait demi-écrémé. Le lait représente environ 45 kcal; le café ajoute quelques kcal.',
         1, 'piece', 'Préparer un expresso. Chauffer et faire mousser le lait, puis le verser sur le café.',
         'https://www.nespresso.com/lu/fr/recipes/cappuccino-2'
  FROM available
  WHERE NOT EXISTS (SELECT 1 FROM recipes r WHERE r.household_id = available.household_id AND lower(r.name) = lower('Cappuccino maison'))
  RETURNING id, household_id
)
INSERT INTO recipe_lines (id, recipe_id, food_id, quantity, unit_id, sort_order)
SELECT md5(inserted.id::text || ':milk')::uuid, inserted.id, milk.id, 100, 'g', 0
FROM inserted JOIN foods milk ON milk.source = 'ciqual' AND lower(milk.canonical_name) = lower('Lait demi-écrémé, pasteurisé')
UNION ALL
SELECT md5(inserted.id::text || ':espresso')::uuid, inserted.id, coffee.id, 40, 'g', 1
FROM inserted JOIN foods coffee ON coffee.source = 'ciqual' AND coffee.source_reference = '18071';
