CREATE TABLE "source_trade_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trade_flow" text NOT NULL,
	"participant_role" text NOT NULL,
	"source_correlative_id" text NOT NULL,
	"first_seen_year" integer,
	"first_seen_month" integer,
	"last_seen_year" integer,
	"last_seen_month" integer,
	"record_count" integer DEFAULT 0 NOT NULL,
	"cross_year_stability_status" text DEFAULT 'unknown' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_file_id" uuid NOT NULL,
	"import_batch_id" uuid NOT NULL,
	"raw_trade_row_id" uuid NOT NULL,
	"importer_participant_id" uuid,
	"exporter_primary_participant_id" uuid,
	"exporter_secondary_participant_id" uuid,
	"trade_flow" text NOT NULL,
	"period_year" integer NOT NULL,
	"period_month" integer NOT NULL,
	"declaration_id_raw" text,
	"item_number" integer,
	"acceptance_date_raw" text,
	"acceptance_date" date,
	"importer_correlative_id" text,
	"exporter_primary_correlative_id" text,
	"exporter_secondary_correlative_id" text,
	"hs_code_raw" text,
	"hs_code_normalized" text,
	"product_description_raw" text,
	"product_attributes" jsonb,
	"product_search_text" text,
	"quantity" numeric(18, 6),
	"quantity_unit_code" text,
	"gross_weight_total" numeric(18, 6),
	"gross_weight_item" numeric(18, 6),
	"item_cif_value" numeric(18, 2),
	"item_fob_value" numeric(18, 2),
	"declaration_fob_value" numeric(18, 2),
	"freight_value" numeric(18, 2),
	"insurance_value" numeric(18, 2),
	"cif_value" numeric(18, 2),
	"unit_price_value" numeric(18, 6),
	"currency_code_raw" text,
	"origin_country_code" text,
	"acquisition_country_code" text,
	"consignment_country_code" text,
	"destination_country_code" text,
	"destination_country_label_raw" text,
	"customs_office_code" text,
	"embark_port_code" text,
	"embark_port_label_raw" text,
	"disembark_port_code" text,
	"disembark_port_label_raw" text,
	"transport_mode_code" text,
	"cargo_type_code" text,
	"parser_name" text NOT NULL,
	"parser_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trade_records" ADD CONSTRAINT "trade_records_source_file_id_source_files_id_fk" FOREIGN KEY ("source_file_id") REFERENCES "public"."source_files"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_records" ADD CONSTRAINT "trade_records_import_batch_id_import_batches_id_fk" FOREIGN KEY ("import_batch_id") REFERENCES "public"."import_batches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_records" ADD CONSTRAINT "trade_records_raw_trade_row_id_raw_trade_rows_id_fk" FOREIGN KEY ("raw_trade_row_id") REFERENCES "public"."raw_trade_rows"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_records" ADD CONSTRAINT "trade_records_importer_participant_id_source_trade_participants_id_fk" FOREIGN KEY ("importer_participant_id") REFERENCES "public"."source_trade_participants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_records" ADD CONSTRAINT "trade_records_exporter_primary_participant_id_source_trade_participants_id_fk" FOREIGN KEY ("exporter_primary_participant_id") REFERENCES "public"."source_trade_participants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_records" ADD CONSTRAINT "trade_records_exporter_secondary_participant_id_source_trade_participants_id_fk" FOREIGN KEY ("exporter_secondary_participant_id") REFERENCES "public"."source_trade_participants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "source_trade_participants_identity_idx" ON "source_trade_participants" USING btree ("trade_flow","participant_role","source_correlative_id");--> statement-breakpoint
CREATE INDEX "source_trade_participants_correlative_idx" ON "source_trade_participants" USING btree ("source_correlative_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trade_records_raw_trade_row_idx" ON "trade_records" USING btree ("raw_trade_row_id");--> statement-breakpoint
CREATE INDEX "trade_records_source_file_idx" ON "trade_records" USING btree ("source_file_id");--> statement-breakpoint
CREATE INDEX "trade_records_import_batch_idx" ON "trade_records" USING btree ("import_batch_id");--> statement-breakpoint
CREATE INDEX "trade_records_trade_flow_period_idx" ON "trade_records" USING btree ("trade_flow","period_year","period_month");--> statement-breakpoint
CREATE INDEX "trade_records_hs_code_idx" ON "trade_records" USING btree ("hs_code_normalized");--> statement-breakpoint
CREATE INDEX "trade_records_importer_correlative_idx" ON "trade_records" USING btree ("importer_correlative_id");--> statement-breakpoint
CREATE INDEX "trade_records_exporter_primary_correlative_idx" ON "trade_records" USING btree ("exporter_primary_correlative_id");