# syntax=docker/dockerfile:1.7
# Backend image — built from the monorepo root.
# IMPORTANT: Dokploy build context = repo root (safetag/), Dockerfile path = apps/backend/Dockerfile.

# -------- Build stage --------
# node:22-slim is Debian-based (glibc) — required for Puppeteer/Chromium which won't run on Alpine (musl).
FROM node:22-slim AS builder
WORKDIR /app

# Native addons (bcrypt) need a toolchain. unzip needed by some npm postinstall scripts.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ unzip && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Workspace manifests first → better layer caching.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/shared/package.json ./packages/shared/

# Skip Puppeteer's Chrome download — we use system Chromium at runtime.
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN pnpm install --no-frozen-lockfile

# Source
COPY packages/shared ./packages/shared
COPY apps/backend ./apps/backend

RUN pnpm --filter @safetag/shared build
RUN pnpm --filter @safetag/backend build

# -------- Runner stage --------
# Must stay Debian-based — Puppeteer's bundled Chromium is glibc-linked and won't run on Alpine (musl → ENOEXEC).
FROM node:22-slim AS runner
WORKDIR /app

# tini: clean PID 1. Chromium + fonts: Puppeteer PDF export. build tools: bcrypt native addon.
RUN apt-get update && apt-get install -y --no-install-recommends \
    tini \
    netcat-openbsd \
    python3 make g++ \
    chromium \
    fonts-liberation \
    libatk-bridge2.0-0 libatk1.0-0 libcups2 libdbus-1-3 \
    libdrm2 libgbm1 libnspr4 libnss3 libxcomposite1 \
    libxdamage1 libxfixes3 libxkbcommon0 libxrandr2 \
    xdg-utils \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/shared/package.json ./packages/shared/

# Install ALL deps (including drizzle-kit + ts-node devDeps required for `drizzle-kit migrate` at start).
# Trade-off: image larger than --prod, but reliable. NestJS app doesn't import any devDeps at runtime.
# PUPPETEER_SKIP_DOWNLOAD: skip Chrome download — system Chromium used at runtime via PUPPETEER_EXECUTABLE_PATH.
ENV PUPPETEER_SKIP_DOWNLOAD=true
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
# Tell Puppeteer to use system Chromium installed above instead of downloading its own binary.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
# Backend listens on $PORT (defaults to 3000 in main.ts). Dokploy sets PORT via env.
EXPOSE 3000

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]
