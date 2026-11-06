import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { handleRequest } from '../src/server/app.mjs';

async function request(pool, url, body, method = 'POST') {
  const response = { status: 200, headers: {}, setHeader(key, value) { this.headers[key] = value; }, writeHead(status) { this.status = status; }, end(value) { this.body = JSON.parse(value); } };
  await handleRequest({ method, url, headers: {}, async *[Symbol.asyncIterator]() { if (body) yield Buffer.from(JSON.stringify(body)); } }, response, pool);
  return response;
}

test('food categories come from exact Ciqual codes and bulk edits preview, protect and log values', async () => {
  const db = new PGlite();
  try {
    const directory = new URL('../db/migrations/', import.meta.url);
    for (const file of (await readdir(directory)).filter(name => name.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file, directory), 'utf8'));
    const pool = { async query(sql, args = []) { const result = await db.query(sql, args); return { ...result, rowCount: result.rows.length || result.affectedRows || 0 }; }, async connect() { return { ...this, release() {} }; } };
    const cheese = randomUUID(), whey = randomUUID();
    await pool.query("INSERT INTO foods(id,canonical_name,source,source_reference) VALUES($1,'Abondance','ciqual','12112')", [cheese]);
    await pool.query("INSERT INTO foods(id,canonical_name,source) VALUES($1,'Whey test','manual')", [whey]);
    await db.exec(await readFile(new URL('20261105_food_category_mapping.sql', directory), 'utf8'));
    assert.equal((await pool.query('SELECT food_category FROM foods WHERE id=$1', [cheese])).rows[0].food_category, 'Fromages');
    const rows = await request(pool, '/api/foods/bulk-edit/rows', { foodIds: [cheese, whey] });
    assert.equal(rows.status, 200);
    assert.equal(rows.body.foods.length, 2);
    const payload = { field: 'foodCategory', sourceNote: 'Classement manuel vérifié', dryRun: true, overwrite: false, changes: [{ foodId: whey, version: 1, value: 'Whey' }] };
    const preview = await request(pool, '/api/foods/bulk-edit', payload);
    assert.equal(preview.status, 200); assert.equal(preview.body.applied, 0);
    assert.equal((await pool.query('SELECT food_category FROM foods WHERE id=$1', [whey])).rows[0].food_category, null);
    const applied = await request(pool, '/api/foods/bulk-edit', { ...payload, dryRun: false });
    assert.equal(applied.status, 200); assert.equal(applied.body.applied, 1);
    assert.equal((await pool.query('SELECT food_category,version FROM foods WHERE id=$1', [whey])).rows[0].food_category, 'Whey');
    assert.equal((await pool.query('SELECT count(*)::integer AS count FROM food_change_log WHERE food_id=$1', [whey])).rows[0].count, 1);
    assert.equal((await request(pool, '/api/foods/bulk-edit', { ...payload, dryRun: false })).status, 409, 'stale version rejected');
    const protectedValue = await request(pool, '/api/foods/bulk-edit', { ...payload, changes: [{ foodId: cheese, version: 1, value: 'Autre' }] });
    assert.equal(protectedValue.status, 409); assert.equal(protectedValue.body.preview[0].conflict, 'existing-value');
    const nutrition = await request(pool, '/api/foods/bulk-edit', { ...payload, field: 'proteinG', changes: [{ foodId: whey, version: 2, value: 25 }], dryRun: false });
    assert.equal(nutrition.status, 200);
    assert.equal(Number((await pool.query("SELECT value_per_100g FROM food_nutrients WHERE food_id=$1 AND nutrient_id='protein_g'", [whey])).rows[0].value_per_100g), 25);
    const tsp = await request(pool, '/api/foods/bulk-edit', { ...payload, field: 'tspGrams', changes: [{ foodId: whey, version: 3, value: 2.5 }], dryRun: false });
    assert.equal(tsp.status, 200);
    assert.equal(Number((await pool.query("SELECT grams_per_unit FROM food_unit_conversions WHERE food_id=$1 AND unit_id='tsp'", [whey])).rows[0].grams_per_unit), 2.5);
    const atomic = await request(pool, '/api/foods/bulk-edit', { ...payload, changes: [{ foodId: whey, version: 4, value: 'Protéines en poudre' }, { foodId: cheese, version: 1, value: 'Autre' }], dryRun: false });
    assert.equal(atomic.status, 409);
    assert.equal((await pool.query('SELECT food_category FROM foods WHERE id=$1', [whey])).rows[0].food_category, 'Whey', 'a conflict prevents every write');
    const replaced = await request(pool, '/api/foods/bulk-edit', { ...payload, overwrite: true, changes: [{ foodId: whey, version: 4, value: 'Protéines en poudre' }], dryRun: false });
    assert.equal(replaced.status, 200);
    assert.equal((await pool.query('SELECT food_category FROM foods WHERE id=$1', [whey])).rows[0].food_category, 'Protéines en poudre');
    assert.equal((await request(pool, '/api/foods/bulk-edit', { ...payload, field: 'scoopGrams', changes: [{ foodId: whey, version: 5, value: -1 }] })).status, 400);
    const factor = await request(pool, '/api/foods/bulk-edit', { ...payload, field: 'cookingFactor', changes: [{ foodId: whey, version: 5, value: 2.5 }], dryRun: false });
    assert.equal(factor.status, 200);
    assert.equal(Number((await pool.query('SELECT cooking_factor FROM foods WHERE id=$1', [whey])).rows[0].cooking_factor), 2.5);
    assert.equal((await request(pool, '/api/foods?q=Whey%20test&missingField=cookingFactor', null, 'GET')).body.total, 0);
    assert.equal((await request(pool, '/api/foods?q=Abondance&missingField=cookingFactor', null, 'GET')).body.total, 1);
    assert.equal((await request(pool, '/api/foods?missingField=unknown', null, 'GET')).status, 400);
    const list = await request(pool, '/api/foods?category=Whey', null, 'GET');
    assert.equal(list.status, 200); assert.equal(list.body.total, 0);
    assert.equal((await request(pool, '/api/foods?category=Protéines%20en%20poudre', null, 'GET')).body.total, 1);
  } finally { await db.close(); }
});

