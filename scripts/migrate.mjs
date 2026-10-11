import pg from 'pg';
import { getDatabaseConnectionString } from '../src/db/connection.mjs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const connectionString = getDatabaseConnectionString();
if (!connectionString) throw new Error('Database connection settings are required');
const pool = new pg.Pool({ connectionString, max: 1 });
const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../db/migrations');
const client = await pool.connect();
try {
  await client.query('SELECT pg_advisory_lock(hashtext($1))', ['lapinou-dish:migrations']);
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  const applied = new Set((await client.query('SELECT name FROM schema_migrations')).rows.map((row) => row.name));
  const migrations = (await readdir(directory)).filter((file) => /^\d+_[a-z0-9_]+\.sql$/.test(file)).sort();
  for (const name of migrations) {
    if (applied.has(name)) continue;
    const sql = await readFile(path.join(directory, name), 'utf8');
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
      await client.query('COMMIT');
      console.log(`Applied ${name}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
} finally {
  await client.query('SELECT pg_advisory_unlock(hashtext($1))', ['lapinou-dish:migrations']);
  client.release();
  await pool.end();
}
