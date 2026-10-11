import { createServer } from 'node:http';
import { createHmac, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { createFood, fillMissingNutrientsFromCiqual, getFood, updateFood, validateFoodInput } from './foods.mjs';
import { createRecipe, listRecipes, readRecipe, updateRecipe, validateRecipeInput } from './recipes.mjs';
import { listImportDrafts, saveImportDrafts } from './recipe-imports.mjs';
import { parseRecipeArchive, parseRecipeText } from '../domain/recipe-import.mjs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web');
const staticFiles = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
]);

export function createApp(pool, { appPassword } = {}) {
  return createServer((request, response) => handleRequest(request, response, pool, appPassword));
}

const loginAttempts = new Map();
const SESSION_SECONDS = 604800;

export async function handleRequest(request, response, pool, appPassword = null) {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const staticFile = staticFiles.get(url.pathname);
    if (request.method === 'GET' && staticFile) {
      try {
        const contents = await readFile(path.join(webRoot, staticFile[0]));
        response.setHeader('Content-Type', staticFile[1]);
        response.setHeader('Cache-Control', 'no-cache');
        response.writeHead(200);
        return response.end(contents);
      } catch {
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        return send(response, 500, { error: 'page-unavailable' });
      }
    }
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'same-origin');

    if (request.method === 'GET' && url.pathname === '/api/health') {
      try {
        await pool.query('SELECT 1');
        return send(response, 200, { status: 'ok' });
      } catch {
        return send(response, 503, { status: 'database-unavailable' });
      }
    }

    if (request.method === 'GET' && url.pathname === '/api/session') {
      return send(response, 200, { authenticated: Boolean(appPassword && hasSession(request, appPassword)) });
    }
    if (request.method === 'POST' && url.pathname === '/api/login') {
      if (!appPassword) return send(response, 503, { error: 'authentication-not-configured' });
      const ip = request.socket?.remoteAddress ?? 'unknown';
      const attempts = loginAttempts.get(ip) ?? { count: 0, startedAt: Date.now() };
      if (Date.now() - attempts.startedAt > 15 * 60 * 1000) { attempts.count = 0; attempts.startedAt = Date.now(); }
      if (attempts.count >= 8) {
        response.setHeader('Retry-After', '900');
        return send(response, 429, { error: 'too-many-login-attempts' });
      }
      const body = await readJson(request);
      if (body.error) return send(response, body.status ?? 400, { error: body.error });
      const supplied = typeof body.value?.password === 'string' ? body.value.password : '';
      const expected = scryptSync(appPassword, 'lapinou-dish-login-v1', 32);
      const candidate = scryptSync(supplied, 'lapinou-dish-login-v1', 32);
      if (!timingSafeEqual(expected, candidate)) {
        attempts.count += 1;
        loginAttempts.set(ip, attempts);
        return send(response, 401, { error: 'invalid-password' });
      }
      loginAttempts.delete(ip);
      const issuedAt = Math.floor(Date.now() / 1000).toString();
      const token = signSession(issuedAt, appPassword);
      const secure = request.headers?.['x-forwarded-proto'] === 'https' ? '; Secure' : '';
      response.setHeader('Set-Cookie', `lapinou_session=${issuedAt}.${token}; Path=/; Max-Age=${SESSION_SECONDS}; HttpOnly; SameSite=Strict${secure}`);
      return send(response, 200, { authenticated: true });
    }
    if (request.method === 'POST' && url.pathname === '/api/logout') {
      response.setHeader('Set-Cookie', 'lapinou_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict');
      return send(response, 200, { authenticated: false });
    }

    if (url.pathname.startsWith('/api/') && appPassword && !hasSession(request, appPassword)) {
      return send(response, 401, { error: 'authentication-required' });
    }

    if (request.method === 'GET' && url.pathname === '/api/households') {
      try {
        const result = await pool.query('SELECT id, name FROM households ORDER BY created_at');
        return send(response, 200, { households: result.rows });
      } catch {
        return send(response, 500, { error: 'household-list-failed' });
      }
    }
    if (request.method === 'POST' && url.pathname === '/api/households') {
      const body = await readJson(request);
      if (body.error) return send(response, body.status ?? 400, { error: body.error });
      const name = body.value?.name;
      if (typeof name !== 'string' || !name.trim() || name.trim().length > 120) return send(response, 400, { error: 'invalid-household-name' });
      try {
        const result = await pool.query('INSERT INTO households (id, name) VALUES ($1, $2) RETURNING id, name', [randomUUID(), name.trim()]);
        return send(response, 201, { household: result.rows[0] });
      } catch {
        return send(response, 500, { error: 'household-create-failed' });
      }
    }

    if (request.method === 'POST' && url.pathname === '/api/recipes') {
      const body = await readJson(request);
      if (body.error) return send(response, body.status ?? 400, { error: body.error });
      const validation = validateRecipeInput(body.value);
      if (validation.error) return send(response, 400, { error: validation.error });
      try {
        const recipe = await createRecipe(pool, validation.data);
        if (recipe.error) return send(response, 400, { error: recipe.error });
        return send(response, 201, { recipe });
      } catch {
        return send(response, 500, { error: 'recipe-create-failed' });
      }
    }
    if (request.method === 'GET' && url.pathname === '/api/recipes') {
      const householdId = url.searchParams.get('householdId');
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(householdId ?? '')) return send(response, 400, { error: 'invalid-household-id' });
      try {
        return send(response, 200, { recipes: await listRecipes(pool, householdId) });
      } catch {
        return send(response, 500, { error: 'recipe-list-failed' });
      }
    }
    if (request.method === 'GET' && url.pathname === '/api/recipe-imports') {
      const householdId = url.searchParams.get('householdId');
      if (!isUuid(householdId)) return send(response, 400, { error: 'invalid-household-id' });
      try { return send(response, 200, { drafts: await listImportDrafts(pool, householdId) }); }
      catch { return send(response, 500, { error: 'recipe-import-list-failed' }); }
    }
    if (request.method === 'POST' && url.pathname === '/api/recipe-imports/text') {
      const body = await readJson(request);
      if (body.error) return send(response, body.status ?? 400, { error: body.error });
      const householdId = body.value?.householdId;
      if (!isUuid(householdId)) return send(response, 400, { error: 'invalid-household-id' });
      const sourceUrl = body.value?.sourceUrl || null;
      if (sourceUrl && !isSupportedRecipeUrl(sourceUrl)) return send(response, 400, { error: 'unsupported-source-url' });
      const parsed = parseRecipeText(body.value?.text, sourceUrl);
      if (parsed.error) return send(response, 400, { error: parsed.error });
      try {
        const drafts = await saveImportDrafts(pool, householdId, [parsed.data]);
        if (drafts.error) return send(response, 400, { error: drafts.error });
        return send(response, 201, { drafts });
      } catch { return send(response, 500, { error: 'recipe-import-save-failed' }); }
    }
    if (request.method === 'POST' && url.pathname === '/api/recipe-imports/archive') {
      const body = await readJson(request);
      if (body.error) return send(response, body.status ?? 400, { error: body.error });
      const householdId = body.value?.householdId;
      if (!isUuid(householdId)) return send(response, 400, { error: 'invalid-household-id' });
      const encoded = body.value?.archiveBase64;
      if (typeof encoded !== 'string' || encoded.length > 9_000_000 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) return send(response, 400, { error: 'invalid-archive' });
      try {
        const archive = parseRecipeArchive(Buffer.from(encoded, 'base64'));
        const drafts = await saveImportDrafts(pool, householdId, archive.recipes);
        if (drafts.error) return send(response, 400, { error: drafts.error });
        return send(response, 201, { imported: drafts.filter((draft) => !draft.duplicate).length, duplicates: drafts.filter((draft) => draft.duplicate).length, skipped: archive.skipped, drafts });
      } catch (error) {
        return send(response, 400, { error: ['unsupported-norish-archive', 'invalid-zip', 'invalid-zip-directory', 'invalid-zip-entry', 'unsupported-or-corrupt-zip-entry', 'no-recipes-found', 'too-many-recipes', 'archive-entry-too-large', 'archive-expands-too-large', 'too-many-archive-entries'].includes(error.message) ? error.message : 'invalid-recipe-archive' });
      }
    }
    const importDraftAction = url.pathname.match(/^\/api\/recipe-imports\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/(converted|discarded)$/i);
    if (importDraftAction && request.method === 'POST') {
      const body = await readJson(request);
      if (body.error) return send(response, body.status ?? 400, { error: body.error });
      if (!isUuid(body.value?.householdId)) return send(response, 400, { error: 'invalid-household-id' });
      try {
        const state = importDraftAction[2];
        const result = await pool.query(`UPDATE recipe_import_drafts SET state = $3 WHERE id = $1 AND household_id = $2 AND state = 'draft' RETURNING id`, [importDraftAction[1], body.value.householdId, state]);
        return result.rowCount ? send(response, 200, { state }) : send(response, 404, { error: 'recipe-import-draft-not-found' });
      } catch { return send(response, 500, { error: 'recipe-import-update-failed' }); }
    }
    const recipeId = url.pathname.match(/^\/api\/recipes\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i)?.[1];
    if (recipeId && request.method === 'PUT') {
      const body = await readJson(request);
      if (body.error) return send(response, body.status ?? 400, { error: body.error });
      const validation = validateRecipeInput(body.value);
      if (validation.error) return send(response, 400, { error: validation.error });
      try {
        const recipe = await updateRecipe(pool, recipeId, validation.data);
        if (!recipe) return send(response, 404, { error: 'recipe-not-found' });
        if (recipe.error) return send(response, 400, { error: recipe.error });
        return send(response, 200, { recipe });
      } catch {
        return send(response, 500, { error: 'recipe-update-failed' });
      }
    }
    if (recipeId && request.method === 'GET') {
      try {
        const recipe = await readRecipe(pool, recipeId);
        return recipe ? send(response, 200, { recipe }) : send(response, 404, { error: 'recipe-not-found' });
      } catch {
        return send(response, 500, { error: 'recipe-read-failed' });
      }
    }

    if (url.pathname === '/api/foods' && request.method === 'POST') {
      const body = await readJson(request);
      if (body.error) return send(response, body.status ?? 400, { error: body.error });
      const validation = validateFoodInput(body.value, { creating: true });
      if (validation.error) return send(response, 400, { error: validation.error });
      try {
        const food = await createFood(pool, validation.data);
        if (food.error) return send(response, 409, { error: food.error, matches: food.matches ?? [] });
        return send(response, 201, { food });
      } catch {
        return send(response, 500, { error: 'food-create-failed' });
      }
    }

    const foodId = url.pathname.match(/^\/api\/foods\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i)?.[1];
    const completionMatch = url.pathname.match(/^\/api\/foods\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/complete-nutrition$/i);
    if (completionMatch && request.method === 'POST') {
      const body = await readJson(request);
      if (body.error) return send(response, body.status ?? 400, { error: body.error });
      if (!isUuid(body.value.sourceFoodId)) return send(response, 400, { error: 'invalid-source-food-id' });
      try {
        const result = await fillMissingNutrientsFromCiqual(pool, completionMatch[1], body.value.sourceFoodId);
        if (!result) return send(response, 404, { error: 'food-not-found' });
        if (result.error) return send(response, 400, { error: result.error });
        return send(response, 200, result);
      } catch {
        return send(response, 500, { error: 'food-nutrition-completion-failed' });
      }
    }
    if (foodId && request.method === 'GET') {
      try {
        const food = await getFood(pool, foodId);
        return food ? send(response, 200, { food }) : send(response, 404, { error: 'food-not-found' });
      } catch {
        return send(response, 500, { error: 'food-read-failed' });
      }
    }
    if (foodId && request.method === 'PATCH') {
      const body = await readJson(request);
      if (body.error) return send(response, body.status ?? 400, { error: body.error });
      const validation = validateFoodInput(body.value);
      if (validation.error) return send(response, 400, { error: validation.error });
      try {
        const food = await updateFood(pool, foodId, validation.data);
        if (!food) return send(response, 404, { error: 'food-not-found' });
        if (food.error) return send(response, 409, { error: food.error, matches: food.matches ?? [] });
        return send(response, 200, { food });
      } catch {
        return send(response, 500, { error: 'food-update-failed' });
      }
    }

    if (request.method === 'GET' && url.pathname === '/api/foods') {
      const query = (url.searchParams.get('q') ?? '').trim();
      const unit = url.searchParams.get('unit') ?? '';
      const onlyIncomplete = url.searchParams.get('incomplete') === 'true';
      const sourceFilter = url.searchParams.get('source') === 'ciqual' ? 'ciqual' : '';
      if (query.length === 1) return send(response, 200, { foods: [], total: 0, limit: 50, offset: 0 });
      const normalizedQuery = normalizeSearch(query);
      const ignoredSearchTokens = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'un', 'une', 'et', 'au', 'aux']);
      const searchTokens = [...new Set(normalizedQuery.split(' ').filter((token) => token.length > 1 && !ignoredSearchTokens.has(token))
        .map((token) => token.length > 4 && token.endsWith('s') ? token.slice(0, -1) : token))];
      const limit = integerInRange(url.searchParams.get('limit'), 50, 1, 100);
      const offset = integerInRange(url.searchParams.get('offset'), 0, 0, 100000);
      try {
        const result = await pool.query(
          `SELECT f.id, f.canonical_name AS name, f.brand, f.source,
                  f.source_reference, f.source_note,
                  jsonb_object_agg(n.id, fn.value_per_100g ORDER BY n.sort_order)
                    FILTER (WHERE n.id IS NOT NULL) AS nutrients_per_100g
             FROM foods f
             LEFT JOIN food_nutrients fn ON fn.food_id = f.id
             LEFT JOIN nutrients n ON n.id = fn.nutrient_id
            WHERE ($8 = '' OR f.source = $8)
              AND ($7::boolean = false OR EXISTS (
                    SELECT 1 FROM nutrients required
                     WHERE required.is_required_for_recipe
                       AND NOT EXISTS (SELECT 1 FROM food_nutrients missing
                                        WHERE missing.food_id = f.id
                                          AND missing.nutrient_id = required.id
                                          AND missing.value_per_100g IS NOT NULL)
                  ))
              AND ($1 = '' OR lower(f.canonical_name) LIKE '%' || lower($1) || '%'
               OR EXISTS (
                    SELECT 1 FROM food_aliases a
                     WHERE a.food_id = f.id
                       AND a.normalized_alias LIKE '%' || $2 || '%'
                  )
               OR (cardinality($6::text[]) > 0 AND (
                    SELECT count(*) FROM unnest($6::text[]) AS search_token
                     WHERE lower(f.canonical_name) LIKE '%' || search_token || '%'
                        OR EXISTS (SELECT 1 FROM food_aliases a
                                    WHERE a.food_id = f.id
                                      AND a.normalized_alias LIKE '%' || search_token || '%')
                  ) >= GREATEST(1, ceil(cardinality($6::text[]) * 0.6)::integer)))
            GROUP BY f.id
            ORDER BY CASE WHEN
                       ($5 IN ('ml', 'l', 'tsp', 'tbsp', 'cup') AND f.grams_per_millilitre IS NOT NULL)
                       OR ($5 = 'piece' AND EXISTS (SELECT 1 FROM food_unit_conversions c WHERE c.food_id = f.id AND c.unit_id = 'piece'))
                       OR ($5 NOT IN ('ml', 'l', 'tsp', 'tbsp', 'cup', 'piece'))
                     THEN 0 ELSE 1 END,
                     CASE WHEN $1 <> '' AND lower(f.canonical_name) = lower($1) THEN 0
                          WHEN EXISTS (SELECT 1 FROM food_aliases a WHERE a.food_id = f.id AND a.normalized_alias = $2) THEN 0
                          WHEN EXISTS (SELECT 1 FROM food_aliases a WHERE a.food_id = f.id AND a.normalized_alias LIKE $2 || '%') THEN 1
                          ELSE 2 END,
                     (SELECT count(*) FROM unnest($6::text[]) AS search_token
                       WHERE lower(f.canonical_name) LIKE '%' || search_token || '%'
                          OR EXISTS (SELECT 1 FROM food_aliases a
                                      WHERE a.food_id = f.id
                                        AND a.normalized_alias LIKE '%' || search_token || '%')) DESC,
                     f.canonical_name
            LIMIT $3 OFFSET $4`,
          [query, normalizedQuery, limit, offset, unit, searchTokens, onlyIncomplete, sourceFilter],
        );
        const count = await pool.query(
          `SELECT count(*)::integer AS total FROM foods f
            WHERE ($5 = '' OR f.source = $5)
              AND ($4::boolean = false OR EXISTS (
                    SELECT 1 FROM nutrients required
                     WHERE required.is_required_for_recipe
                       AND NOT EXISTS (SELECT 1 FROM food_nutrients missing
                                        WHERE missing.food_id = f.id
                                          AND missing.nutrient_id = required.id
                                          AND missing.value_per_100g IS NOT NULL)
                  ))
              AND ($1 = '' OR lower(f.canonical_name) LIKE '%' || lower($1) || '%'
               OR EXISTS (SELECT 1 FROM food_aliases a WHERE a.food_id = f.id AND a.normalized_alias LIKE '%' || $2 || '%')
               OR (cardinality($3::text[]) > 0 AND (
                    SELECT count(*) FROM unnest($3::text[]) AS search_token
                     WHERE lower(f.canonical_name) LIKE '%' || search_token || '%'
                        OR EXISTS (SELECT 1 FROM food_aliases a
                                    WHERE a.food_id = f.id
                                      AND a.normalized_alias LIKE '%' || search_token || '%')
                  ) >= GREATEST(1, ceil(cardinality($3::text[]) * 0.6)::integer)))`,
          [query, normalizedQuery, searchTokens, onlyIncomplete, sourceFilter],
        );
        return send(response, 200, { foods: result.rows, total: count.rows[0].total, limit, offset });
      } catch {
        return send(response, 500, { error: 'food-search-failed' });
      }
    }

    return send(response, 404, { error: 'not-found' });
}

