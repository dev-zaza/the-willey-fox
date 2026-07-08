CREATE TABLE "qr_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_by_admin_id" uuid,
	"count" integer NOT NULL,
	"shopify_order_id" varchar(100),
	"notes" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "emergency_contacts" ADD COLUMN "is_primary_sos" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "qr_codes" ADD COLUMN "batch_id" uuid;--> statement-breakpoint
ALTER TABLE "qr_batches" ADD CONSTRAINT "qr_batches_created_by_admin_id_users_id_fk" FOREIGN KEY ("created_by_admin_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_codes" ADD CONSTRAINT "qr_codes_batch_id_qr_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."qr_batches"("id") ON DELETE set null ON UPDATE no action;