export function getDatabaseConnectionString(environment = process.env) {
  if (environment.DATABASE_URL) return environment.DATABASE_URL;
  const { DB_HOST: host, DB_NAME: database, DB_USER: username, DB_PASSWORD: password } = environment;
  if (!host || !database || !username || !password) return null;
  const port = environment.DB_PORT ?? '5432';
  return `postgresql://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(database)}`;
}
