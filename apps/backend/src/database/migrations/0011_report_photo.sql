-- Migration 0011: Add photo_url to reports + expired report status

ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "photo_url" varchar(1000);
ALTER TYPE "report_status" ADD VALUE IF NOT EXISTS 'expired';
