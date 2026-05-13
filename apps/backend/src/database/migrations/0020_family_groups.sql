-- 0020_family_groups.sql
-- Family Units: group entity for batch guardian management across QR codes

CREATE TABLE IF NOT EXISTS family_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS family_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID NOT NULL REFERENCES family_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(family_id, user_id)
);

-- Link QR codes to families (a QR can belong to one family)
ALTER TABLE qr_codes ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES family_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_family_groups_owner ON family_groups(owner_id);
CREATE INDEX IF NOT EXISTS idx_family_members_family ON family_members(family_id);
CREATE INDEX IF NOT EXISTS idx_family_members_user ON family_members(user_id);
CREATE INDEX IF NOT EXISTS idx_qr_codes_family ON qr_codes(family_id);
