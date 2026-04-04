import { resolve } from 'path';
import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// Root .env defines Docker DB (avoids stale apps/backend/.env or shell DATABASE_URL pointing at local Postgres).
config({ path: resolve(__dirname, '../../.env'), override: true });
config({ path: resolve(__dirname, '.env') });

export default defineConfig({
  schema: './src/database/schema/index.ts',
  out: './src/database/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url:
      process.env.DATABASE_URL ||
      'postgresql://safetag:safetag_dev@localhost:5433/safetag_dev',
  },
});
