# syntax=docker/dockerfile:1.7
# Backend image — built from the monorepo root.
# IMPORTANT: Dokploy build context MUST be the repo root (safetag/), Dockerfile path apps/backend/Dockerfile.

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

RUN pnpm install --frozen-lockfile

# Source
COPY packages/shared ./packages/shared
COPY apps/backend ./apps/backend

RUN pnpm --filter @safetag/shared build
RUN pnpm --filter @safetag/backend build

# -------- Runner stage --------
FROM node:22-alpine AS runner
WORKDIR /app

# bcrypt runtime + tini for clean PID 1 signal handling
RUN apk add --no-cache python3 make g++ tini

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/shared/package.json ./packages/shared/

# Production deps (excludes dev). drizzle-kit is a devDep, re-added next for migrations.
RUN pnpm install --frozen-lockfile --prod

# drizzle-kit + ts-node needed at runtime for `drizzle-kit migrate` (drizzle.config.ts is TypeScript).
RUN pnpm --filter @safetag/backend add -D drizzle-kit ts-node typescript

# Built artifacts
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

# Migrations + drizzle config (TS — resolved via ts-node by drizzle-kit)
COPY --from=builder /app/apps/backend/src/database/migrations ./apps/backend/src/database/migrations
COPY --from=builder /app/apps/backend/drizzle.config.ts ./apps/backend/drizzle.config.ts
COPY --from=builder /app/apps/backend/tsconfig.json ./apps/backend/tsconfig.json

# Entrypoint — runs migrations then boots the API
COPY apps/backend/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENV NODE_ENV=production
# Backend listens on $PORT (defaults to 3000 in main.ts). Dokploy sets PORT via env.
EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]
