import { createServer } from 'node:http';
import { createHmac, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { createFood, getFood, updateFood, validateFoodInput } from './foods.mjs';
import { createRecipe, readRecipe, validateRecipeInput } from './recipes.mjs';
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
    const recipeId = url.pathname.match(/^\/api\/recipes\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i)?.[1];
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
      if (query.length === 1) return send(response, 200, { foods: [], total: 0, limit: 50, offset: 0 });
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
            WHERE ($1 = '' OR lower(f.canonical_name) LIKE '%' || lower($1) || '%'
               OR EXISTS (
                    SELECT 1 FROM food_aliases a
                     WHERE a.food_id = f.id
                       AND a.normalized_alias LIKE '%' || $2 || '%'
                  ))
            GROUP BY f.id
            ORDER BY CASE WHEN $1 <> '' AND lower(f.canonical_name) = lower($1) THEN 0 ELSE 1 END,
                     f.canonical_name
            LIMIT $3 OFFSET $4`,
          [query, normalizeSearch(query), limit, offset],
        );
        const count = await pool.query(
          `SELECT count(*)::integer AS total FROM foods f
            WHERE ($1 = '' OR lower(f.canonical_name) LIKE '%' || lower($1) || '%'
               OR EXISTS (SELECT 1 FROM food_aliases a WHERE a.food_id = f.id AND a.normalized_alias LIKE '%' || $2 || '%'))`,
          [query, normalizeSearch(query)],
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
      if (raw.length > 32_768) return { error: 'body-too-large', status: 413 };
    }
    return { value: JSON.parse(raw || '{}') };
  } catch {
    return { error: 'invalid-json' };
  }
}
