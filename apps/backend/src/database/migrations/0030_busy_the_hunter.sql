ALTER TABLE "users" ADD COLUMN "deletion_requested_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "deletion_scheduled_at" timestamp;