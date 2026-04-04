-- Enable PostGIS extension (requires postgis/postgis Docker image)
CREATE EXTENSION IF NOT EXISTS postgis;--> statement-breakpoint

-- Add FCM token to users
ALTER TABLE "users" ADD COLUMN "fcm_token" varchar(500);--> statement-breakpoint

-- New enums
CREATE TYPE "public"."pin_type" AS ENUM('hazard', 'roadblock', 'construction', 'safety_alert', 'traffic', 'event', 'other');--> statement-breakpoint
CREATE TYPE "public"."pin_status" AS ENUM('active', 'expired', 'deactivated');--> statement-breakpoint
CREATE TYPE "public"."safety_source" AS ENUM('uk_police', 'eurostat', 'fbi', 'numbeo', 'city_portal', 'community');--> statement-breakpoint
CREATE TYPE "public"."safety_granularity" AS ENUM('street', 'neighbourhood', 'city', 'country');--> statement-breakpoint
CREATE TYPE "public"."ingestion_status" AS ENUM('success', 'failed', 'partial');--> statement-breakpoint
CREATE TYPE "public"."place_type" AS ENUM('hotel', 'restaurant', 'cafe', 'bar', 'attraction', 'park', 'transport_hub', 'shopping', 'other');--> statement-breakpoint
CREATE TYPE "public"."emergency_contact_status" AS ENUM('pending', 'accepted', 'declined');--> statement-breakpoint
CREATE TYPE "public"."conversation_status" AS ENUM('active', 'blocked', 'archived');--> statement-breakpoint

-- Pins
CREATE TABLE "pins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "pin_type" NOT NULL,
	"status" "pin_status" DEFAULT 'active' NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"lat" numeric(10, 7) NOT NULL,
	"lng" numeric(10, 7) NOT NULL,
	"upvotes" integer DEFAULT 0 NOT NULL,
	"downvotes" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp,
	"event_end_time" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Pin votes
CREATE TABLE "pin_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pin_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"is_upvote" boolean NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_pin_vote_user" UNIQUE("pin_id", "user_id")
);--> statement-breakpoint

-- Conversations
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "conversation_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Conversation participants
CREATE TABLE "conversation_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"is_blocker_id" uuid,
	"last_read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_conversation_participant" UNIQUE("conversation_id", "user_id")
);--> statement-breakpoint

-- Messages
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"body" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Emergency contacts
CREATE TABLE "emergency_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"contact_user_id" uuid NOT NULL,
	"status" "emergency_contact_status" DEFAULT 'pending' NOT NULL,
	"accepted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_emergency_contact" UNIQUE("user_id", "contact_user_id")
);--> statement-breakpoint

-- SOS alerts
CREATE TABLE "sos_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"lat" numeric(10, 7),
	"lng" numeric(10, 7),
	"location_address" varchar(500),
	"message" varchar(500),
	"is_acknowledged" boolean DEFAULT false NOT NULL,
	"acknowledged_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Subscriptions
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tier" "subscription_tier" NOT NULL,
	"stripe_customer_id" varchar(255),
	"stripe_subscription_id" varchar(255),
	"stripe_price_id" varchar(255),
	"status" varchar(50) NOT NULL,
	"trial_ends_at" timestamp,
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"canceled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);--> statement-breakpoint

-- Transactions
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"subscription_id" uuid,
	"stripe_payment_intent_id" varchar(255),
	"stripe_invoice_id" varchar(255),
	"amount_cents" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'usd' NOT NULL,
	"status" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_stripe_payment_intent_id_unique" UNIQUE("stripe_payment_intent_id")
);--> statement-breakpoint

-- Safety zones
CREATE TABLE "safety_zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" "safety_source" NOT NULL,
	"source_region" varchar(20) NOT NULL,
	"source_granularity" "safety_granularity" NOT NULL,
	"center_lat" numeric(10, 7),
	"center_lng" numeric(10, 7),
	"radius_metres" integer,
	"bbox_min_lat" numeric(10, 7),
	"bbox_min_lng" numeric(10, 7),
	"bbox_max_lat" numeric(10, 7),
	"bbox_max_lng" numeric(10, 7),
	"safety_score" numeric(5, 2) NOT NULL,
	"crime_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Data ingestion logs
CREATE TABLE "data_ingestion_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" varchar(30) NOT NULL,
	"status" "ingestion_status" NOT NULL,
	"zones_created" integer DEFAULT 0 NOT NULL,
	"zones_updated" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"started_at" timestamp NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Route ratings
