import pg from 'pg';
import { createApp } from './app.mjs';
import { getDatabaseConnectionString } from '../db/connection.mjs';

const connectionString = getDatabaseConnectionString();
if (!connectionString) throw new Error('Database connection settings are required');
const appPassword = process.env.APP_PASSWORD;
if (!appPassword || appPassword.length < 12) throw new Error('APP_PASSWORD must contain at least 12 characters');
const pool = new pg.Pool({ connectionString, max: 10, connectionTimeoutMillis: 5000, query_timeout: 8000 });
const app = createApp(pool, { appPassword });
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '127.0.0.1';
app.listen(port, host, () => console.log(`Lapinou Dish listening on http://${host}:${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
  app.close(async (error) => {
    await pool.end();
    process.exit(error ? 1 : 0);
  });
});
