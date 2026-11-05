import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { handleRequest } from '../src/server/app.mjs';

async function request(pool, path, { password, cookie } = {}) {
  const response = {
    status: 200, headers: {}, body: '',
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    getHeader(name) { return this.headers[name.toLowerCase()]; },
    writeHead(status) { this.status = status; },
    end(body = '') { this.body += body; },
  };
  await handleRequest({ method: 'GET', url: path, headers: cookie ? { cookie } : {}, socket: {} }, response, pool, password);
  return response;
}

test('catalogue CSV exports every food with only the selected household purchase settings', async () => {
  const db = new PGlite();
  try {
    const dir = new URL('../db/migrations/', import.meta.url);
    for (const file of (await readdir(dir)).filter(file => file.endsWith('.sql')).sort()) {
      await db.exec(await readFile(new URL(file, dir), 'utf8'));
    }
    const pool = { query: (sql, args = []) => db.query(sql, args) };
    const home = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const rice = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const shrimp = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    for (const id of [home, other]) await pool.query('INSERT INTO households(id,name) VALUES($1,$2)', [id, id]);
    await pool.query("INSERT INTO foods(id,canonical_name,source,cooking_factor) VALUES($1,$2,'manual',$3)", [rice, 'Riz; basmati', 2.5]);
    await pool.query("INSERT INTO foods(id,canonical_name,source) VALUES($1,$2,'manual')", [shrimp, '=Crevettes']);
    await pool.query("INSERT INTO food_nutrients(food_id,nutrient_id,value_per_100g) VALUES($1,'protein_g',7.5)", [rice]);
    await pool.query("INSERT INTO food_unit_conversions(food_id,unit_id,grams_per_unit,source_note) VALUES($1,'tsp',3,'mesure')", [rice]);
    await pool.query('INSERT INTO household_food_purchase_units(household_id,food_id,singular_label,plural_label,covered_quantity,covered_unit_id) VALUES($1,$2,$3,$4,500,$5)', [home, rice, 'sachet', 'sachets', 'g']);
    await pool.query('INSERT INTO household_food_purchase_units(household_id,food_id,singular_label,plural_label,covered_quantity,covered_unit_id) VALUES($1,$2,$3,$4,1000,$5)', [other, rice, 'sac', 'sacs', 'g']);
    const path = `/api/foods/export?householdId=${home}`;
    assert.equal((await request(pool, path, { password: 'test-password' })).status, 401);
    assert.equal((await request(pool, '/api/foods/export')).status, 400);
    assert.equal((await request(pool, `/api/foods/export?householdId=${'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'}`)).status, 404);
    const response = await request(pool, path);
    assert.equal(response.status, 200);
    assert.match(response.getHeader('content-type'), /^text\/csv/);
    assert.match(response.getHeader('content-disposition'), /attachment/);
    const csv = response.body;
    assert.ok(csv.startsWith('\uFEFFid;'));
    assert.equal(csv.split('\r\n').length, (await pool.query('SELECT count(*)::integer AS total FROM foods')).rows[0].total + 2);
    assert.match(csv, /"Riz; basmati"/);
    assert.match(csv, /'=Crevettes/);
    assert.match(csv, /;2\.500000;[^\r\n]*;3\.00000;[^\r\n]*;sachet;sachets;500\.00000;g;/);
    assert.doesNotMatch(csv, /;sac;sacs;1000;g;/);
  } finally {
    await db.close();
  }
});
