CREATE TABLE recipe_images (
  recipe_id uuid PRIMARY KEY REFERENCES recipes(id) ON DELETE CASCADE,
  media_type text NOT NULL CHECK (media_type IN ('image/png', 'image/jpeg', 'image/webp')),
  source text NOT NULL CHECK (source IN ('personal', 'openai')),
  image_bytes bytea NOT NULL CHECK (octet_length(image_bytes) BETWEEN 1 AND 5242880),
  updated_at timestamptz NOT NULL DEFAULT now()
);
