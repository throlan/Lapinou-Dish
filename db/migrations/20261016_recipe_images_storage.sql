ALTER TABLE recipe_images ADD COLUMN file_name text;
ALTER TABLE recipe_images ALTER COLUMN image_bytes DROP NOT NULL;
ALTER TABLE recipe_images ADD CONSTRAINT recipe_images_storage_source_check
  CHECK ((file_name IS NULL) <> (image_bytes IS NULL));
