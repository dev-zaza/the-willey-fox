# Build stage
FROM node:22-alpine AS builder
WORKDIR /app

# bcrypt and other native addons need a compiler on Alpine
RUN apk add --no-cache python3 make g++

# Install pnpm (match root package.json packageManager when possible)
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Copy workspace manifests (tsconfig.base.json required for shared/backend tsc extends)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/shared ./packages/shared
COPY apps/backend ./apps/backend

# Build shared package
RUN pnpm --filter @safetag/shared build

# Build backend
RUN pnpm --filter @safetag/backend build

# Production stage
FROM node:22-alpine AS runner
WORKDIR /app

RUN apk add --no-cache python3 make g++

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/shared/package.json ./packages/shared/

# Install production deps only
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/backend/src/database/migrations ./apps/backend/src/database/migrations

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "apps/backend/dist/main.js"]
