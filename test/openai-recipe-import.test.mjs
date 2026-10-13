import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { extractRecipeWithOpenAI, validateExtraction } from '../src/server/openai-recipe-import.mjs';
import { captionFromHtml, instagramPostUrl, retrieveInstagramCaption } from '../src/server/instagram-caption.mjs';
import { handleRequest } from '../src/server/app.mjs';
import { saveImportDrafts, listImportDrafts } from '../src/server/recipe-imports.mjs';

const text = '3 CRÈMES\n9 œufs\n300 g de skyr nature\n3 scoops de whey vanille (environ 90 g)\nVanille : extrait de vanille\nRépartir en 3 portions. Réfrigérer 4 heures.';
const extracted = () => ({
  name: 'Crèmes protéinées', description: 'Base pour 3 crèmes', yieldAmount: 3, yieldUnitId: 'portion',
  ingredients: [
    { rawText: '9 œufs', foodName: 'œufs', quantity: 9, unitId: 'piece' },
    { rawText: '300 g de skyr nature', foodName: 'skyr nature', quantity: 300, unitId: 'g' },
    { rawText: '3 scoops de whey vanille (environ 90 g)', foodName: 'whey vanille', quantity: 90, unitId: 'g' },
  ], instructions: 'Répartir en 3 portions. Réfrigérer 4 heures.', warnings: ['90 g est une approximation.'],
  variants: [{ name: 'Vanille', ingredients: [{ rawText: 'extrait de vanille', foodName: 'extrait de vanille', quantity: null, unitId: null }], instructions: null }],
});
const aiResponse = (data = extracted(), overrides = {}) => Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(data) }] }], ...overrides });
const options = { apiKey: 'synthetic-test-key', fetchImpl: async () => aiResponse() };
const post = 'https://www.instagram.com/p/DeZh7NyuSru/';

test('AI extraction uses structured output, preserves base/variants and never sends household data', async () => {
  const result = await extractRecipeWithOpenAI(text, post, { ...options, fetchImpl: async (url, init) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    const body = JSON.parse(init.body);
    assert.equal(body.store, false);
    assert.equal(body.input, text);
    assert.equal(body.text.format.strict, true);
    assert.equal(body.text.format.type, 'json_schema');
    assert.equal(body.max_output_tokens, 6000);
    assert.match(body.instructions, /N'invente aucun/);
    return aiResponse();
  } });
  assert.equal(result.data.yieldAmount, 3);
  assert.equal(result.data.ingredients[2].quantity, 90);
  assert.equal(result.data.ingredients.length, 3);
  assert.equal(result.data.variants[0].ingredients[0].quantity, null);
  assert.match(result.data.instructions, /Variantes à choisir/);
  assert.equal(result.data.rawText, text);
});

test('AI rejects unsupported units, invented source quotations and invalid quantities', () => {
  for (const changes of [{ rawText: '50 g de sucre' }, { unitId: 'scoop' }, { quantity: -2 }, { quantity: '90' }]) {
    const data = extracted(); Object.assign(data.ingredients[0], changes);
    assert.equal(validateExtraction(data, text), false);
  }
  const data = extracted(); data.yieldAmount = 0;
  assert.equal(validateExtraction(data, text), false);
});

test('unknown yield and units remain null with review warnings', async () => {
  const data = extracted(); data.yieldAmount = null; data.ingredients[0].quantity = null; data.ingredients[0].unitId = null;
  const result = await extractRecipeWithOpenAI(text, null, { ...options, fetchImpl: async () => aiResponse(data) });
  assert.equal(result.data.yieldAmount, null);
  assert.equal(result.data.ingredients[0].unitId, null);
  assert.match(result.data.warnings.join(' '), /Rendement inconnu/);
});

test('missing key and excessive text never call OpenAI', async () => {
  const fetchImpl = () => { throw new Error('must not call'); };
  assert.equal((await extractRecipeWithOpenAI(text, null, { apiKey: '', fetchImpl })).error, 'openai-not-configured');
  assert.equal((await extractRecipeWithOpenAI('x'.repeat(30001), null, { ...options, fetchImpl })).error, 'invalid-recipe-text');
});

test('API errors, refusals, incomplete and malformed outputs create no recipe', async () => {
  const cases = [
    [new Response('private error', { status: 401 }), 'openai-access-denied'],
    [new Response('', { status: 429 }), 'openai-rate-limited'],
    [aiResponse(extracted(), { status: 'incomplete' }), 'openai-incomplete-output'],
    [aiResponse(extracted(), { output: [{ type: 'message', content: [{ type: 'refusal' }] }] }), 'openai-import-refused'],
    [aiResponse({ name: 'invalid' }), 'openai-invalid-recipe'],
  ];
  for (const [response, error] of cases) assert.deepEqual(await extractRecipeWithOpenAI(text, null, { ...options, fetchImpl: async () => response }), { error });
  assert.deepEqual(await extractRecipeWithOpenAI(text, null, { ...options, fetchImpl: async () => { throw new DOMException('timeout', 'TimeoutError'); } }), { error: 'openai-timeout' });
});

const html = () => `<meta content="42 likes - Author: &quot;${text.replace(/\n/g, '&#10;')}&quot;" property="og:description">`;
test('Instagram extracts a complete quoted caption and decodes metadata entities', () => {
  assert.equal(captionFromHtml(html()), text);
  assert.equal(captionFromHtml('<meta property="og:description" content="Log in to Instagram">'), null);
  assert.equal(captionFromHtml(html().replace('4 heures.', '4 heures.…')), null);
});

