import pg from 'pg';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataset = JSON.parse(await readFile(path.join(root, 'data/ciqual/ciqual-2025.json'), 'utf8'));
const expectedCount = dataset.foods.length;
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const client = await pool.connect();
try {
  await client.query('SELECT pg_advisory_lock(hashtext($1))', ['lapinou-dish:seed:ciqual']);
  const imported = await client.query('SELECT version, record_count FROM reference_data_versions WHERE dataset_id = $1', ['ciqual']);
  if (imported.rows[0]?.version === dataset.version && imported.rows[0]?.record_count === expectedCount) {
    console.log(`Ciqual ${dataset.version} already imported (${expectedCount} foods).`);
    process.exitCode = 0;
  } else {
    const sql = await readFile(path.join(root, 'db/seeds/ciqual-2025.sql'), 'utf8');
    await client.query(sql);
    await client.query(
      `INSERT INTO reference_data_versions (dataset_id, version, record_count)
       VALUES ('ciqual', $1, $2)
       ON CONFLICT (dataset_id) DO UPDATE SET version = EXCLUDED.version,
         record_count = EXCLUDED.record_count, applied_at = now()`,
      [dataset.version, expectedCount],
    );
    console.log(`Imported Ciqual ${dataset.version}: ${expectedCount} foods.`);
  }
} finally {
  await client.query('SELECT pg_advisory_unlock(hashtext($1))', ['lapinou-dish:seed:ciqual']);
  client.release();
  await pool.end();
}
