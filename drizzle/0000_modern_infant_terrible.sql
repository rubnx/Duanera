CREATE TABLE "import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_file_id" uuid NOT NULL,
	"parser_name" text NOT NULL,
	"parser_version" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"rows_total" integer,
	"rows_parsed" integer,
	"rows_failed" integer,
	"warning_summary" text,
	"error_summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"country_code" varchar(2) NOT NULL,
	"source_system" text NOT NULL,
	"source_domain" text NOT NULL,
	"source_name" text,
	"source_page_url" text,
	"resource_download_url" text,
	"acquisition_method" text,
	"original_filename" text NOT NULL,
	"normalized_raw_filename" text,
	"normalized_working_filename" text,
	"storage_bucket" text,
	"storage_key" text,
	"working_storage_key" text,
	"file_hash_sha256" text,
	"file_size_bytes" bigint,
	"file_format" text,
	"compression_format" text,
	"file_role" text NOT NULL,
	"trade_flow" text,
	"source_category" text,
	"period_year" integer,
	"period_month" integer,
	"period_start" date,
	"period_end" date,
	"license_notes" text,
	"processing_status" text DEFAULT 'pending' NOT NULL,
	"parent_source_file_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_layout_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_layout_id" uuid NOT NULL,
	"field_ordinal" integer NOT NULL,
	"source_field_name" text NOT NULL,
	"source_description_es" text,
	"source_type" text,
	"source_length" integer,
	"source_precision" integer,
	"is_coded" boolean DEFAULT false NOT NULL,
	"code_table_key" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_layouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"country_code" varchar(2) NOT NULL,
	"source_system" text NOT NULL,
	"source_domain" text,
	"trade_flow" text,
	"record_role" text NOT NULL,
	"layout_name" text NOT NULL,
	"layout_version" text,
	"source_file_id" uuid,
	"dictionary_source_file_id" uuid,
	"field_count" integer NOT NULL,
	"delimiter" text,
	"has_header" boolean DEFAULT false NOT NULL,
	"encoding" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_source_file_id_source_files_id_fk" FOREIGN KEY ("source_file_id") REFERENCES "public"."source_files"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_files" ADD CONSTRAINT "source_files_parent_source_file_id_source_files_id_fk" FOREIGN KEY ("parent_source_file_id") REFERENCES "public"."source_files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_layout_fields" ADD CONSTRAINT "source_layout_fields_source_layout_id_source_layouts_id_fk" FOREIGN KEY ("source_layout_id") REFERENCES "public"."source_layouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_layouts" ADD CONSTRAINT "source_layouts_source_file_id_source_files_id_fk" FOREIGN KEY ("source_file_id") REFERENCES "public"."source_files"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_layouts" ADD CONSTRAINT "source_layouts_dictionary_source_file_id_source_files_id_fk" FOREIGN KEY ("dictionary_source_file_id") REFERENCES "public"."source_files"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "import_batches_source_file_idx" ON "import_batches" USING btree ("source_file_id");--> statement-breakpoint
CREATE INDEX "import_batches_status_idx" ON "import_batches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "import_batches_parser_idx" ON "import_batches" USING btree ("parser_name","parser_version");--> statement-breakpoint
CREATE INDEX "source_files_source_domain_idx" ON "source_files" USING btree ("source_domain");--> statement-breakpoint
CREATE INDEX "source_files_file_role_idx" ON "source_files" USING btree ("file_role");--> statement-breakpoint
CREATE INDEX "source_files_trade_flow_period_idx" ON "source_files" USING btree ("trade_flow","period_year","period_month");--> statement-breakpoint
CREATE INDEX "source_files_hash_idx" ON "source_files" USING btree ("file_hash_sha256");--> statement-breakpoint
CREATE INDEX "source_files_parent_idx" ON "source_files" USING btree ("parent_source_file_id");--> statement-breakpoint
CREATE UNIQUE INDEX "source_layout_fields_ordinal_idx" ON "source_layout_fields" USING btree ("source_layout_id","field_ordinal");--> statement-breakpoint
CREATE UNIQUE INDEX "source_layout_fields_name_idx" ON "source_layout_fields" USING btree ("source_layout_id","source_field_name");--> statement-breakpoint
CREATE INDEX "source_layout_fields_code_table_key_idx" ON "source_layout_fields" USING btree ("code_table_key");--> statement-breakpoint
CREATE UNIQUE INDEX "source_layouts_identity_idx" ON "source_layouts" USING btree ("source_system","source_domain","trade_flow","record_role","layout_name","layout_version");--> statement-breakpoint
CREATE INDEX "source_layouts_source_file_idx" ON "source_layouts" USING btree ("source_file_id");--> statement-breakpoint
CREATE INDEX "source_layouts_dictionary_source_file_idx" ON "source_layouts" USING btree ("dictionary_source_file_id");