-- Migration 0014: admin_audit_logs, ban_reason, pin_flags, emergency_contact decline

-- admin_audit_logs: immutable record of all admin actions
CREATE TABLE IF NOT EXISTS "admin_audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "admin_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "action" varchar(100) NOT NULL,
  "target_type" varchar(50),
  "target_id" varchar(255),
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- ban_reason + banned_at on users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ban_reason" varchar(500);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "banned_at" timestamp;

-- pin_flags: users flagging/reporting pins
CREATE TABLE IF NOT EXISTS "pin_flags" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "pin_id" uuid NOT NULL REFERENCES "pins"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "reason" varchar(500) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  UNIQUE("pin_id", "user_id")
);

-- emergency_contacts status column is varchar — 'declined' is already valid
-- The emergencyContactStatusEnum in Drizzle already includes 'declined' (added previously)
-- No schema change needed here, just documenting for reference.
