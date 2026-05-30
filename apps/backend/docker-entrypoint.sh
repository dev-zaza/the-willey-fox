#!/bin/sh
# Boot script for the backend container.
#
# Behavior:
#  1. Print resolved environment summary (no secrets).
#  2. Wait for Postgres to accept connections (up to 60s).
#  3. Run drizzle migrations; on failure, log and exit.
#  4. Exec the NestJS process under tini.

set -e

echo "[entrypoint] === Boot ==="
echo "[entrypoint] NODE_ENV=$NODE_ENV PORT=$PORT"
echo "[entrypoint] DATABASE_HOST=$DATABASE_HOST DATABASE_PORT=$DATABASE_PORT DATABASE_USER=$DATABASE_USER DATABASE_NAME=$DATABASE_NAME"
echo "[entrypoint] REDIS_HOST=$REDIS_HOST REDIS_PORT=$REDIS_PORT"

# Wait for Postgres TCP socket (drizzle-kit will hang/fail if DB not ready).
echo "[entrypoint] Waiting for Postgres at $DATABASE_HOST:$DATABASE_PORT ..."
i=0
while [ $i -lt 60 ]; do
  if nc -z "$DATABASE_HOST" "$DATABASE_PORT" 2>/dev/null; then
    echo "[entrypoint] Postgres reachable."
    break
  fi
  i=$((i + 1))
  sleep 1
done
if [ $i -eq 60 ]; then
  echo "[entrypoint] ERROR: Postgres unreachable after 60s. Check network + DATABASE_HOST."
  exit 1
fi

echo "[entrypoint] Running drizzle migrations..."
if ! pnpm --filter @safetag/backend exec drizzle-kit migrate; then
  echo "[entrypoint] ERROR: drizzle-kit migrate failed (exit $?)."
  exit 1
fi
echo "[entrypoint] Migrations done."

echo "[entrypoint] Starting NestJS..."
exec node apps/backend/dist/main.js
