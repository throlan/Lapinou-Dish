import test from 'node:test';
import assert from 'node:assert/strict';
import { getDatabaseConnectionString } from '../src/db/connection.mjs';

test('prefers DATABASE_URL when provided', () => {
  assert.equal(getDatabaseConnectionString({ DATABASE_URL: 'postgresql://db/app' }), 'postgresql://db/app');
});

test('builds a connection string from Unraid and Compose DB variables', () => {
  assert.equal(getDatabaseConnectionString({
    DB_HOST: 'lapinou-dish-db', DB_NAME: 'lapinou_dish', DB_USER: 'lapinou', DB_PASSWORD: 'secret', DB_PORT: '5432',
  }), 'postgresql://lapinou:secret@lapinou-dish-db:5432/lapinou_dish');
});

test('escapes credentials and database names that contain URL characters', () => {
  assert.equal(getDatabaseConnectionString({
    DB_HOST: 'db', DB_NAME: 'dish/name', DB_USER: 'lapinou@home', DB_PASSWORD: 'a:b/c',
  }), 'postgresql://lapinou%40home:a%3Ab%2Fc@db:5432/dish%2Fname');
});

test('returns null if required connection settings are missing', () => {
  assert.equal(getDatabaseConnectionString({ DB_HOST: 'db' }), null);
});