CREATE TABLE "route_ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"mapbox_route_id" varchar(255),
	"origin_lat" numeric(10, 7) NOT NULL,
	"origin_lng" numeric(10, 7) NOT NULL,
	"destination_lat" numeric(10, 7) NOT NULL,
	"destination_lng" numeric(10, 7) NOT NULL,
	"overall_rating" smallint NOT NULL,
	"tags" varchar(50)[] DEFAULT '{}' NOT NULL,
	"comment" varchar(200),
	"travel_time_minutes" integer,
	"departed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Route rating notifications
CREATE TABLE "route_rating_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"route_snapshot" jsonb NOT NULL,
	"notify_at" timestamp NOT NULL,
	"sent_at" timestamp,
	"rating_submitted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Places (post-MVP, schema created now for future use)
CREATE TABLE "places" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mapbox_poi_id" varchar(255),
	"name" varchar(200) NOT NULL,
	"category" "place_type" NOT NULL,
	"address" varchar(500),
	"lat" numeric(10, 7) NOT NULL,
	"lng" numeric(10, 7) NOT NULL,
	"overall_rating" numeric(3, 2),
	"review_count" integer DEFAULT 0 NOT NULL,
	"is_user_created" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Place reviews (post-MVP)
CREATE TABLE "place_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"overall_rating" smallint NOT NULL,
	"safety_rating" smallint,
	"cleanliness_rating" smallint,
	"value_rating" smallint,
	"service_rating" smallint,
	"comment" varchar(500),
	"flag_count" integer DEFAULT 0 NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_place_review_user" UNIQUE("place_id", "user_id")
);--> statement-breakpoint

-- Review flags (post-MVP)
CREATE TABLE "review_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"reason" varchar(100) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_review_flag_user" UNIQUE("review_id", "user_id")
);--> statement-breakpoint

-- Foreign keys
ALTER TABLE "pins" ADD CONSTRAINT "pins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pin_votes" ADD CONSTRAINT "pin_votes_pin_id_pins_id_fk" FOREIGN KEY ("pin_id") REFERENCES "public"."pins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pin_votes" ADD CONSTRAINT "pin_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conv_participants_conv_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conv_participants_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conv_participants_blocker_id_fk" FOREIGN KEY ("is_blocker_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emergency_contacts" ADD CONSTRAINT "emergency_contacts_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emergency_contacts" ADD CONSTRAINT "emergency_contacts_contact_user_id_fk" FOREIGN KEY ("contact_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sos_alerts" ADD CONSTRAINT "sos_alerts_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_ratings" ADD CONSTRAINT "route_ratings_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_rating_notifications" ADD CONSTRAINT "route_rating_notifs_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_reviews" ADD CONSTRAINT "place_reviews_place_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_reviews" ADD CONSTRAINT "place_reviews_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_flags" ADD CONSTRAINT "review_flags_review_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."place_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_flags" ADD CONSTRAINT "review_flags_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- Indexes
CREATE INDEX "idx_pins_user_id" ON "pins" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_pins_location" ON "pins" USING btree ("lat", "lng");--> statement-breakpoint
CREATE INDEX "idx_pins_status" ON "pins" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_pins_expires_at" ON "pins" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_pin_votes_pin_id" ON "pin_votes" USING btree ("pin_id");--> statement-breakpoint
CREATE INDEX "idx_messages_conversation_id" ON "messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "idx_messages_sender_id" ON "messages" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "idx_conv_participants_conv_id" ON "conversation_participants" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "idx_conv_participants_user_id" ON "conversation_participants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_emergency_contacts_user_id" ON "emergency_contacts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sos_alerts_user_id" ON "sos_alerts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_subscriptions_user_id" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_transactions_user_id" ON "transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_safety_zones_bbox" ON "safety_zones" USING btree ("bbox_min_lat", "bbox_min_lng", "bbox_max_lat", "bbox_max_lng");--> statement-breakpoint
CREATE INDEX "idx_safety_zones_center" ON "safety_zones" USING btree ("center_lat", "center_lng");--> statement-breakpoint
CREATE INDEX "idx_safety_zones_source" ON "safety_zones" USING btree ("source", "source_region");--> statement-breakpoint
CREATE INDEX "idx_route_ratings_location" ON "route_ratings" USING btree ("origin_lat", "origin_lng", "destination_lat", "destination_lng");--> statement-breakpoint
CREATE INDEX "idx_route_rating_notifs_notify_at" ON "route_rating_notifications" USING btree ("notify_at");--> statement-breakpoint
CREATE INDEX "idx_places_location" ON "places" USING btree ("lat", "lng");--> statement-breakpoint
CREATE INDEX "idx_places_category" ON "places" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_place_reviews_place_id" ON "place_reviews" USING btree ("place_id");--> statement-breakpoint
CREATE INDEX "idx_data_ingestion_logs_source" ON "data_ingestion_logs" USING btree ("source");
