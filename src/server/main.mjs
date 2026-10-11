import pg from 'pg';
import { createApp } from './app.mjs';

const connectionString = process.env.DATABASE_URL ?? buildConnectionString();
if (!connectionString) throw new Error('DATABASE_URL is required');
const appPassword = process.env.APP_PASSWORD;
if (!appPassword || appPassword.length < 12) throw new Error('APP_PASSWORD must contain at least 12 characters');
const pool = new pg.Pool({ connectionString, max: 10 });
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

function buildConnectionString() {
  const { DB_HOST: host, DB_NAME: database, DB_USER: username, DB_PASSWORD: password } = process.env;
  if (!host || !database || !username || !password) return null;
  const port = process.env.DB_PORT ?? '5432';
  return `postgresql://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(database)}`;
}
