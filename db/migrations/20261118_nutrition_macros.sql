ALTER TABLE person_nutrition_goals
 ADD COLUMN daily_fat_g numeric(8,3) CHECK(daily_fat_g BETWEEN 0 AND 1000),
 ADD COLUMN daily_carbohydrate_g numeric(8,3) CHECK(daily_carbohydrate_g BETWEEN 0 AND 2000),
 ADD COLUMN daily_fibre_g numeric(8,3) CHECK(daily_fibre_g BETWEEN 0 AND 150),
 ADD COLUMN questionnaire jsonb;
