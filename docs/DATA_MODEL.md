# Data Model

## Purpose

This document defines the intended data model direction for Duanera.

The exact schema remains provisional until broader Chile source coverage, official code tables, and export companion files are inspected.

---

## Current certainty level

### Confirmed

- Neon-hosted PostgreSQL is the MVP database.
- Drizzle defines schema and migrations.
- Raw source files are stored outside Postgres.
- Source metadata and import state live in Postgres.
- Trade/customs records should be modeled separately from app data.
- The trade fact model must be compatible with a future ClickHouse migration.
- The inspected Chile Aduana DIN/DUS main files are row-level item records.
- The inspected files expose importer/exporter correlative IDs, not confirmed importer/exporter legal names or RUTs.
- Confirmed Aduana field groups include HS/tariff codes, product text, values, quantities, units, weights, country codes, port/customs codes, and transport codes.

### Unknown

- Raw columns across older years, export companion files, and non-main resources.
- Whether all future source roles are item-level, declaration-level, shipment-level, aggregate, or mixed.
- Whether importer/exporter legal names can be obtained from a verified lawful source.
- Whether HS codes are complete and normalized across years.
- Whether quantity units are consistent across years and flows.
- Complete labels for coded country, port, customs office, transport, unit, currency, and operation fields.

---

## Domain separation

### Operational app data

Examples:

- users
- organizations
- memberships
- plans
- subscriptions
- saved searches
- alerts
- import jobs
- source files
- permissions

### Source/provenance data

Examples:

- source files
- import batches
- raw rows
- parser versions
- validation errors
- normalization warnings

### Curated entity data

Examples:

- companies
- company aliases
- countries
- HS codes
- ports
- customs offices
- transport modes

### Trade fact data

Examples:

- import/export records
- shipment facts
- declaration facts
- monthly trade summaries
- company-product-country aggregates

In MVP, trade fact data may live in Postgres. Later, large fact tables may move to ClickHouse.

---

## MVP Data Model Direction

The approved directional proposal lives in `docs/research/MVP_DATA_MODEL_PROPOSAL.md`.

For MVP, model Chile Aduana trade data from confirmed fields in the inspected DIN/DUS main files and official dictionary metadata. The first model should support source provenance, raw row tracing, import/export item records, code-table decoding, and a future move of trade facts to ClickHouse.

Core direction:

- Use provenance and ingestion-state tables such as `source_files`, `import_batches`, `source_layouts`, `source_layout_fields`, and `raw_trade_rows`.
- Preserve row-level tracing from each normalized trade record back to source file, import batch, parser version, row number, and raw values where practical.
- Use `trade_records` as the normalized fact-style table for import/export item records, including source references, `trade_flow`, period, declaration/item identifiers, confirmed HS/tariff fields, product text/attributes, values, quantities, units, weights, country codes, port/customs codes, and transport codes.
- Store anonymous importer/exporter source correlatives where available: `NUM_UNICO_IMPORTADOR`, `NRO_EXPORTADOR`, and `NRO_EXPORTADOR_SEC`.
- Do not include importer/exporter legal names, importer/exporter RUTs, or company foreign keys in the MVP trade facts unless a verified lawful source is approved later.
- Keep company identity resolution deferred and separate from core source ingestion.
- Decode coded Aduana fields through reference/code tables populated from official sources. Labels remain unknown until official mappings are inspected.
- Keep `trade_records` wide, low-nesting, source-linked, and partition-friendly so heavy reads can move to ClickHouse later. ClickHouse remains a future option, not an MVP dependency.

## Implemented MVP Foundation

The current Drizzle schema implements the first provenance and sample trade foundation:

- `source_files`, `import_batches`, `source_layouts`, `source_layout_fields`, and `raw_trade_rows`.
- `code_tables` and `code_values` for official Aduana decoding metadata.
- `source_trade_participants` for anonymous importer/exporter correlatives only.
- `source_logistics_parties`, `source_logistics_party_aliases`, and
  `trade_record_logistics_party_links` for Aduana transport/document parties.
- `trade_records` as a shared import/export fact table with source-file, batch, and raw-row references.

The implemented `trade_records` table intentionally stores confirmed Aduana fields only, including declaration/item identifiers, flow/period, anonymous correlatives, HS/tariff code, product text/attributes, values, quantities, weights, country/port/customs/transport codes, and parser metadata.

It does not store importer/exporter legal names, importer/exporter legal RUTs, company IDs, or ClickHouse-specific dependencies.

Logistics-party tables are intentionally separate from anonymous importer/exporter
participants. They model source parties that appear in transport/document fields:

- Import `GNOM_CIA_T` / export `NOMBRECIATRANSP` as `carrier`.
- Import `NOMEMISOR` / export `NOMBREEMISORDOCTRANSP` as `issuer`.

These records may represent carriers, freight forwarders, agents, or document
issuers. They must not be presented as verified importer/exporter legal identity.
Profile and filter queries use `trade_record_logistics_party_links` so the
trade fact table remains source-linked and ClickHouse-ready.

## Raw Row Storage Direction

The March 2026 dev load proved that full raw row payloads in Postgres are useful for validation but too large to keep for every successful row long term. The current `raw_trade_rows` table should be treated as the provenance foundation, not as the permanent home for all full row JSON payloads.

MVP direction:

