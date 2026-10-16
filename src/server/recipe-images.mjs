const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export function validateRecipeImageUpload(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'invalid-recipe-image' };
  if (!isUuid(input.householdId)) return { error: 'invalid-household-id' };
  if (!MIME_TYPES.has(input.mediaType) || typeof input.imageBase64 !== 'string' || input.imageBase64.length > Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(input.imageBase64)) return { error: 'invalid-recipe-image' };
  const image = Buffer.from(input.imageBase64, 'base64');
  if (!image.length || image.length > MAX_IMAGE_BYTES || !matchesImageType(image, input.mediaType)) return { error: 'invalid-recipe-image' };
  return { data: { householdId: input.householdId, mediaType: input.mediaType, image, source: 'personal' } };
}

export async function saveRecipeImage(pool, recipeId, data) {
  const owned = await pool.query('SELECT id FROM recipes WHERE id=$1 AND household_id=$2 AND parent_recipe_id IS NULL', [recipeId, data.householdId]);
  if (!owned.rowCount) return null;
  await pool.query(`INSERT INTO recipe_images (recipe_id, media_type, source, image_bytes)
    VALUES ($1,$2,$3,$4) ON CONFLICT (recipe_id) DO UPDATE
    SET media_type=EXCLUDED.media_type, source=EXCLUDED.source, image_bytes=EXCLUDED.image_bytes, updated_at=now()`,
  [recipeId, data.mediaType, data.source, data.image]);
  return { imageAvailable: true, source: data.source };
}

export async function readRecipeImage(pool, recipeId, householdId) {
  const result = await pool.query(`SELECT i.media_type, i.image_bytes FROM recipe_images i
    JOIN recipes r ON r.id=i.recipe_id WHERE i.recipe_id=$1 AND r.household_id=$2 AND r.parent_recipe_id IS NULL`, [recipeId, householdId]);
  return result.rows[0] ? { mediaType: result.rows[0].media_type, image: result.rows[0].image_bytes } : null;
}

export async function removeRecipeImage(pool, recipeId, householdId) {
  const result = await pool.query(`DELETE FROM recipe_images i USING recipes r
    WHERE i.recipe_id=$1 AND r.id=i.recipe_id AND r.household_id=$2 AND r.parent_recipe_id IS NULL RETURNING i.recipe_id`, [recipeId, householdId]);
  if (result.rowCount) return true;
  const owned = await pool.query('SELECT id FROM recipes WHERE id=$1 AND household_id=$2 AND parent_recipe_id IS NULL', [recipeId, householdId]);
  return owned.rowCount ? false : null;
}

export async function generateRecipeImage(prompt, { apiKey = process.env.OPENAI_API_KEY, model = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2.5-sunburst', fetchImpl = fetch } = {}) {
  if (!apiKey) return { error: 'openai-not-configured' };
  try {
    const response = await fetchImpl('https://api.openai.com/v1/images/generations', {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt }), signal: AbortSignal.timeout(90_000),
    });
    if (response.status === 401 || response.status === 403) return { error: 'openai-access-denied' };
    if (response.status === 429) return { error: 'openai-rate-limited' };
    if (!response.ok) return { error: 'openai-image-generation-failed' };
    const result = await response.json();
    const encoded = result?.data?.[0]?.b64_json;
    if (typeof encoded !== 'string' || encoded.length > Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) return { error: 'openai-image-generation-failed' };
    const image = Buffer.from(encoded, 'base64');
    if (!image.length || image.length > MAX_IMAGE_BYTES) return { error: 'recipe-image-too-large' };
    const mediaType = detectImageType(image);
    if (!mediaType) return { error: 'openai-image-generation-failed' };
    return { data: { mediaType, image, source: 'openai' } };
  } catch (error) {
    return { error: error?.name === 'TimeoutError' || error?.name === 'AbortError' ? 'openai-timeout' : 'openai-image-generation-failed' };
  }
}

function detectImageType(image) {
  if (image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff) return 'image/jpeg';
  if (image.subarray(0, 4).toString() === 'RIFF' && image.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  return null;
}

function matchesImageType(image, mediaType) { return detectImageType(image) === mediaType; }
function isUuid(value) { return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value); }
