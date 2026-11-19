ALTER TABLE people ADD COLUMN main_dish_cap_g integer CHECK(main_dish_cap_g BETWEEN 1 AND 5000);
COMMENT ON COLUMN people.main_dish_cap_g IS 'Personal maximum cooked grams for all main dish parts; NULL keeps legacy household settings. No automatic rewrite of planned amounts.';
