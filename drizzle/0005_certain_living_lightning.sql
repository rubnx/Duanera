CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX "trade_records_trade_flow_period_origin_country_idx" ON "trade_records" USING btree ("trade_flow","period_year","period_month","origin_country_code");--> statement-breakpoint
CREATE INDEX "trade_records_trade_flow_period_destination_country_idx" ON "trade_records" USING btree ("trade_flow","period_year","period_month","destination_country_code");--> statement-breakpoint
CREATE INDEX "trade_records_trade_flow_period_customs_office_idx" ON "trade_records" USING btree ("trade_flow","period_year","period_month","customs_office_code");--> statement-breakpoint
CREATE INDEX "trade_records_trade_flow_period_transport_mode_idx" ON "trade_records" USING btree ("trade_flow","period_year","period_month","transport_mode_code");--> statement-breakpoint
CREATE INDEX "trade_records_product_search_trgm_idx" ON "trade_records" USING gin ("product_search_text" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "trade_records_exporter_secondary_correlative_idx" ON "trade_records" USING btree ("exporter_secondary_correlative_id");