test('Instagram metadata accepts whitespace after its closing quote and period', () => {
  const caption = 'RECETTE DE TEST\nPour 10 barres :\n100 g de poudre d’amandes\nMélanger.';
  const metadata = '<meta property="og:description" content="42 likes, 3 comments - author on September 23, 2026: &quot;RECETTE DE TEST\nPour 10 barres :&#x2028;100 g de poudre d&#x2019;amandes\nMélanger.&quot;. " />';
  assert.equal(captionFromHtml(metadata), caption.replace(' :\n', ' :\u2028'));
  for (const ending of ['&quot;.', '&quot;. ', '&quot;.\n', '&quot;  ', '&quot; .  ']) {
    assert.equal(captionFromHtml(`<meta content="42 likes - author: &quot;${text}${ending}" property="og:description">`), text);
  }
  assert.equal(captionFromHtml(metadata.replace('Mélanger.', 'Mélanger…')), null);
});

test('URL normalization refuses private hosts, credentials, ports and unsupported pages', () => {
  assert.equal(instagramPostUrl(post + '?igsh=abc'), post);
  for (const url of ['http://www.instagram.com/p/abc/', 'https://localhost/p/abc/', 'https://www.instagram.com.evil.test/p/abc/', 'https://user:pass@www.instagram.com/p/abc/', 'https://www.instagram.com:8443/p/abc/', 'https://www.instagram.com/accounts/login/', 'https://www.instagram.com/author/']) assert.equal(instagramPostUrl(url), null);
});

test('Instagram blocks login/external redirects and oversized bodies without fetching them', async () => {
  for (const location of ['https://127.0.0.1/', '/accounts/login/', '/p/OtherPost/']) {
    let calls = 0;
    const result = await retrieveInstagramCaption(post, { fetchImpl: async () => { calls++; return new Response(null, { status: 302, headers: { location } }); } });
    assert.equal(calls, 1); assert.equal(result.error, 'instagram-caption-unavailable');
  }
  assert.equal((await retrieveInstagramCaption(post, { fetchImpl: async () => new Response('x'.repeat(2_000_001), { headers: { 'content-type': 'text/html' } }) })).error, 'instagram-caption-unavailable');
  assert.equal((await retrieveInstagramCaption(post, { fetchImpl: async () => new Response(html(), { headers: { 'content-type': 'text/html' } }) })).text, text);
});

async function invoke(body, recipeAI, pool = { query: async () => ({ rows: [{ id: body.householdId }] }) }) {
  const req = Readable.from([JSON.stringify(body)]); req.method = 'POST'; req.url = '/api/recipe-imports/ai'; req.headers = {};
  const response = { setHeader() {}, writeHead(code) { this.status = code; }, end(value) { this.body = JSON.parse(value); } };
  await handleRequest(req, response, pool, null, recipeAI);
  return response;
}
const householdId = '11111111-1111-4111-8111-111111111111';
test('link-only failure never calls OpenAI or persists a draft; unknown household costs nothing', async () => {
  let aiCalls = 0;
  const config = { apiKey: 'synthetic-test-key', fetchImpl: async () => { aiCalls++; return aiResponse(); }, instagramFetch: async () => new Response('login', { headers: { 'content-type': 'text/html' } }) };
  const result = await invoke({ householdId, sourceUrl: post }, config);
  assert.equal(result.status, 422); assert.equal(result.body.error, 'instagram-caption-unavailable'); assert.equal(aiCalls, 0);
  const unknown = await invoke({ householdId, text }, config, { query: async () => ({ rows: [] }) });
  assert.equal(unknown.status, 404); assert.equal(aiCalls, 0);
});

test('draft storage retains extracted units, original, warnings and variants; endpoint creates only a draft', async () => {
  const db = new PGlite();
  try {
    const dir = new URL('../db/migrations/', import.meta.url);
    for (const file of (await readdir(dir)).filter((s) => s.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file, dir), 'utf8'));
    await db.query('INSERT INTO households (id, name) VALUES ($1, $2)', [householdId, 'Test']);
    const pool = { query: (...args) => db.query(...args), connect: async () => ({ query: (...args) => db.query(...args), release() {} }) };
    const result = await invoke({ householdId, sourceUrl: post }, { ...options, instagramFetch: async () => new Response(html(), { headers: { 'content-type': 'text/html' } }) }, pool);
    assert.equal(result.status, 201);
    const [draft] = await listImportDrafts(pool, householdId);
    assert.equal(draft.original, text); assert.equal(draft.yieldAmount, 3);
    assert.deepEqual(draft.ingredients.map((i) => i.unitId), ['piece', 'g', 'g']);
    assert.equal(draft.variants[0].ingredients[0].quantity, null);
    assert.equal(draft.extractionMethod, 'openai');
    assert.equal((await db.query('SELECT count(*) FROM recipes')).rows[0].count, 0);
    const unknown = { ...extracted(), yieldAmount: null, sourceKind: 'clipboard', rawText: text, extractionMethod: 'openai' };
    await saveImportDrafts(pool, householdId, [unknown]);
    assert.ok((await listImportDrafts(pool, householdId)).some((d) => d.yieldAmount === null));
  } finally { await db.close(); }
});
