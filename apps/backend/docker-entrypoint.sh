#!/bin/sh
# Run DB migrations before booting the API. Fail fast if migrations fail.
set -e

echo "[entrypoint] running drizzle migrations..."
pnpm --filter @safetag/backend exec drizzle-kit migrate

echo "[entrypoint] starting backend..."
exec node apps/backend/dist/main.js
