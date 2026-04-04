-- Migration 0009: Add flagged/dismissed status to reports, add flag_reason column

ALTER TYPE "report_status" ADD VALUE IF NOT EXISTS 'flagged';
ALTER TYPE "report_status" ADD VALUE IF NOT EXISTS 'dismissed';
ALTER TYPE "report_status" ADD VALUE IF NOT EXISTS 'active';

ALTER TABLE "reports"
  ADD COLUMN IF NOT EXISTS "flag_reason" varchar(500);
