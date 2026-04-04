-- Migration 0010: Guardian reject status + invite table

ALTER TYPE "guardian_status" ADD VALUE IF NOT EXISTS 'rejected';

CREATE TABLE IF NOT EXISTS "guardian_invites" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "qr_code_id" uuid NOT NULL REFERENCES "qr_codes"("id") ON DELETE CASCADE,
  "invited_by_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "email" varchar(255) NOT NULL,
  "token" varchar(64) NOT NULL UNIQUE,
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_guardian_invites_token" ON "guardian_invites"("token");
CREATE INDEX IF NOT EXISTS "idx_guardian_invites_qr_code_id" ON "guardian_invites"("qr_code_id");