function send(response, status, body) {
  response.writeHead(status);
  response.end(JSON.stringify(body));
}

function signSession(issuedAt, password) {
  return createHmac('sha256', password).update(issuedAt).digest('base64url');
}

function hasSession(request, password) {
  const cookieHeader = request.headers?.cookie ?? '';
  const cookie = cookieHeader.split(';').map((item) => item.trim()).find((item) => item.startsWith('lapinou_session='));
  const value = cookie?.slice('lapinou_session='.length) ?? '';
  const [issuedAt, signature, extra] = value.split('.');
  if (!issuedAt || !signature || extra || !/^\d+$/.test(issuedAt)) return false;
  const timestamp = Number(issuedAt);
  const now = Math.floor(Date.now() / 1000);
  if (timestamp > now + 60 || now - timestamp > SESSION_SECONDS) return false;
  const expected = Buffer.from(signSession(issuedAt, password));
  const provided = Buffer.from(signature);
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

function normalizeSearch(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/[^a-z0-9]+/g, ' ').trim();
}

function integerInRange(value, fallback, min, max) {
  const parsed = value === null ? fallback : Number(value);
  return Number.isInteger(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

async function readJson(request) {
  let raw = '';
  try {
    for await (const chunk of request) {
      raw += chunk;
      if (raw.length > 9_500_000) return { error: 'body-too-large', status: 413 };
    }
    return { value: JSON.parse(raw || '{}') };
  } catch {
    return { error: 'invalid-json' };
  }
}

function isUuid(value) { return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value); }
function isSupportedRecipeUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && ['instagram.com', 'www.instagram.com', 'youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com'].includes(url.hostname.toLowerCase()); }
  catch { return false; }
}
