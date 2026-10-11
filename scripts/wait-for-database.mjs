import pg from 'pg';
import { getDatabaseConnectionString } from '../src/db/connection.mjs';

const connectionString = getDatabaseConnectionString();
if (!connectionString) throw new Error('Database connection settings are required');
const pool = new pg.Pool({ connectionString, max: 1, connectionTimeoutMillis: 2500 });
let lastError;
for (let attempt = 1; attempt <= 60; attempt += 1) {
  try {
    await pool.query('SELECT 1');
    await pool.end();
    console.log('PostgreSQL is ready.');
    process.exit(0);
  } catch (error) {
    lastError = error;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}
await pool.end();
throw new Error(`PostgreSQL did not become ready: ${lastError?.message ?? 'unknown error'}`);
