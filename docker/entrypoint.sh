#!/bin/sh
set -eu
node scripts/wait-for-database.mjs
node scripts/migrate.mjs
node scripts/seed-database.mjs
exec node src/server/main.mjs
