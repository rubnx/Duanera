CREATE TABLE "raw_trade_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_file_id" uuid NOT NULL,
	"import_batch_id" uuid NOT NULL,
	"source_layout_id" uuid,
	"trade_flow" text,
	"period_year" integer,
	"period_month" integer,
	"row_number" integer NOT NULL,
	"field_count" integer,
	"raw_text" text NOT NULL,
	"raw_values" jsonb NOT NULL,
	"row_hash_sha256" text NOT NULL,
	"parse_status" text DEFAULT 'pending' NOT NULL,
	"parse_errors" jsonb,
	"parse_warnings" jsonb,
	"parser_name" text,
	"parser_version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "raw_trade_rows" ADD CONSTRAINT "raw_trade_rows_source_file_id_source_files_id_fk" FOREIGN KEY ("source_file_id") REFERENCES "public"."source_files"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_trade_rows" ADD CONSTRAINT "raw_trade_rows_import_batch_id_import_batches_id_fk" FOREIGN KEY ("import_batch_id") REFERENCES "public"."import_batches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_trade_rows" ADD CONSTRAINT "raw_trade_rows_source_layout_id_source_layouts_id_fk" FOREIGN KEY ("source_layout_id") REFERENCES "public"."source_layouts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "raw_trade_rows_source_file_row_number_idx" ON "raw_trade_rows" USING btree ("source_file_id","row_number");--> statement-breakpoint
CREATE INDEX "raw_trade_rows_import_batch_idx" ON "raw_trade_rows" USING btree ("import_batch_id");--> statement-breakpoint
CREATE INDEX "raw_trade_rows_source_file_idx" ON "raw_trade_rows" USING btree ("source_file_id");--> statement-breakpoint
CREATE INDEX "raw_trade_rows_source_layout_idx" ON "raw_trade_rows" USING btree ("source_layout_id");--> statement-breakpoint
CREATE INDEX "raw_trade_rows_trade_flow_period_idx" ON "raw_trade_rows" USING btree ("trade_flow","period_year","period_month");--> statement-breakpoint
CREATE INDEX "raw_trade_rows_row_hash_idx" ON "raw_trade_rows" USING btree ("row_hash_sha256");--> statement-breakpoint
CREATE INDEX "raw_trade_rows_parse_status_idx" ON "raw_trade_rows" USING btree ("parse_status");