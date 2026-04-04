-- Migration: Add OAuth provider columns to users table
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "oauth_provider" varchar(50),
  ADD COLUMN IF NOT EXISTS "oauth_provider_id" varchar(255);

-- Allow password_hash to be nullable for OAuth-only users
ALTER TABLE "users"
  ALTER COLUMN "password_hash" DROP NOT NULL;

-- Index for fast OAuth lookup
CREATE INDEX IF NOT EXISTS "users_oauth_provider_id_idx"
  ON "users" ("oauth_provider", "oauth_provider_id");
