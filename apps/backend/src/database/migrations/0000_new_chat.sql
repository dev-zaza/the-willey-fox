CREATE TYPE "public"."guardian_status" AS ENUM('pending', 'active', 'removed');--> statement-breakpoint
CREATE TYPE "public"."qr_category" AS ENUM('child', 'pet', 'item', 'medical');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('open', 'contacted', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."subscription_tier" AS ENUM('free', 'basic', 'premium', 'enterprise');--> statement-breakpoint
CREATE TABLE "guardian_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"qr_code_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "guardian_status" DEFAULT 'pending' NOT NULL,
	"added_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_guardian_qr_user" UNIQUE("qr_code_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "qr_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category" "qr_category" NOT NULL,
	"unique_code" varchar(20) NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" varchar(1000),
	"photo_url" varchar(500),
	"visibility_config" jsonb DEFAULT '{"showName":true,"showPhoto":true,"showDescription":true,"showCustomFields":false}'::jsonb NOT NULL,
	"custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "qr_codes_unique_code_unique" UNIQUE("unique_code")
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "refresh_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"qr_code_id" uuid NOT NULL,
	"finder_user_id" uuid,
	"finder_contact" varchar(255),
	"finder_notes" varchar(2000),
	"location_lat" numeric(10, 7),
	"location_lng" numeric(10, 7),
	"location_address" varchar(500),
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"phone" varchar(20),
	"avatar_url" varchar(500),
	"is_verified" boolean DEFAULT false NOT NULL,
	"verification_token" varchar(255),
	"verification_token_expires_at" timestamp,
	"reset_token" varchar(255),
	"reset_token_expires_at" timestamp,
	"reputation" integer DEFAULT 0 NOT NULL,
	"subscription_tier" "subscription_tier" DEFAULT 'free' NOT NULL,
	"language" varchar(10) DEFAULT 'en' NOT NULL,
	"notification_preferences" jsonb DEFAULT '{"email":true,"push":true,"sms":false}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "guardian_mappings" ADD CONSTRAINT "guardian_mappings_qr_code_id_qr_codes_id_fk" FOREIGN KEY ("qr_code_id") REFERENCES "public"."qr_codes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardian_mappings" ADD CONSTRAINT "guardian_mappings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardian_mappings" ADD CONSTRAINT "guardian_mappings_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_codes" ADD CONSTRAINT "qr_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_qr_code_id_qr_codes_id_fk" FOREIGN KEY ("qr_code_id") REFERENCES "public"."qr_codes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_finder_user_id_users_id_fk" FOREIGN KEY ("finder_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_guardian_mappings_qr_code_id" ON "guardian_mappings" USING btree ("qr_code_id");--> statement-breakpoint
CREATE INDEX "idx_guardian_mappings_user_id" ON "guardian_mappings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_qr_codes_user_id" ON "qr_codes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_qr_codes_unique_code" ON "qr_codes" USING btree ("unique_code");--> statement-breakpoint
CREATE INDEX "idx_refresh_tokens_user_id" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_refresh_tokens_token_hash" ON "refresh_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_reports_qr_code_id" ON "reports" USING btree ("qr_code_id");--> statement-breakpoint
CREATE INDEX "idx_reports_finder_user_id" ON "reports" USING btree ("finder_user_id");