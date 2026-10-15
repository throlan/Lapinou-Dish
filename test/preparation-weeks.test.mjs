import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { preparationWeeks } from '../web/preparation-weeks.js';
import { listPreparationsToMake } from '../src/server/household-planning.mjs';
import { savePlannedMeal } from '../src/server/planning.mjs';

test('batch cooking weeks follow Mondays and keep the chosen shopping period', () => {
  assert.deepEqual(preparationWeeks('2026-10-15', '2026-11-02'), [
    { monday:'2026-10-12', start:'2026-10-15', end:'2026-10-18' },
    { monday:'2026-10-19', start:'2026-10-19', end:'2026-10-25' },
    { monday:'2026-10-26', start:'2026-10-26', end:'2026-11-01' },
    { monday:'2026-11-02', start:'2026-11-02', end:'2026-11-02' },
  ]);
  assert.deepEqual(preparationWeeks('2026-10-19', '2026-10-25'), [
    { monday:'2026-10-19', start:'2026-10-19', end:'2026-10-25' },
  ]);
});

test('the same batch recipe has separate weekly quantities and stock is reserved in date order', async () => {
  const db = new PGlite();
  try {
    const dir = new URL('../db/migrations/', import.meta.url);
    for (const file of (await readdir(dir)).filter(file => file.endsWith('.sql')).sort()) {
      await db.exec(await readFile(new URL(file, dir), 'utf8'));
    }
    const pool = { async query(sql,args=[]) { const result=await db.query(sql,args); return {...result,rowCount:result.rows.length||result.affectedRows||0}; }, async connect() { return {...this,release(){}}; } };
    const householdId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const personId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const recipeId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    await pool.query("INSERT INTO households(id,name) VALUES($1,'Test')",[householdId]);
    await pool.query("INSERT INTO people(id,household_id,display_name) VALUES($1,$2,'Test')",[personId,householdId]);
    await pool.query("INSERT INTO recipes(id,household_id,name,yield_amount,yield_unit_id,production_type) VALUES($1,$2,'Plat batch',5,'portion','batch_cooking')",[recipeId,householdId]);
    for (const [mealDate,quantity] of [['2026-10-19',2],['2026-10-26',3]]) {
      await savePlannedMeal(pool,null,{householdId,mealDate,slot:'lunch',notes:'',attendeeIds:[personId],items:[{recipeId,role:'main',amounts:[{personId,quantity}]}]});
    }
    const first=await listPreparationsToMake(pool,householdId,'2026-10-19','2026-10-25');
    const second=await listPreparationsToMake(pool,householdId,'2026-10-26','2026-11-01');
    assert.equal(first[0].plannedQuantity,2);
    assert.equal(second[0].plannedQuantity,3);
    assert.equal((await listPreparationsToMake(pool,householdId,'2026-10-19','2026-11-01'))[0].plannedQuantity,5);
    await pool.query("INSERT INTO stock_lots(id,household_id,recipe_id,produced_on,quantity) VALUES(gen_random_uuid(),$1,$2,'2026-10-19',2)",[householdId,recipeId]);
    assert.equal((await listPreparationsToMake(pool,householdId,'2026-10-19','2026-10-25'))[0].toMakeQuantity,0);
    assert.equal((await listPreparationsToMake(pool,householdId,'2026-10-26','2026-11-01'))[0].toMakeQuantity,3);
  } finally { await db.close(); }
});
