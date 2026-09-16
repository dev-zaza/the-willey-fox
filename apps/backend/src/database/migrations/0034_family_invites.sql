-- Family email invites (pending until accept — works for users who have not registered yet)
CREATE TABLE IF NOT EXISTS "family_invites" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "family_id" uuid NOT NULL REFERENCES "family_groups"("id") ON DELETE cascade,
  "invited_by_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "email" varchar(255) NOT NULL,
  "token" varchar(64) NOT NULL UNIQUE,
  "role" varchar(20) DEFAULT 'member' NOT NULL,
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_family_invites_token" ON "family_invites" ("token");
CREATE INDEX IF NOT EXISTS "idx_family_invites_family_id" ON "family_invites" ("family_id");
