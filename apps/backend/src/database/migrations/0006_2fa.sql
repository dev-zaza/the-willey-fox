-- Migration: Add 2FA columns to users table
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "two_factor_enabled" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "two_factor_secret" varchar(255);
