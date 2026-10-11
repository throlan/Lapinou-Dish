import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest } from '../src/server/app.mjs';

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
    if (calls++ === 0) {
      assert.deepEqual(values, ['oeuf', 'oeuf', 50, 0, 'piece']);
      assert.match(sql, /grams_per_millilitre IS NOT NULL/);
      assert.match(sql, /normalized_alias = \$2/);
      return { rows: [{ id: 'food-1', name: 'Oeuf cru' }] };
    }
    assert.match(sql, /count\(\*\)/);
      assert.deepEqual(values, ['oeuf', 'oeuf']);
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
