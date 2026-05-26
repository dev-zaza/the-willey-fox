# Dokploy Deployment — SafeTag

Deploys: **backend (NestJS)**, **web (Next.js)**, **postgres (PostGIS)**, **redis**.

Source: GitHub repo (Dokploy pulls). Build context for both apps = **monorepo root** (`safetag/`).

---

## 1. Create the project

Dokploy → **Projects → Create Project** → `safetag`.

---

## 2. Databases (create first — apps depend on them)

### Postgres (PostGIS)

Dokploy → Project → **Create → Database → Postgres**.

- **Image override:** `imresamu/postgis:16-3.4` (required — backend uses PostGIS).
- **Database name:** `safetag`
- **User:** `safetag`
- **Password:** generate strong, save it
- **External port:** leave unset (internal-only)

After create, copy the **internal hostname** (e.g. `safetag-postgres-xxxx`).

### Redis

Dokploy → Project → **Create → Database → Redis** (default image `redis:7`).

- Password: generate strong, save it
- External port: unset

Copy internal hostname (e.g. `safetag-redis-xxxx`).

---

## 3. Backend service

Dokploy → Project → **Create → Application**.

- **Source:** GitHub → select repo → branch `master`
- **Build type:** Dockerfile
- **Build context (Build Path):** `/` (repo root)
- **Dockerfile path:** `apps/backend/Dockerfile`
- **Port:** `3000`
- **Domain:** `api.<yourdomain>` → enable HTTPS (Let's Encrypt)

### Environment variables

```env
NODE_ENV=production
PORT=3000
PUBLIC_BASE_URL=https://app.<yourdomain>

# DB — use Dokploy internal hostname for the Postgres service
DATABASE_URL=postgresql://safetag:<PASSWORD>@<postgres-internal-host>:5432/safetag

# Redis — internal hostname
REDIS_URL=redis://default:<PASSWORD>@<redis-internal-host>:6379

# JWT — generate: openssl rand -base64 48
JWT_SECRET=<random-48-bytes-base64>
ACCESS_TOKEN_EXPIRY_MINUTES=15
REFRESH_TOKEN_EXPIRY_DAYS=30

# CORS — must include the web app origin
CORS_ORIGINS=https://app.<yourdomain>

# OAuth callback points at the API (this service)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=https://api.<yourdomain>/api/v1/auth/google/callback

# ... add the rest from .env.example as you enable each feature
```

Deploy. First boot runs `drizzle-kit migrate` via the entrypoint, then starts NestJS.

---

## 4. Web service

Dokploy → Project → **Create → Application**.

- **Source:** GitHub → same repo → branch `master`
- **Build type:** Dockerfile
- **Build context:** `/`
- **Dockerfile path:** `apps/web/Dockerfile`
- **Port:** `3001`
- **Domain:** `app.<yourdomain>` → enable HTTPS

### Build Args (NOT env vars — Next bakes these at build time)

```
NEXT_PUBLIC_API_URL=https://api.<yourdomain>/api/v1
NEXT_PUBLIC_STRIPE_PRICE_ID_ANNUAL=price_xxx
NEXT_PUBLIC_SENTRY_DSN=...
```

Setting these as runtime env will **not** work — `NEXT_PUBLIC_*` is inlined during `next build`. Use Dokploy's "Build Args" field.

### Runtime env

```env
NODE_ENV=production
PORT=3001
```

Deploy.

---

## 5. Post-deploy checks

```bash
# Backend health
curl https://api.<yourdomain>/api/v1/health   # or whatever your health route is

# Web
curl -I https://app.<yourdomain>
```

Backend logs in Dokploy should show:
```
[entrypoint] running drizzle migrations...
[entrypoint] starting backend...
```

---

## 6. Updates

- Push to `master` → Dokploy auto-deploys (if webhook enabled).
- Migrations run automatically on every container start.

## Gotchas

- **Build context must be repo root.** Both Dockerfiles `COPY package.json pnpm-workspace.yaml ...` from the root.
- **PostGIS image** is required, not stock postgres — backend uses geo columns.
- **Sentry build** in web: if `SENTRY_AUTH_TOKEN` isn't set as a build arg, source maps just won't upload (build still succeeds).
- **bcrypt** native build: kept python3/make/g++ in the runner image so the prebuilt binary falls back to source if needed.
