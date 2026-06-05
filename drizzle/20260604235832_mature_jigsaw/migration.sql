CREATE TABLE "source_logistics_parties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"identity_key" text NOT NULL,
	"display_name" text NOT NULL,
	"raw_name_representative" text,
	"normalized_legal_entity_name" text,
	"normalized_group_name" text,
	"country_code" varchar(2),
	"entity_type" text,
	"confidence" text DEFAULT 'low' NOT NULL,
	"match_reason" text,
	"is_ambiguous" boolean DEFAULT false NOT NULL,
	"identity_source" text NOT NULL,
	"first_seen_year" integer,
	"first_seen_month" integer,
	"last_seen_year" integer,
	"last_seen_month" integer,
	"record_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_logistics_party_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"party_id" uuid NOT NULL,
	"role" text NOT NULL,
	"source_field" text NOT NULL,
	"raw_value" text NOT NULL,
	"raw_value_normalized" text NOT NULL,
	"source_rut" text,
	"source_rut_dv" text,
	"source_country_code" text,
	"first_seen_year" integer,
	"first_seen_month" integer,
	"last_seen_year" integer,
	"last_seen_month" integer,
	"record_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade_record_logistics_party_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"trade_record_id" uuid NOT NULL,
	"party_id" uuid NOT NULL,
	"role" text NOT NULL,
	"source_field" text NOT NULL,
	"raw_value" text NOT NULL,
	"source_rut" text,
	"source_rut_dv" text,
	"source_country_code" text,
	"trade_flow" text NOT NULL,
	"period_year" integer NOT NULL,
	"period_month" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "source_logistics_parties_identity_idx" ON "source_logistics_parties" ("identity_key");--> statement-breakpoint
CREATE INDEX "source_logistics_parties_display_name_idx" ON "source_logistics_parties" ("display_name");--> statement-breakpoint
CREATE INDEX "source_logistics_parties_group_idx" ON "source_logistics_parties" ("normalized_group_name");--> statement-breakpoint
CREATE UNIQUE INDEX "source_logistics_party_aliases_identity_idx" ON "source_logistics_party_aliases" ("party_id","role","source_field","raw_value_normalized");--> statement-breakpoint
CREATE INDEX "source_logistics_party_aliases_party_idx" ON "source_logistics_party_aliases" ("party_id");--> statement-breakpoint
CREATE INDEX "source_logistics_party_aliases_raw_value_idx" ON "source_logistics_party_aliases" ("raw_value_normalized");--> statement-breakpoint
CREATE UNIQUE INDEX "trade_record_logistics_party_links_identity_idx" ON "trade_record_logistics_party_links" ("trade_record_id","party_id","role","source_field");--> statement-breakpoint
CREATE INDEX "trade_record_logistics_party_links_record_idx" ON "trade_record_logistics_party_links" ("trade_record_id");--> statement-breakpoint
CREATE INDEX "trade_record_logistics_party_links_party_idx" ON "trade_record_logistics_party_links" ("party_id");--> statement-breakpoint
CREATE INDEX "trade_record_logistics_party_links_party_role_idx" ON "trade_record_logistics_party_links" ("party_id","role");--> statement-breakpoint
CREATE INDEX "trade_record_logistics_party_links_flow_period_idx" ON "trade_record_logistics_party_links" ("trade_flow","period_year","period_month");--> statement-breakpoint
ALTER TABLE "source_logistics_party_aliases" ADD CONSTRAINT "source_logistics_party_aliases_M3igjF2uHc29_fkey" FOREIGN KEY ("party_id") REFERENCES "source_logistics_parties"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "trade_record_logistics_party_links" ADD CONSTRAINT "trade_record_logistics_party_links_Zp9ZyvnKX6Ek_fkey" FOREIGN KEY ("trade_record_id") REFERENCES "trade_records"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "trade_record_logistics_party_links" ADD CONSTRAINT "trade_record_logistics_party_links_jz4qMRdeJOgx_fkey" FOREIGN KEY ("party_id") REFERENCES "source_logistics_parties"("id") ON DELETE CASCADE;