import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest } from '../src/server/app.mjs';

test('home page loads the application module as a versioned same-origin asset', async () => {
  const response = {
    status: 200,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    writeHead(status) { this.status = status; },
    end(body) { this.body = body.toString(); },
  };
  await handleRequest({ method: 'GET', url: '/', headers: {} }, response, {});
  assert.equal(response.status, 200);
  assert.match(response.headers['Content-Type'], /^text\/html/);
  assert.match(response.body, /<script type="module" src="\/app\.js\?v=[0-9.]+"><\/script>/);
  const scriptResponse = {
    status: 200,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    writeHead(status) { this.status = status; },
    end(body) { this.body = body.toString(); },
  };
  await handleRequest({ method: 'GET', url: '/app.js?v=0.2.14', headers: {} }, scriptResponse, {});
  assert.equal(scriptResponse.status, 200);
  assert.match(scriptResponse.headers['Content-Type'], /^text\/javascript/);
  assert.ok(scriptResponse.body.startsWith("import { calculatePersonProtein, capAccompanimentQuantity, MIN_PROTEIN_G_PER_MEAL, rebalanceNaturalPortions, suggestQuantity } from './portion-planner.js';"));
  assert.ok(scriptResponse.body.includes('calendarMeals: []'));
  const plannerResponse = {
    status: 200,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    writeHead(status) { this.status = status; },
    end(body) { this.body = body.toString(); },
  };
  await handleRequest({ method: 'GET', url: '/portion-planner.js', headers: {} }, plannerResponse, {});
  assert.equal(plannerResponse.status, 200);
  assert.ok(plannerResponse.headers['Content-Type'].startsWith('text/javascript'));
  assert.match(plannerResponse.body, /export function suggestQuantity/);
});

test('health endpoint checks the database and returns service state', async () => {
  const response = await invoke('/api/health', { query: async () => ({ rows: [{ '?column?': 1 }] }) });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: 'ok' });
});

test('energy reserve overview requires a real household and date before querying',async()=>{
  let called=false;const pool={query:async()=>{called=true;return{rows:[]};}};
  const invalid=await invoke('/api/energy-reserve?householdId=bad&asOf=2026-10-13',pool);
  assert.equal(invalid.status,400);assert.equal(called,false);
  const valid=await invoke('/api/energy-reserve?householdId=11111111-1111-4111-8111-111111111111&asOf=2026-10-13',pool);
  assert.equal(valid.status,200);assert.deepEqual(valid.body.accounts,[]);assert.equal(called,true);
});

test('food search requires two characters, searches the catalogue, and caps results', async () => {
  let called = false;
  let calls = 0;
  const pool = { query: async (sql, values) => {
    called = true;
    assert.match(sql, /FROM foods f/);
    assertSqlParenthesesBalanced(sql);
    if (calls++ === 0) {
      assert.deepEqual(values, ['oeuf', 'oeuf', 50, 0, 'piece', ['oeuf'], false, '']);
      assert.match(sql, /grams_per_millilitre IS NOT NULL/);
      assert.match(sql, /normalized_alias = \$2/);
      assert.match(sql, /unnest\(\$6::text\[\]\)/);
      assert.match(sql, /::integer\)\)\)/);
      return { rows: [{ id: 'food-1', name: 'Oeuf cru' }] };
    }
    assert.match(sql, /count\(\*\)/);
    assert.match(sql, /::integer\)\)\)/);
    assert.deepEqual(values, ['oeuf', 'oeuf', ['oeuf'], false, '']);
    return { rows: [{ total: 1 }] };
  } };
  const empty = await invoke('/api/foods?q=o', pool);
  assert.deepEqual(empty.body, { foods: [], total: 0, limit: 50, offset: 0 });
  assert.equal(called, false);
  const found = await invoke('/api/foods?q=oeuf&unit=piece', pool);
  assert.equal(found.status, 200);
  assert.deepEqual(found.body, { foods: [{ id: 'food-1', name: 'Oeuf cru' }], total: 1, limit: 50, offset: 0 });
  assert.equal(called, true);
});

test('food search uses normalized ingredient words when the full imported label differs', async () => {
  const valuesSeen = [];
  let calls = 0;
  const pool = { query: async (sql, values) => {
    assertSqlParenthesesBalanced(sql);
    valuesSeen.push(values);
    if (calls++ === 0) return { rows: [{ id: 'compote', name: 'Purée de pommes, type compote sans sucres ajoutés' }] };
    return { rows: [{ total: 1 }] };
  } };
  const response = await invoke('/api/foods?q=compote%20de%20pommes%20sans%20sucres%20ajout%C3%A9s', pool);
  assert.equal(response.status, 200);
  assert.deepEqual(valuesSeen[0][5], ['compote', 'pomme', 'sans', 'sucre', 'ajoute']);
  assert.deepEqual(valuesSeen[1][2], ['compote', 'pomme', 'sans', 'sucre', 'ajoute']);
});

test('catalogue can be filtered to foods missing required nutrition values', async () => {
  let calls = 0;
  const pool = { query: async (sql, values) => {
    assertSqlParenthesesBalanced(sql);
    assert.match(sql, /required\.is_required_for_recipe/);
    assert.match(sql, /missing\.value_per_100g IS NOT NULL/);
    assert.equal(values.at(-2), true);
    return calls++ === 0 ? { rows: [] } : { rows: [{ total: 0 }] };
  } };
  const response = await invoke('/api/foods?incomplete=true', pool);
  assert.equal(response.status, 200);
  assert.equal(calls, 2);
});

