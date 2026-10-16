import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const EXTENSIONS = new Map([['image/png', 'png'], ['image/jpeg', 'jpg'], ['image/webp', 'webp']]);

export function validateRecipeImageUpload(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'invalid-recipe-image' };
  if (!isUuid(input.householdId)) return { error: 'invalid-household-id' };
  if (!MIME_TYPES.has(input.mediaType) || typeof input.imageBase64 !== 'string' || input.imageBase64.length > Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(input.imageBase64)) return { error: 'invalid-recipe-image' };
  const image = Buffer.from(input.imageBase64, 'base64');
  if (!image.length || image.length > MAX_IMAGE_BYTES || !matchesImageType(image, input.mediaType)) return { error: 'invalid-recipe-image' };
  return { data: { householdId: input.householdId, mediaType: input.mediaType, image, source: 'personal' } };
}

export async function saveRecipeImage(pool, recipeId, data, { imageDirectory = configuredImageDirectory() } = {}) {
  const owned = await pool.query('SELECT id FROM recipes WHERE id=$1 AND household_id=$2 AND parent_recipe_id IS NULL', [recipeId, data.householdId]);
  if (!owned.rowCount) return null;
  const existing = await pool.query('SELECT file_name FROM recipe_images WHERE recipe_id=$1', [recipeId]);
  let fileName = null;
  if (imageDirectory) fileName = await writeImageFile(imageDirectory, recipeId, data.mediaType, data.image);
  try {
    await pool.query(`INSERT INTO recipe_images (recipe_id, media_type, source, image_bytes, file_name)
      VALUES ($1,$2,$3,$4,$5) ON CONFLICT (recipe_id) DO UPDATE
      SET media_type=EXCLUDED.media_type, source=EXCLUDED.source, image_bytes=EXCLUDED.image_bytes,
          file_name=EXCLUDED.file_name, updated_at=now()`,
    [recipeId, data.mediaType, data.source, fileName ? null : data.image, fileName]);
  } catch (error) {
    if (fileName) await unlink(path.join(imageDirectory, fileName)).catch(() => {});
    throw error;
  }
  const previousFile = existing.rows[0]?.file_name;
  if (previousFile && previousFile !== fileName && imageDirectory) await unlinkStoredFile(imageDirectory, previousFile);
  return { imageAvailable: true, source: data.source };
}

export async function readRecipeImage(pool, recipeId, householdId, { imageDirectory = configuredImageDirectory() } = {}) {
  const result = await pool.query(`SELECT i.media_type, i.image_bytes, i.file_name FROM recipe_images i
    JOIN recipes r ON r.id=i.recipe_id WHERE i.recipe_id=$1 AND r.household_id=$2 AND r.parent_recipe_id IS NULL`, [recipeId, householdId]);
  const row = result.rows[0];
  if (!row) return null;
  if (row.file_name) {
    if (!imageDirectory) throw new Error('recipe-image-directory-required');
    return { mediaType: row.media_type, image: await readFile(storedFilePath(imageDirectory, row.file_name)) };
  }
  return row.image_bytes ? { mediaType: row.media_type, image: row.image_bytes } : null;
}

export async function removeRecipeImage(pool, recipeId, householdId, { imageDirectory = configuredImageDirectory() } = {}) {
  const result = await pool.query(`DELETE FROM recipe_images i USING recipes r
    WHERE i.recipe_id=$1 AND r.id=i.recipe_id AND r.household_id=$2 AND r.parent_recipe_id IS NULL RETURNING i.recipe_id, i.file_name`, [recipeId, householdId]);
  if (result.rowCount) {
    if (result.rows[0]?.file_name && imageDirectory) await unlinkStoredFile(imageDirectory, result.rows[0].file_name);
    return true;
  }
  const owned = await pool.query('SELECT id FROM recipes WHERE id=$1 AND household_id=$2 AND parent_recipe_id IS NULL', [recipeId, householdId]);
  return owned.rowCount ? false : null;
}

