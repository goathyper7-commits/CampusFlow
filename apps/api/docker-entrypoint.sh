#!/bin/sh
set -e

echo "[campusflow] applying database migrations..."
(cd /app/packages/database && /app/node_modules/.bin/prisma migrate deploy)

if [ "${RUN_SEED:-false}" = "true" ]; then
  echo "[campusflow] seeding database..."
  node /app/packages/database/prisma/seed.js || echo "[campusflow] seed skipped (already applied or failed)"
fi

exec "$@"