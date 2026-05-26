#!/usr/bin/env bash
# Dokploy automated deploy for SafeTag.
#
# Idempotent: patches the existing backend app (env, dockerfile, port) and
# creates the web app if missing, attaches domain, sets build args, deploys.
#
# Requires only Dokploy API access — no SSH to the VPS.
#
# Usage:
#   chmod +x scripts/dokploy-deploy.sh
#   ./scripts/dokploy-deploy.sh
#
# All values are read from this file's `vars` section (edit before running)
# or overridden via env vars.

set -euo pipefail

# ----- Config (edit if needed; env vars override) -----
: "${DOKPLOY_URL:=http://91.107.198.88:3000}"
: "${DOKPLOY_TOKEN:?Set DOKPLOY_TOKEN before running}"

: "${PROJECT_ID:=wJfxJMZPabzUYmyUN98vy}"
: "${ENVIRONMENT_ID:=RPgkEenHEjMP2IkpwJJoh}"
: "${BACKEND_APP_ID:=aJWo8UtAwEJzD7U8pLD5I}"
: "${GITHUB_PROVIDER_ID:=38NHAPlCuFeyws5uSoppr}"
: "${SERVER_ID:=}"     # empty = main server

: "${BACKEND_DOMAIN:=api.thewileyfox.com}"
: "${WEB_DOMAIN:=app.thewileyfox.com}"

# Database/Redis hostnames inside the Dokploy compose network.
# Container names from `docker.getContainers`.
: "${POSTGRES_HOST:=safetag-postgres}"
: "${POSTGRES_PORT:=5432}"
: "${POSTGRES_USER:=safetag}"
: "${POSTGRES_PASSWORD:=safetag_dev}"
: "${POSTGRES_DB:=safetag_dev}"
: "${REDIS_HOST:=safetag-redis}"
: "${REDIS_PORT:=6379}"

# Compose stack's docker network — backend/web must attach to reach DB.
: "${COMPOSE_NETWORK:=thewileyfox-backend-6afux5_default}"

: "${JWT_SECRET:=bWuE6R+4rCuWeTmzwKwAxCsEQMEtyhx2eCn/uROwi4ytdrAs6uJAbIXf6XaKuWVv}"

: "${REPO_OWNER:=dev-zaza}"
: "${REPO_NAME:=the-willey-fox}"
: "${REPO_BRANCH:=master}"

# ----- helpers -----
api() {
  # usage: api METHOD path [json-body]
  local method="$1" path="$2" body="${3:-}"
  if [[ -n "$body" ]]; then
    curl -fsSL --max-time 30 \
      -X "$method" \
      -H "x-api-key: $DOKPLOY_TOKEN" \
      -H "Content-Type: application/json" \
      -d "$body" \
      "$DOKPLOY_URL$path"
  else
    curl -fsSL --max-time 30 \
      -X "$method" \
      -H "x-api-key: $DOKPLOY_TOKEN" \
      "$DOKPLOY_URL$path"
  fi
}

log() { printf '\n\033[1;34m▶ %s\033[0m\n' "$*"; }
ok()  { printf '  \033[1;32m✓\033[0m %s\n' "$*"; }
warn(){ printf '  \033[1;33m!\033[0m %s\n' "$*"; }

# ----- 1. Build backend env block -----
backend_env=$(cat <<EOF
NODE_ENV=production
PORT=3000
PUBLIC_BASE_URL=https://${WEB_DOMAIN}

DATABASE_HOST=${POSTGRES_HOST}
DATABASE_PORT=${POSTGRES_PORT}
DATABASE_USER=${POSTGRES_USER}
DATABASE_PASSWORD=${POSTGRES_PASSWORD}
DATABASE_NAME=${POSTGRES_DB}
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}

REDIS_HOST=${REDIS_HOST}
REDIS_PORT=${REDIS_PORT}

JWT_SECRET=${JWT_SECRET}
ACCESS_TOKEN_EXPIRY_MINUTES=15
REFRESH_TOKEN_EXPIRY_DAYS=30

CORS_ORIGINS=https://${WEB_DOMAIN}

EMAIL_PROVIDER=console
SMS_PROVIDER=console
PUSH_PROVIDER=console

APP_NAME=TheWileyfox
MOBILE_APP_SCHEME=thewileyfox

GOOGLE_CALLBACK_URL=https://${BACKEND_DOMAIN}/api/v1/auth/google/callback

NOTIFICATIONS_UNSUBSCRIBE_SECRET=${JWT_SECRET}

# Optional integrations — left blank, set later via Dokploy UI:
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=
# STRIPE_SECRET_KEY=
# STRIPE_WEBHOOK_SECRET=
# STRIPE_PRICE_ID_MONTHLY=
# STRIPE_PRICE_ID_ANNUAL=
# STRIPE_TRIAL_DAYS=7
# MAPBOX_ACCESS_TOKEN=
# CLOUDINARY_CLOUD_NAME=
# CLOUDINARY_API_KEY=
# CLOUDINARY_API_SECRET=
# FBI_API_KEY=
# SHOPIFY_WEBHOOK_SECRET=
EOF
)

# ----- 2. Patch backend application -----
log "Patching backend app (dockerfile, build context, env)"

