# syntax=docker/dockerfile:1.7
# Web (Next.js 15) image — built from the monorepo root.
# IMPORTANT: Dokploy build context MUST be the repo root (safetag/), Dockerfile path apps/web/Dockerfile.
# Relies on next.config.ts `output: 'standalone'`.

# -------- Build stage --------
FROM node:22-alpine AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Workspace manifests
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install --frozen-lockfile

# Source
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

# Build-time NEXT_PUBLIC_* must be present at build (baked into the client bundle).
# Pass via Dokploy "Build Args" — they're not available at runtime if only set as env.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_STRIPE_PRICE_ID_ANNUAL
ARG NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_STRIPE_PRICE_ID_ANNUAL=$NEXT_PUBLIC_STRIPE_PRICE_ID_ANNUAL \
    NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN

RUN pnpm --filter @safetag/shared build
RUN pnpm --filter @safetag/web build

# -------- Runner stage --------
FROM node:22-alpine AS runner
WORKDIR /app

RUN apk add --no-cache tini

ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

# Non-root user
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Standalone server bundle (includes minimal node_modules)
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
# Static assets
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
# Public assets
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3001

ENTRYPOINT ["/sbin/tini", "--"]
# Next standalone entry — path mirrors the monorepo layout under .next/standalone
CMD ["node", "apps/web/server.js"]
