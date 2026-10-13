ALTER TABLE recipes DROP CONSTRAINT IF EXISTS recipes_serving_part_check;
ALTER TABLE recipes ADD CONSTRAINT recipes_serving_part_check CHECK (serving_part IN ('main','starch','vegetables'));
ALTER TABLE recipe_lines DROP CONSTRAINT IF EXISTS recipe_lines_serving_part_check;
ALTER TABLE recipe_lines ADD CONSTRAINT recipe_lines_serving_part_check CHECK (serving_part IN ('main','starch','vegetables'));
