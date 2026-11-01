import {startMealStockClock} from './meal-stock-readiness.mjs';
import pg from 'pg';
import { createApp } from './app.mjs';
import { migrateLegacyRecipeImages } from './recipe-images.mjs';
import { getDatabaseConnectionString } from '../db/connection.mjs';

const connectionString = getDatabaseConnectionString();
if (!connectionString) throw new Error('Database connection settings are required');
const appPassword = process.env.APP_PASSWORD;
if (!appPassword || appPassword.length < 12) throw new Error('APP_PASSWORD must contain at least 12 characters');
const pool = new pg.Pool({ connectionString, max: 10, connectionTimeoutMillis: 5000, query_timeout: 8000 });
try {
  const migratedImages = await migrateLegacyRecipeImages(pool);
  if (migratedImages) console.log(`Moved ${migratedImages} recipe image(s) to persistent image storage`);
} catch (error) {
  console.warn(`Could not migrate existing recipe images to file storage: ${error?.code ?? error?.message ?? 'storage-unavailable'}`);
}
const stopMealClock=startMealStockClock(pool,{onError:error=>console.warn('Automatic meal stock update failed: '+(error?.code??'retrying'))});
const app = createApp(pool, { appPassword });
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '127.0.0.1';
app.listen(port, host, () => console.log(`Lapinou Dish listening on http://${host}:${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
  app.close(async (error) => {
    await stopMealClock();
    await pool.end();
    process.exit(error ? 1 : 0);
  });
});