- Keep source files, official dictionaries, code tables, manifests, and working parse files outside Postgres.
- Keep row trace metadata in Postgres: source file, import batch, flow, period, row number, row hash, field count, parser status, and compact issue summaries.
- Keep `trade_records.raw_row_id` or an equivalent trace reference so normalized records can always point back to raw row metadata.
- Keep full raw payloads in Postgres only for dev samples, parser debugging, parser errors, parser warnings, sampled QA rows, or explicitly retained audit examples.
- For high-volume successful rows, prefer reconstructing the payload from preserved source files and row number, or moving full row payloads to object storage with a Postgres pointer and hash.
- Do not remove the current dev raw payloads until a separate migration/backfill plan is approved.

Likely future schema changes, not implemented yet:

- Make full raw payload columns nullable or retention-mode-dependent.
- Add structured parse issue tables if inline raw-row error/warning summaries are not enough.
- Keep the shape ClickHouse-ready by separating source/provenance metadata from normalized fact records.

Implemented additive retention metadata:

- `raw_trade_rows.payload_retention_mode`
- `raw_trade_rows.payload_storage_kind`
- `raw_trade_rows.payload_storage_bucket`
- `raw_trade_rows.payload_storage_key`
- `raw_trade_rows.payload_hash_sha256`
- `raw_trade_rows.payload_retained_reason`
- `raw_trade_rows.payload_pruned_at`
- `raw_trade_rows.payload_reconstructable`

These fields label and prepare payload retention choices. `raw_text` and `raw_values` are now nullable so successful payloads can be pruned after normalization while preserving source file, import batch, row number, row hash, parser status, and retention metadata.

Payload pruning is implemented as a dev-only script and remains opt-in. Existing March 2026 dev rows remain `full_postgres` and were not pruned by default.

---

## Suggested initial tables

### `source_files`

Tracks original data files.

Fields may include:

- `id`
- `country_code`
- `source_name`
- `source_type`
- `original_filename`
- `storage_bucket`
- `storage_key`
- `file_hash`
- `file_size_bytes`
- `period_start`
- `period_end`
- `license_notes`
- `status`
- `created_at`
- `updated_at`

### `import_batches`

Tracks each import attempt.

Fields may include:

- `id`
- `source_file_id`
- `parser_name`
- `parser_version`
- `status`
- `started_at`
- `completed_at`
- `rows_total`
- `rows_parsed`
- `rows_failed`
- `error_summary`

### `raw_import_rows`

Stores raw row snapshots or row JSON extracted from source files.

Fields may include:

- `id`
- `source_file_id`
- `import_batch_id`
- `row_number`
- `raw_json`
- `raw_text`
- `row_hash`
- `parse_status`
- `created_at`

This table can become large. If it grows too much, retention/compression strategy must be decided.

### `countries`

Canonical country table.

Fields may include:

- `code`
- `name_es`
- `name_en`
- `iso3`
- `region`

### `hs_codes`

HS taxonomy.

Fields may include:

- `code`
- `level`
- `parent_code`
- `description_es`
- `description_en`
- `valid_from`
- `valid_to`

### `companies`

Canonical company/entity records.

Fields may include:

- `id`
- `country_code`
- `canonical_name`
- `normalized_name`
- `tax_id`
- `entity_type`
- `confidence`
- `created_at`
- `updated_at`

### `company_aliases`

Tracks source names and aliases mapped to companies.

Fields may include:

- `id`
- `company_id`
- `source_name`
- `normalized_name`
- `source_country_code`
- `confidence`
- `review_status`

### `ports`

Ports or customs locations if available.

Fields may include:

- `id`
- `country_code`
- `name`
- `code`
- `type`

### `trade_records`

Initial MVP fact table.

Fields are provisional and depend on actual data.

Possible fields:

- `id`
- `source_file_id`
- `import_batch_id`
- `raw_row_id`
- `trade_flow` import/export
- `reporter_country_code`
- `partner_country_code`
- `origin_country_code`
- `destination_country_code`
- `period_month`
- `declaration_date`
- `hs_code`
- `product_description`
- `importer_company_id`
- `exporter_company_id`
- `importer_raw_name`
- `exporter_raw_name`
- `port_id`
- `customs_office_id`
- `transport_mode`
- `quantity`
- `quantity_unit`
- `gross_weight_kg`
- `net_weight_kg`
- `fob_value_usd`
- `cif_value_usd`
- `currency`
- `record_status`
- `created_at`

---

## ClickHouse-ready modeling

The `trade_records` model should be fact-style:

- wide enough for analytical filtering
- explicit date/month fields
- stable dimension references
- low-nesting
- clear numeric types
- source/provenance references
- suitable for bulk inserts
- suitable for partitioning by country and month later

Do not build the product around deeply nested JSON if the data should be filterable.

---

## Entity normalization

Company/product normalization must be cautious.

Rules:

- Preserve raw names.
- Store normalized names separately.
- Do not overwrite source names.
- Use confidence/review status when mapping aliases.
- Avoid pretending uncertain matches are verified.
- Keep manual review possible.

---

## Provenance

Every normalized trade record should preserve:

- source file
- import batch
- raw row
- parser version
- normalization metadata where useful

If a source does not allow row-level provenance, document the limitation.

---

## Migration policy

- All schema changes must use migrations committed to the repo.
- Do not make manual dashboard-only schema changes without reflecting them in migrations.
- Any schema change affecting source/provenance/trade facts must be logged in `DECISIONS.md`.
