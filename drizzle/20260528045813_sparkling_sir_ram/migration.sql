CREATE TABLE "code_tables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code_table_key" text NOT NULL,
	"country_code" varchar(2) NOT NULL,
	"source_system" text NOT NULL,
	"source_domain" text NOT NULL,
	"table_name" text NOT NULL,
	"source_sheet_name" text,
	"source_file_id" uuid,
	"review_status" text DEFAULT 'seeded' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "code_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code_table_id" uuid NOT NULL,
	"code_value" text NOT NULL,
	"label_es" text,
	"normalized_label_es" text,
	"valid_from" date,
	"valid_to" date,
	"sort_order" integer,
	"metadata" jsonb,
	"review_status" text DEFAULT 'seeded' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "code_tables" ADD CONSTRAINT "code_tables_source_file_id_source_files_id_fk" FOREIGN KEY ("source_file_id") REFERENCES "public"."source_files"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "code_values" ADD CONSTRAINT "code_values_code_table_id_code_tables_id_fk" FOREIGN KEY ("code_table_id") REFERENCES "public"."code_tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "code_tables_key_idx" ON "code_tables" USING btree ("code_table_key");--> statement-breakpoint
CREATE INDEX "code_tables_source_file_idx" ON "code_tables" USING btree ("source_file_id");--> statement-breakpoint
CREATE UNIQUE INDEX "code_values_table_value_idx" ON "code_values" USING btree ("code_table_id","code_value");--> statement-breakpoint
CREATE INDEX "code_values_code_value_idx" ON "code_values" USING btree ("code_value");--> statement-breakpoint
CREATE INDEX "code_values_normalized_label_idx" ON "code_values" USING btree ("normalized_label_es");