backend_payload=$(jq -n \
  --arg appId "$BACKEND_APP_ID" \
  --arg env "$backend_env" \
  --arg dockerfile "apps/backend/Dockerfile" \
  --arg ctx "." \
  '{
    json: {
      applicationId: $appId,
      dockerfile: $dockerfile,
      dockerContextPath: $ctx,
      dockerBuildStage: "",
      buildType: "dockerfile",
      buildPath: "/",
      env: $env,
      autoDeploy: true
    }
  }')

api POST "/api/trpc/application.update" "$backend_payload" | jq -r '.result.data.json // . | tostring' | head -c 200
echo
ok "Backend app patched"

# ----- 3. Check if web app exists -----
log "Checking for existing web app"

existing_apps=$(api GET "/api/project.one?projectId=$PROJECT_ID" | jq -c '
  .environments[]?.applications[]? | select(.name == "web") | {id: .applicationId, name: .name}
')

if [[ -n "$existing_apps" ]]; then
  WEB_APP_ID=$(echo "$existing_apps" | jq -r '.id')
  ok "Web app exists: $WEB_APP_ID"
else
  log "Creating web app"
  create_payload=$(jq -n \
    --arg envId "$ENVIRONMENT_ID" \
    --arg name "web" \
    --arg appName "thewileyfox-web" \
    '{
      json: {
        environmentId: $envId,
        name: $name,
        appName: $appName,
        description: "Next.js web frontend"
      }
    }')
  resp=$(api POST "/api/trpc/application.create" "$create_payload")
  WEB_APP_ID=$(echo "$resp" | jq -r '.result.data.json.applicationId')
  ok "Web app created: $WEB_APP_ID"
fi

# ----- 4. Save web GitHub provider config -----
log "Wiring web app to GitHub repo"

web_provider_payload=$(jq -n \
  --arg appId "$WEB_APP_ID" \
  --arg githubId "$GITHUB_PROVIDER_ID" \
  --arg owner "$REPO_OWNER" \
  --arg repo "$REPO_NAME" \
  --arg branch "$REPO_BRANCH" \
  '{
    json: {
      applicationId: $appId,
      githubId: $githubId,
      repository: $repo,
      owner: $owner,
      branch: $branch,
      buildPath: "/",
      sourceType: "github",
      triggerType: "push",
      watchPaths: ["/apps/web", "/packages/shared"]
    }
  }')
api POST "/api/trpc/application.saveGithubProvider" "$web_provider_payload" > /dev/null || \
  api POST "/api/trpc/application.update" "$web_provider_payload" > /dev/null
ok "Web app linked to $REPO_OWNER/$REPO_NAME@$REPO_BRANCH"

# ----- 5. Web env + build args -----
log "Setting web env + build args"

web_env=$(cat <<EOF
NODE_ENV=production
PORT=3001
EOF
)

web_build_args=$(cat <<EOF
NEXT_PUBLIC_API_URL=https://${BACKEND_DOMAIN}/api/v1
EOF
)

web_payload=$(jq -n \
  --arg appId "$WEB_APP_ID" \
  --arg dockerfile "apps/web/Dockerfile" \
  --arg env "$web_env" \
  --arg args "$web_build_args" \
  '{
    json: {
      applicationId: $appId,
      dockerfile: $dockerfile,
      dockerContextPath: ".",
      buildType: "dockerfile",
      buildPath: "/",
      env: $env,
      buildArgs: $args,
      autoDeploy: true
    }
  }')
api POST "/api/trpc/application.update" "$web_payload" > /dev/null
ok "Web env + build args set"

# ----- 6. Attach web domain -----
log "Attaching domain $WEB_DOMAIN to web app"

existing_domain=$(api GET "/api/domain.byApplicationId?applicationId=$WEB_APP_ID" 2>/dev/null \
  | jq -r --arg d "$WEB_DOMAIN" '.[]? | select(.host == $d) | .domainId' || true)

if [[ -n "${existing_domain:-}" ]]; then
  ok "Domain already attached"
else
  domain_payload=$(jq -n \
    --arg appId "$WEB_APP_ID" \
    --arg host "$WEB_DOMAIN" \
    '{
      json: {
        applicationId: $appId,
        host: $host,
        path: "/",
        port: 3001,
        https: true,
        certificateType: "letsencrypt",
        domainType: "application"
      }
    }')
  api POST "/api/trpc/domain.create" "$domain_payload" > /dev/null
  ok "Domain $WEB_DOMAIN attached (Let's Encrypt)"
fi

# ----- 7. Trigger deploys -----
log "Triggering backend deploy"
api POST "/api/trpc/application.deploy" \
  "$(jq -n --arg id "$BACKEND_APP_ID" '{json:{applicationId:$id}}')" > /dev/null
ok "Backend deploy queued"

log "Triggering web deploy"
api POST "/api/trpc/application.deploy" \
  "$(jq -n --arg id "$WEB_APP_ID" '{json:{applicationId:$id}}')" > /dev/null
ok "Web deploy queued"

cat <<EOF

────────────────────────────────────────────────────────
 Deploy queued. Watch progress in Dokploy UI:
   $DOKPLOY_URL

 Backend: https://${BACKEND_DOMAIN}
 Web:     https://${WEB_DOMAIN}

 DNS check needed for: ${WEB_DOMAIN}
   Add an A record pointing to your Dokploy server IP.

 JWT_SECRET used (save this; rotating invalidates tokens):
   $JWT_SECRET

 Postgres restart loop still blocks the backend.
 Check logs in Dokploy UI: Compose 'database-redis' → Logs → postgres.
────────────────────────────────────────────────────────
EOF
