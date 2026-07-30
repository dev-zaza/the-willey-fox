CREATE TABLE "spots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"location_name" text NOT NULL,
	"lat" real NOT NULL,
	"lng" real NOT NULL,
	"instagram_url" text,
	"image_url" text,
	"caption" text,
	"safety_score" numeric(5, 2),
	"safety_band" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
