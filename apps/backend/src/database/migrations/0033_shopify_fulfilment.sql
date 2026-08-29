ALTER TABLE "qr_batches" ADD COLUMN IF NOT EXISTS "product_type" varchar(50);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_qr_batches_product_type" ON "qr_batches" USING btree ("product_type");--> statement-breakpoint

-- Backfill product type from the two existing print-run batch notes
UPDATE "qr_batches" SET "product_type" = 'name-tag-emergency' WHERE "notes" = 'name-tag' AND "product_type" IS NULL;--> statement-breakpoint
UPDATE "qr_batches" SET "product_type" = 'item-mini' WHERE "notes" = 'item-min' AND "product_type" IS NULL;--> statement-breakpoint
UPDATE "qr_batches" SET "product_type" = "notes" WHERE "product_type" IS NULL AND "notes" IN (
  'name-tag-emergency',
  'name-tag-square',
  'item-sticker',
  'item-mini',
  'luggage-tag',
  'keyring',
  'wristband-medical',
  'wristband-event',
  'luggage-bar'
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "shopify_product_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shopify_product_id" varchar(64) NOT NULL,
	"product_type" varchar(50) NOT NULL,
	"label" varchar(200),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_shopify_product_mappings_product_id" ON "shopify_product_mappings" USING btree ("shopify_product_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "shopify_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shopify_order_id" varchar(64) NOT NULL,
	"order_number" varchar(64),
	"customer_email" varchar(255),
	"customer_name" varchar(200),
	"status" varchar(20) DEFAULT 'needs_stock' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_shopify_orders_shopify_order_id" ON "shopify_orders" USING btree ("shopify_order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_shopify_orders_status" ON "shopify_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_shopify_orders_created_at" ON "shopify_orders" USING btree ("created_at");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "shopify_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"shopify_line_item_id" varchar(64),
	"shopify_product_id" varchar(64) NOT NULL,
	"shopify_variant_id" varchar(64),
	"title" varchar(255),
	"variant_title" varchar(255),
	"sku" varchar(100),
	"quantity" integer NOT NULL,
	"product_type" varchar(50) NOT NULL,
	"allocated_count" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'needs_stock' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "shopify_order_items" ADD CONSTRAINT "shopify_order_items_order_id_shopify_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."shopify_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_shopify_order_items_order_id" ON "shopify_order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_shopify_order_items_product_type" ON "shopify_order_items" USING btree ("product_type");--> statement-breakpoint

ALTER TABLE "qr_codes" ADD COLUMN IF NOT EXISTS "shopify_order_item_id" uuid;--> statement-breakpoint
ALTER TABLE "qr_codes" ADD CONSTRAINT "qr_codes_shopify_order_item_id_shopify_order_items_id_fk" FOREIGN KEY ("shopify_order_item_id") REFERENCES "public"."shopify_order_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_qr_codes_shopify_order_item_id" ON "qr_codes" USING btree ("shopify_order_item_id");
