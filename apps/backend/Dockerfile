# syntax=docker/dockerfile:1.7
# Backend image — built from the monorepo root.
# IMPORTANT: Dokploy build context = repo root (safetag/), Dockerfile path = apps/backend/Dockerfile.

# -------- Build stage --------
FROM node:22-alpine AS builder
WORKDIR /app

# Native addons (bcrypt) need a toolchain on Alpine.
RUN apk add --no-cache python3 make g++

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Workspace manifests first → better layer caching.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/shared/package.json ./packages/shared/

# Allow minor lockfile drift (a stale lockfile blocked CI builds before).
# Use --no-frozen-lockfile so monorepo manifest updates don't require regenerating the lockfile.
RUN pnpm install --no-frozen-lockfile

# Source
COPY packages/shared ./packages/shared
COPY apps/backend ./apps/backend

RUN pnpm --filter @safetag/shared build
RUN pnpm --filter @safetag/backend build

# -------- Runner stage --------
FROM node:22-alpine AS runner
WORKDIR /app

# Runtime deps: tini for clean PID 1, build-essentials for bcrypt rebuild on first boot if needed.
RUN apk add --no-cache python3 make g++ tini

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/shared/package.json ./packages/shared/

# Install ALL deps (including drizzle-kit + ts-node devDeps required for `drizzle-kit migrate` at start).
# Trade-off: image larger than --prod, but reliable. NestJS app doesn't import any devDeps at runtime.
RUN pnpm install --no-frozen-lockfile

# Built artifacts
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

# Migrations + drizzle config (TS — resolved via ts-node by drizzle-kit)
COPY --from=builder /app/apps/backend/src/database/migrations ./apps/backend/src/database/migrations
COPY --from=builder /app/apps/backend/drizzle.config.ts ./apps/backend/drizzle.config.ts
COPY --from=builder /app/apps/backend/tsconfig.json ./apps/backend/tsconfig.json

# Entrypoint — runs migrations, then boots the API
COPY apps/backend/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENV NODE_ENV=production
# Backend listens on $PORT (defaults to 3000 in main.ts). Dokploy sets PORT via env.
EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]