test('health endpoint reports a database outage', async () => {
  const response = await invoke('/api/health', { query: async () => { throw new Error('offline'); } });
  assert.equal(response.status, 503);
  assert.deepEqual(response.body, { status: 'database-unavailable' });
});

test('food creation validates its input before attempting database writes', async () => {
  const response = await invoke('/api/foods', { query: async () => { throw new Error('must not query'); } }, {
    method: 'POST', body: { name: '', nutrientsPer100g: {} },
  });
  assert.equal(response.status, 400);
  assert.deepEqual(response.body, { error: 'invalid-name' });
});

test('Ciqual-only search adds a source filter to result and count queries', async () => {
  let calls = 0;
  const response = await invoke('/api/foods?q=oignon&source=ciqual', { query: async (sql, values) => {
    assert.match(sql, /f\.source = \$[58]/);
    assert.equal(values.at(-1), 'ciqual');
    return calls++ === 0 ? { rows: [] } : { rows: [{ total: 0 }] };
  } });
  assert.equal(response.status, 200);
  assert.equal(calls, 2);
});

test('nutrition completion validates the external source and barcode before network or database access', async () => {
  const response = await invoke('/api/foods/10101010-1010-4010-8010-101010101010/complete-nutrition',
    { query: async () => { throw new Error('must not query'); } },
    { method: 'POST', body: { source: 'ciqual', sourceReference: 'not-a-barcode' } });
  assert.equal(response.status, 400);
  assert.deepEqual(response.body, { error: 'invalid-nutrition-source' });
});

test('nutrition suggestions search Open Food Facts using the canonical food name', async () => {
  const originalFetch = globalThis.fetch;
  let query;
  globalThis.fetch = async (url) => {
    query = new URL(url).searchParams.get('search_terms');
    return { ok: true, async json() { return { products: [{
      code: '12345678', product_name: 'Oignon', nutriments: { 'energy-kcal_100g': 35, proteins_100g: 1 },
    }] }; } };
  };
  try {
    const response = await invoke('/api/foods/10101010-1010-4010-8010-101010101010/nutrition-suggestions', {
      query: async (sql) => {
        assert.match(sql, /SELECT f\.id/);
        return { rows: [{
          id: '10101010-1010-4010-8010-101010101010', name: 'Oignon jaune', source: 'ciqual',
          nutrient_values: { energy_kcal: '35', protein_g: null }, grams_per_unit: {}, aliases: [], grams_per_millilitre: null,
        }] };
      },
    });
    assert.equal(response.status, 200);
    assert.equal(query, 'Oignon jaune');
    assert.equal(response.body.source, 'Open Food Facts');
    assert.deepEqual(response.body.products[0].nutrientsPer100g, { energyKcal: 35, proteinG: 1, carbohydrateG: null, fatG: null, fibreG: null });
  } finally { globalThis.fetch = originalFetch; }
});

test('login protects household data with an HTTP-only signed session cookie', async () => {
  const password = 'lapinou-test-password-2026';
  const pool = { query: async () => ({ rows: [] }) };
  const denied = await invoke('/api/households', pool, {}, password);
  assert.equal(denied.status, 401);
  const login = await invoke('/api/login', pool, { method: 'POST', body: { password } }, password);
  assert.equal(login.status, 200);
  assert.match(login.headers['Set-Cookie'], /HttpOnly; SameSite=Strict/);
  const cookie = login.headers['Set-Cookie'].split(';')[0];
  const session = await invoke('/api/session', pool, { headers: { cookie } }, password);
  assert.deepEqual(session.body, { authenticated: true });
  const allowed = await invoke('/api/households', pool, { headers: { cookie } }, password);
  assert.equal(allowed.status, 200);
});

test('login rejects an incorrect password', async () => {
  const response = await invoke('/api/login', { query: async () => ({ rows: [] }) }, { method: 'POST', body: { password: 'incorrect' } }, 'lapinou-test-password-2026');
  assert.equal(response.status, 401);
  assert.deepEqual(response.body, { error: 'invalid-password' });
});

async function invoke(url, pool, { method = 'GET', body, headers = {} } = {}, password = null) {
  const response = {
    status: 200,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    writeHead(status) { this.status = status; },
    end(body) { this.body = JSON.parse(body); },
  };
  const request = { method, url, headers, socket: { remoteAddress: Math.random().toString() }, async *[Symbol.asyncIterator]() { if (body !== undefined) yield Buffer.from(JSON.stringify(body)); } };
  await handleRequest(request, response, pool, password);
  return response;
}

function assertSqlParenthesesBalanced(sql) {
  let depth = 0;
  let inString = false;
  for (let index = 0; index < sql.length; index += 1) {
    if (sql[index] === "'") {
      if (inString && sql[index + 1] === "'") index += 1;
      else inString = !inString;
    } else if (!inString && sql[index] === '(') depth += 1;
    else if (!inString && sql[index] === ')') depth -= 1;
    assert.ok(depth >= 0, 'SQL closes a parenthesis before opening it');
  }
  assert.equal(inString, false, 'SQL string literal is closed');
  assert.equal(depth, 0, 'SQL parentheses are balanced');
}
