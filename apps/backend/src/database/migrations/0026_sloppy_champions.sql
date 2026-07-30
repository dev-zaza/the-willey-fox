CREATE TABLE "crime_incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_country" text NOT NULL,
	"source_api" text NOT NULL,
	"source_record_id" text NOT NULL,
	"crime_type" text NOT NULL,
	"severity_category" text NOT NULL,
	"incident_count" integer DEFAULT 1 NOT NULL,
	"lat" real NOT NULL,
	"lng" real NOT NULL,
	"h3_index_r7" text,
	"h3_index_r9" text,
	"h3_index_r11" text,
	"incident_date" date,
	"ingested_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "crime_incidents_source_api_source_record_id_unique" UNIQUE("source_api","source_record_id")
);
--> statement-breakpoint
CREATE TABLE "h3_safety_scores" (
	"h3_index" text NOT NULL,
	"resolution" smallint NOT NULL,
	"score" numeric(6, 2),
	"band" text,
	"source_country" text NOT NULL,
	"last_calculated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "h3_safety_scores_h3_index_resolution_unique" UNIQUE("h3_index","resolution")
);
--> statement-breakpoint
CREATE TABLE "pipeline_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"records_fetched" integer DEFAULT 0 NOT NULL,
	"records_inserted" integer DEFAULT 0 NOT NULL,
	"errors" text,
	"ran_at" timestamp DEFAULT now() NOT NULL
);
