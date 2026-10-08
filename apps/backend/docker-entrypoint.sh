#!/bin/sh
# Boot script for the backend container.
#
# Behavior:
#  1. Print resolved environment summary (no secrets).
#  2. Wait for Postgres to accept connections (up to 60s).
#  3. Run drizzle migrations; on failure, log and exit.
#  4. Start the Stripe webhook listener (unless STRIPE_WEBHOOK_LISTEN=false).
#  5. Start NestJS. The listener stays up beside it; tini -g stops both.

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

stripe_pid=""

# Forward Stripe events to this container. Local `stripe listen` is what marks
# checkouts paid in dev; production images were booting the API without it, so
# paid subscriptions stayed pending. The signing secret is stable per API key.
start_stripe_webhook_listener() {
  case "${STRIPE_WEBHOOK_LISTEN:-true}" in
    0|false|FALSE|no|NO)
      echo "[entrypoint] STRIPE_WEBHOOK_LISTEN disabled — using STRIPE_WEBHOOK_SECRET from the environment."
      return 0
      ;;
  esac

  if [ -z "${STRIPE_SECRET_KEY:-}" ]; then
    echo "[entrypoint] STRIPE_SECRET_KEY unset — Stripe webhook listener not started."
    return 0
  fi

  if ! command -v stripe >/dev/null 2>&1; then
    echo "[entrypoint] WARN: stripe CLI is missing. Paid subscriptions will sync from the Stripe API inside the app."
    return 0
  fi

  port="${PORT:-3000}"
  forward="http://127.0.0.1:${port}/api/v1/payments/webhook"
  log=/tmp/stripe-listen.log
  : > "$log"

  live_args=""
  case "$STRIPE_SECRET_KEY" in
    sk_live_*|rk_live_*) live_args="--live" ;;
  esac

  echo "[entrypoint] Starting Stripe webhook listener → ${forward}"
  # shellcheck disable=SC2086
  stripe listen \
    --api-key "$STRIPE_SECRET_KEY" \
    --color off \
    --forward-to "$forward" \
    --events checkout.session.completed,customer.subscription.updated,customer.subscription.deleted,invoice.payment_succeeded,invoice.payment_failed \
    $live_args \
    >>"$log" 2>&1 &
  stripe_pid=$!

  i=0
  secret=""
  while [ "$i" -lt 40 ]; do
    secret=$(sed -n 's/.*\(whsec_[A-Za-z0-9]*\).*/\1/p' "$log" | head -n 1)
    if [ -n "$secret" ]; then
      break
    fi
    if ! kill -0 "$stripe_pid" 2>/dev/null; then
      echo "[entrypoint] WARN: Stripe listener exited before it was ready. See $log"
      cat "$log"
      stripe_pid=""
      return 0
    fi
    i=$((i + 1))
    sleep 1
  done

  if [ -z "$secret" ]; then
    echo "[entrypoint] WARN: Stripe listener did not print a signing secret. Paid subscriptions will still sync from the Stripe API."
    cat "$log"
    return 0
  fi

  # Listener secret must win over a stale local `whsec_` copied into production.
  export STRIPE_WEBHOOK_SECRET="$secret"
  echo "[entrypoint] Stripe webhook listener ready."
}

start_stripe_webhook_listener

echo "[entrypoint] Starting NestJS..."
node apps/backend/dist/main.js &
node_pid=$!
stopping=0

shutdown() {
  if [ "$stopping" -eq 1 ]; then
    return 0
  fi
  stopping=1
  kill -TERM "$node_pid" 2>/dev/null || true
  if [ -n "$stripe_pid" ]; then
    kill -TERM "$stripe_pid" 2>/dev/null || true
  fi
  wait "$node_pid" 2>/dev/null || true
}
trap shutdown TERM INT

status=0
wait "$node_pid" || status=$?
if [ "$stopping" -eq 1 ]; then
  exit 0
fi
shutdown
exit "$status"