export async function migrateLegacyRecipeImages(pool, { imageDirectory = configuredImageDirectory() } = {}) {
  if (!imageDirectory) return 0;
  const { rows } = await pool.query(`SELECT recipe_id, media_type, image_bytes FROM recipe_images
    WHERE file_name IS NULL AND image_bytes IS NOT NULL ORDER BY recipe_id`);
  let migrated = 0;
  for (const row of rows) {
    const fileName = await writeImageFile(imageDirectory, row.recipe_id, row.media_type, row.image_bytes);
    try {
      const updated = await pool.query(`UPDATE recipe_images SET image_bytes=NULL, file_name=$2, updated_at=now()
        WHERE recipe_id=$1 AND file_name IS NULL AND image_bytes IS NOT NULL`, [row.recipe_id, fileName]);
      if (updated.rowCount) migrated++;
      else await unlinkStoredFile(imageDirectory, fileName);
    } catch (error) {
      await unlink(path.join(imageDirectory, fileName)).catch(() => {});
      throw error;
    }
  }
  return migrated;
}

export async function generateRecipeImage(prompt, { apiKey = process.env.OPENAI_API_KEY, model = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2.5-sunburst', fetchImpl = fetch } = {}) {
  if (!apiKey) return { error: 'openai-not-configured' };
  try {
    const response = await fetchImpl('https://api.openai.com/v1/images/generations', {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt }), signal: AbortSignal.timeout(90_000),
    });
    if (response.status === 401 || response.status === 403) {
      const details = await readProviderError(response);
      return { error: 'openai-access-denied', providerStatus: response.status, ...details };
    }
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

async function writeImageFile(directory, recipeId, mediaType, image) {
  const extension = EXTENSIONS.get(mediaType);
  if (!extension || !isUuid(recipeId) || !Buffer.from(image).length || Buffer.byteLength(image) > MAX_IMAGE_BYTES || !matchesImageType(Buffer.from(image), mediaType)) throw new Error('invalid-recipe-image');
  await mkdir(directory, { recursive: true });
  const fileName = `${recipeId}-${randomUUID()}.${extension}`;
  const destination = storedFilePath(directory, fileName);
  try {
    await writeFile(destination, image, { flag: 'wx', mode: 0o660 });
    return fileName;
  } catch (error) {
    await unlink(destination).catch(() => {});
    throw error;
  }
}

function storedFilePath(directory, fileName) {
  if (typeof fileName !== 'string' || !/^[0-9a-f-]{36}-[0-9a-f-]{36}\.(png|jpg|webp)$/.test(fileName)) throw new Error('invalid-recipe-image-path');
  return path.join(directory, fileName);
}

async function unlinkStoredFile(directory, fileName) {
  try { await unlink(storedFilePath(directory, fileName)); }
  catch (error) { if (error?.code !== 'ENOENT') throw error; }
}

async function readProviderError(response) {
  try {
    const body = await response.json();
    const rawCode = body?.error?.code ?? body?.error?.type;
    const providerCode = typeof rawCode === 'string' && /^[a-z0-9_-]{1,80}$/i.test(rawCode) ? rawCode : null;
    const requestId = response.headers?.get?.('x-request-id');
    return { ...(providerCode ? { providerCode } : {}), ...(typeof requestId === 'string' && /^[a-z0-9_-]{1,100}$/i.test(requestId) ? { requestId } : {}) };
  } catch { return {}; }
}

function configuredImageDirectory() {
  const directory = process.env.RECIPE_IMAGE_DIR?.trim();
  return directory ? path.resolve(directory) : null;
}

function detectImageType(image) {
  if (image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff) return 'image/jpeg';
  if (image.subarray(0, 4).toString() === 'RIFF' && image.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  return null;
}

function matchesImageType(image, mediaType) { return detectImageType(image) === mediaType; }
function isUuid(value) { return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value); }
