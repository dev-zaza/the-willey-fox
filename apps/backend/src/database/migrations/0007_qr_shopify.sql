-- Add medical category value
ALTER TYPE "qr_category" ADD VALUE IF NOT EXISTS 'medical';

-- Make user_id nullable (unclaimed QR codes have no owner yet)
ALTER TABLE "qr_codes" ALTER COLUMN "user_id" DROP NOT NULL;

-- Add status and shopify_order_id columns
ALTER TABLE "qr_codes"
  ADD COLUMN IF NOT EXISTS "status" varchar(20) NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS "shopify_order_id" varchar(100);

CREATE INDEX IF NOT EXISTS "idx_qr_codes_status" ON "qr_codes" ("status");
