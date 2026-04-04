-- Migration 0016: Fix qr_category enum to match current schema definition
-- The original enum had: 'child', 'pet', 'item', 'medical'
-- Current schema defines:  'pet', 'bag', 'key', 'person', 'vehicle', 'other', 'medical', 'place'
-- PostgreSQL does not support DROP VALUE, so we rename the type and rebuild it.

-- Step 1: Rename the old enum
ALTER TYPE "qr_category" RENAME TO "qr_category_old";

-- Step 2: Create the correct enum
CREATE TYPE "qr_category" AS ENUM(
  'pet',
  'bag',
  'key',
  'person',
  'vehicle',
  'other',
  'medical',
  'place'
);

-- Step 3: Migrate existing rows — map old values to nearest new ones
--   child  → person
--   item   → other
--   pet    → pet
--   medical → medical
ALTER TABLE "qr_codes"
  ALTER COLUMN "category" TYPE "qr_category"
  USING (
    CASE category::text
      WHEN 'child'   THEN 'person'::qr_category
      WHEN 'item'    THEN 'other'::qr_category
      WHEN 'pet'     THEN 'pet'::qr_category
      WHEN 'medical' THEN 'medical'::qr_category
      WHEN 'bag'     THEN 'bag'::qr_category
      WHEN 'key'     THEN 'key'::qr_category
      WHEN 'person'  THEN 'person'::qr_category
      WHEN 'vehicle' THEN 'vehicle'::qr_category
      WHEN 'other'   THEN 'other'::qr_category
      WHEN 'place'   THEN 'place'::qr_category
      ELSE 'other'::qr_category
    END
  );

-- Step 4: Drop the old enum type
DROP TYPE "qr_category_old";

-- Step 5: Seed qr_categories config into app_settings if not already present
INSERT INTO "app_settings" ("key", "value", "updated_at")
VALUES (
  'qr_categories',
  '[
    {"value": "person",  "label": "Person",      "core": true,  "enabled": true},
    {"value": "pet",     "label": "Pet",          "core": false, "enabled": true},
    {"value": "bag",     "label": "Bag / Luggage","core": false, "enabled": true},
    {"value": "key",     "label": "Keys",         "core": false, "enabled": true},
    {"value": "vehicle", "label": "Vehicle",      "core": false, "enabled": true},
    {"value": "medical", "label": "Medical",      "core": false, "enabled": true},
    {"value": "place",   "label": "Place",        "core": false, "enabled": true},
    {"value": "other",   "label": "Other",        "core": false, "enabled": true}
  ]'::jsonb,
  now()
)
ON CONFLICT ("key") DO NOTHING;