test('catalogue review matches only exact Ciqual references and saves selected rows with separate provenance', async () => {
  const db = new PGlite();
  try {
    const directory = new URL('../db/migrations/', import.meta.url);
    for (const file of (await readdir(directory)).filter(name => name.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file, directory), 'utf8'));
    const pool = { async query(sql, args = []) { const result = await db.query(sql, args); return { ...result, rowCount: result.rows.length || result.affectedRows || 0 }; }, async connect() { return { ...this, release() {} }; } };
    const olive = randomUUID(), sesame = randomUUID(), peanut = randomUUID(), other = randomUUID();
    await pool.query(`INSERT INTO foods(id,canonical_name,source,source_reference,grams_per_millilitre)
      VALUES($1,'Huile olive','ciqual','17270',NULL),($2,'Huile sésame','ciqual','17400',NULL),
            ($3,'Huile arachide','ciqual','17040',0.91),($4,'Huile olive','manual','17270',NULL)`, [olive,sesame,peanut,other]);
    const review = await request(pool,'/api/foods/catalogue-review',null,'GET');
    assert.equal(review.status,200);
    assert.deepEqual(new Set(review.body.foods.map(food=>food.id)),new Set([olive,sesame,peanut]));
    assert.equal(review.body.foods.find(food=>food.id===olive).proposals[0].value,.918);
    assert.equal(Number(review.body.foods.find(food=>food.id===peanut).gramsPerMillilitre),.91);
    const payload={field:'gramsPerMillilitre',sourceNote:'',overwrite:false,dryRun:true,changes:[
      {foodId:olive,version:1,value:.918,sourceNote:'FAO, olive (TB)'},
      {foodId:sesame,version:1,value:.923,sourceNote:'FAO, sésame à 15,6 °C (CSG)'}]};
    const preview=await request(pool,'/api/foods/bulk-edit',payload);
    assert.equal(preview.status,200);assert.equal(preview.body.applied,0);
    assert.deepEqual(preview.body.preview.map(item=>item.sourceNote),payload.changes.map(item=>item.sourceNote));
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM food_change_log')).rows[0].n,0);
    const blocked=await request(pool,'/api/foods/bulk-edit',{...payload,dryRun:false,changes:[...payload.changes,{foodId:peanut,version:1,value:.914,sourceNote:'FAO'}]});
    assert.equal(blocked.status,409);
    assert.equal((await pool.query('SELECT grams_per_millilitre FROM foods WHERE id=$1',[olive])).rows[0].grams_per_millilitre,null);
    const saved=await request(pool,'/api/foods/bulk-edit',{...payload,dryRun:false});
    assert.equal(saved.body.applied,2);
    for(const change of payload.changes){
      const row=(await pool.query('SELECT grams_per_millilitre,source_note FROM foods WHERE id=$1',[change.foodId])).rows[0];
      assert.equal(Number(row.grams_per_millilitre),change.value);
      assert.equal(row.source_note,change.sourceNote);
    }
    const missingSource=await request(pool,'/api/foods/bulk-edit',{...payload,overwrite:true,dryRun:false,changes:[{foodId:olive,version:2,value:.919}]});
    assert.equal(missingSource.status,200);
    assert.equal(missingSource.body.applied,1);
    const updated=(await pool.query('SELECT grams_per_millilitre,source_note FROM foods WHERE id=$1',[olive])).rows[0];
    assert.equal(Number(updated.grams_per_millilitre),.919);
    assert.equal(updated.source_note,payload.changes[0].sourceNote);
    const measure=await request(pool,'/api/foods/bulk-edit',{...payload,field:'tspGrams',dryRun:false,changes:[{foodId:olive,version:3,value:4}]});
    assert.equal(measure.body.applied,1);
  } finally { await db.close(); }
});
