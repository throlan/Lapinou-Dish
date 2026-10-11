import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest } from '../src/server/app.mjs';

test('home page embeds the application module so proxies cannot break script loading separately', async () => {
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
  assert.match(response.headers['Cache-Control'], /no-transform/);
  assert.match(response.body, /<script type="module">\s*const \$ =/);
  assert.doesNotMatch(response.body, /src="\/app\.js/);
});

test('health endpoint checks the database and returns service state', async () => {
  const response = await invoke('/api/health', { query: async () => ({ rows: [{ '?column?': 1 }] }) });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: 'ok' });
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

test('nutrition completion validates the selected Ciqual UUID before database access', async () => {
  const response = await invoke('/api/foods/10101010-1010-4010-8010-101010101010/complete-nutrition',
    { query: async () => { throw new Error('must not query'); } },
    { method: 'POST', body: { sourceFoodId: 'not-a-uuid' } });
  assert.equal(response.status, 400);
  assert.deepEqual(response.body, { error: 'invalid-source-food-id' });
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
