-- Add lost/found tracking and owner contact fields to qr_codes
ALTER TABLE qr_codes ADD COLUMN IF NOT EXISTS label VARCHAR(200);
ALTER TABLE qr_codes ADD COLUMN IF NOT EXISTS is_lost BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE qr_codes ADD COLUMN IF NOT EXISTS owner_contact_email VARCHAR(255);
ALTER TABLE qr_codes ADD COLUMN IF NOT EXISTS owner_contact_phone VARCHAR(50);
ALTER TABLE qr_codes ADD COLUMN IF NOT EXISTS reward_message VARCHAR(500);

-- Backfill label from name for existing rows
UPDATE qr_codes SET label = name WHERE label IS NULL;

CREATE INDEX IF NOT EXISTS idx_qr_codes_is_lost ON qr_codes (is_lost) WHERE is_lost = TRUE;
