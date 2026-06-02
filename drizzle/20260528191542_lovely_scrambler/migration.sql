ALTER TABLE "raw_trade_rows" ADD COLUMN "payload_retention_mode" text DEFAULT 'full_postgres' NOT NULL;--> statement-breakpoint
ALTER TABLE "raw_trade_rows" ADD COLUMN "payload_storage_kind" text DEFAULT 'postgres' NOT NULL;--> statement-breakpoint
ALTER TABLE "raw_trade_rows" ADD COLUMN "payload_storage_bucket" text;--> statement-breakpoint
ALTER TABLE "raw_trade_rows" ADD COLUMN "payload_storage_key" text;--> statement-breakpoint
ALTER TABLE "raw_trade_rows" ADD COLUMN "payload_hash_sha256" text;--> statement-breakpoint
ALTER TABLE "raw_trade_rows" ADD COLUMN "payload_retained_reason" text;--> statement-breakpoint
ALTER TABLE "raw_trade_rows" ADD COLUMN "payload_pruned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "raw_trade_rows" ADD COLUMN "payload_reconstructable" boolean DEFAULT true NOT NULL;--> statement-breakpoint
UPDATE "raw_trade_rows"
SET
  "payload_hash_sha256" = "row_hash_sha256",
  "payload_retained_reason" = 'existing_full_postgres_payload',
  "updated_at" = now()
WHERE "payload_hash_sha256" IS NULL;--> statement-breakpoint
CREATE INDEX "raw_trade_rows_payload_retention_idx" ON "raw_trade_rows" USING btree ("payload_retention_mode");
