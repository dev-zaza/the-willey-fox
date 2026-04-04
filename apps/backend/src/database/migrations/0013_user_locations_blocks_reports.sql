-- Migration 0013: user_locations, user_blocks, user_reports

-- user_locations: one row per user (upserted), stores last known position
CREATE TABLE IF NOT EXISTS "user_locations" (
  "user_id" uuid PRIMARY KEY NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "lat" decimal(10,7) NOT NULL,
  "lng" decimal(10,7) NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- user_blocks: bidirectional block check on message send
CREATE TABLE IF NOT EXISTS "user_blocks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "blocker_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "blocked_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL,
  UNIQUE("blocker_id", "blocked_id")
);

-- user_reports: abuse reports from messaging context
CREATE TABLE IF NOT EXISTS "user_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "reporter_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "reported_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "reason" varchar(500) NOT NULL,
  "context_type" varchar(50),
  "context_id" uuid,
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
