-- Migration 0017: QR Customization — visual_themes, print_templates, qr_codes.theme_id

-- Visual Themes table
CREATE TABLE IF NOT EXISTS "visual_themes" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"             varchar(100) NOT NULL,
  "accent_color"     varchar(7)   NOT NULL DEFAULT '#f97316',
  "background_style" varchar(10)  NOT NULL DEFAULT 'light',
  "show_logo"        boolean      NOT NULL DEFAULT true,
  "logo_url"         varchar(500),
  "tier_required"    varchar(20)  NOT NULL DEFAULT 'free',
  "is_active"        boolean      NOT NULL DEFAULT true,
  "created_at"       timestamp    NOT NULL DEFAULT now(),
  "updated_at"       timestamp    NOT NULL DEFAULT now()
);

-- Print Templates table
CREATE TABLE IF NOT EXISTS "print_templates" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"             varchar(100) NOT NULL,
  "format_type"      varchar(20)  NOT NULL,
  "tier_required"    varchar(20)  NOT NULL DEFAULT 'free',
  "background_color" varchar(7)   NOT NULL DEFAULT '#ffffff',
  "logo_placement"   varchar(20)  NOT NULL DEFAULT 'top-left',
  "logo_size"        smallint     NOT NULL DEFAULT 40,
  "qr_position"      varchar(20)  NOT NULL DEFAULT 'center',
  "qr_size"          smallint     NOT NULL DEFAULT 120,
  "text_slots"       jsonb        NOT NULL DEFAULT '{}',
  "is_active"        boolean      NOT NULL DEFAULT true,
  "created_at"       timestamp    NOT NULL DEFAULT now(),
  "updated_at"       timestamp    NOT NULL DEFAULT now()
);

-- Add theme_id FK to qr_codes
ALTER TABLE "qr_codes"
  ADD COLUMN IF NOT EXISTS "theme_id" uuid REFERENCES "visual_themes"("id") ON DELETE SET NULL;

-- Seed: default visual theme (free tier, brand orange)
INSERT INTO "visual_themes" ("name", "accent_color", "background_style", "show_logo", "logo_url", "tier_required", "is_active")
VALUES
  ('Default Orange', '#f97316', 'light', true,  NULL, 'free',    true),
  ('Midnight Dark',  '#f97316', 'dark',  true,  NULL, 'premium', true),
  ('Ocean Blue',     '#3b82f6', 'light', true,  NULL, 'basic',   true)
ON CONFLICT DO NOTHING;

-- Seed: default print templates (one per format, all free)
INSERT INTO "print_templates" ("name", "format_type", "tier_required", "background_color", "logo_placement", "logo_size", "qr_position", "qr_size", "text_slots", "is_active")
VALUES
  (
    'Standard Square',
    'square',
    'free',
    '#ffffff',
    'top-left',
    40,
    'center',
    120,
    '{"showTagName":true,"showInstructions":true,"instructionsText":"Scan to help return this item","showReward":true,"tagNamePosition":"bottom","instructionsPosition":"bottom"}',
    true
  ),
  (
    'Wristband',
    'wristband',
    'free',
    '#ffffff',
    'none',
    40,
    'center',
    80,
    '{"showTagName":true,"showInstructions":true,"instructionsText":"Scan QR to return","showReward":false,"tagNamePosition":"bottom","instructionsPosition":"bottom"}',
    true
  ),
  (
    'Rectangle Card',
    'rectangle',
    'free',
    '#ffffff',
    'top-left',
    40,
    'center',
    140,
    '{"showTagName":true,"showInstructions":true,"instructionsText":"Scan to help return this item","showReward":true,"tagNamePosition":"bottom","instructionsPosition":"bottom"}',
    true
  )
ON CONFLICT DO NOTHING;
