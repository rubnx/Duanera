# MVP Data Model Proposal

Date: 2026-05-27

## Scope

This is a provisional first MVP data model proposal based only on confirmed fields from the inspected Chile Aduana files and the existing project data-model and ingestion docs.

This proposal does not implement code, create migrations, or create database tables.

Source docs reviewed:

- `docs/research/CHILE_ADUANA_DATA_REVIEW.md`
- `docs/DATA_MODEL.md`
- `docs/DATA_INGESTION.md`
- `docs/DECISIONS.md`

The model respects the current identity constraint: importer/exporter legal names and RUTs are not confirmed in the inspected public Aduana files. The model stores only the available correlative importer/exporter IDs for now. Company identity resolution is deferred.

## Status Legend

- `confirmed`: present in inspected files or explicitly required by existing docs.
- `inferred`: needed system/model field derived from confirmed requirements.
- `unknown`: useful but not confirmed enough to trust yet.
- `deferred`: intentionally not part of MVP.

## Proposed Tables

| Table | Status | Purpose |
| --- | --- | --- |
| `source_files` | inferred | Track official raw, working, reference, and code-table files outside Postgres. |
| `import_batches` | inferred | Track each parser/import run against a source file. |
| `source_layouts` | inferred | Track file layout per flow/role/version, since files have no headers. |
| `source_layout_fields` | confirmed/inferred | Store official dictionary field order, names, descriptions, types, lengths, precision. |
| `raw_trade_rows` | confirmed/inferred | Preserve row-level raw text/values and row numbers for traceability. |
| `code_tables` | inferred | Track official decoding sources such as Annex 51/code-table workbooks. |
| `code_values` | unknown/inferred | Store code-to-label mappings once official tables are inspected. |
| `source_trade_participants` | confirmed/inferred | Store anonymous importer/exporter correlative IDs only. No names/RUTs. |
| `trade_records` | confirmed/inferred | Main ClickHouse-ready import/export fact table, one row per item record. |

## `source_files`

Tracks official source files and their provenance. Original files remain outside Postgres in object storage or local research storage.

| Field | Status |
| --- | --- |
| `id` | inferred |
| `country_code` = `CL` | confirmed |
| `source_system` = `chile_aduana` | inferred |
| `source_domain` = `datos.gob.cl` / `aduana.cl` | confirmed |
| `source_page_url`, `resource_download_url` | confirmed |
| `original_filename`, `normalized_raw_filename`, `normalized_working_filename` | confirmed/inferred |
| `storage_bucket`, `storage_key` | inferred |
| `file_hash`, `file_size_bytes` | inferred; size available in CKAN metadata |
| `file_format`, `compression_format` | confirmed |
| `file_role` | confirmed/inferred: raw, working, metadata, reference, code table |
| `trade_flow` | confirmed for import/export files |
| `period_year`, `period_month`, `period_start`, `period_end` | confirmed for monthly resources |
| `parent_source_file_id` | inferred for compressed raw file to extracted working file |
| `license_notes` | unknown |
| `processing_status`, `created_at`, `updated_at` | inferred |

## `import_batches`

Tracks each parser/import run against a source file.

| Field | Status |
| --- | --- |
| `id` | inferred |
| `source_file_id` | inferred |
| `parser_name`, `parser_version` | confirmed requirement |
| `status` | inferred |
| `started_at`, `completed_at` | inferred |
| `rows_total`, `rows_parsed`, `rows_failed` | inferred; March 2026 counts confirmed |
| `error_summary`, `warning_summary` | inferred |

## `source_layouts` And `source_layout_fields`

Tracks headerless file structure and official dictionary metadata for DIN/DUS layouts.

| Field | Status |
| --- | --- |
| `flow` = import/export | confirmed |
| `record_role` = main item file | confirmed |
| `field_count` = import 178 / export 84 | confirmed |
| `delimiter` = semicolon | confirmed |
| `has_header` = false | confirmed |
| `encoding` | unknown; non-UTF-8 risk confirmed |
| `field_ordinal`, `source_field_name` | confirmed |
| `source_description_es`, `source_type`, `length`, `precision` | confirmed by dictionary |
| `is_coded`, `code_table_key` | inferred/unknown until code tables are inspected |

## `raw_trade_rows`

Preserves row-level raw values for source tracing and future parser reprocessing.

| Field | Status |
| --- | --- |
| `id` | inferred |
| `source_file_id`, `import_batch_id` | inferred |
| `trade_flow` | confirmed |
| `row_number` | confirmed/inferred |
| `raw_text` | confirmed |
| `raw_values_json` keyed by official field names | inferred |
| `field_count` | confirmed |
| `row_hash` | inferred |
| `parse_status`, `parse_errors`, `parse_warnings` | inferred |
| `created_at` | inferred |

## `source_trade_participants`

Stores anonymous source identifiers only. This table must not store importer/exporter legal names or RUTs for the MVP.

| Field | Status |
| --- | --- |
| `id` | inferred |
| `trade_flow` | confirmed |
| `participant_role` = `importer`, `exporter_primary`, `exporter_secondary` | confirmed |
| `source_correlative_id` from `NUM_UNICO_IMPORTADOR`, `NRO_EXPORTADOR`, `NRO_EXPORTADOR_SEC` | confirmed |
| `first_seen_period`, `last_seen_period`, `record_count` | inferred |
| `cross_year_stability_status` | unknown |
| legal name / RUT fields | deferred; do not include |

## `trade_records`

Main ClickHouse-ready import/export fact table. One row represents one source item record from the inspected main import/export files.

### Core Fields

| Field | Status |
| --- | --- |
| `id` | inferred |
| `source_file_id`, `import_batch_id`, `raw_row_id` | confirmed requirement/inferred implementation |
| `trade_flow` | confirmed |
| `period_month` | confirmed from monthly source files |
| `declaration_id_raw`: import `NUMENCRIPTADO`, export `NUMEROIDENT` | confirmed |
| `item_number`: import `NUMITEM`, export `NUMEROITEM` | confirmed |
| `acceptance_date_raw`: import `FECACEP`, export `FECHAACEPT` | confirmed; normalized meaning inferred |
| `importer_correlative_id` from `NUM_UNICO_IMPORTADOR` | confirmed |
| `exporter_primary_correlative_id` from `NRO_EXPORTADOR` | confirmed |
| `exporter_secondary_correlative_id` from `NRO_EXPORTADOR_SEC` | confirmed |
| `importer_name`, `exporter_name`, `importer_rut`, `exporter_rut` | deferred; do not include |
| `hs_code_raw`: import `ARANC-NAC`, export `CODIGOARANCEL` | confirmed |
| `hs_code_normalized` | inferred |
| `product_description_raw`: import `DNOMBRE`, export `NOMBRE` | confirmed |
| `product_attributes_raw`: import attributes / export `ATRIBUTO1..6` | confirmed/inferred JSON shape |
| `product_search_text` | inferred |

### Measures And Dimensions

| Field | Status |
| --- | --- |
| `quantity`: import `CANT-MERC`, export `CANTIDADMERCANCIA` | confirmed |
| `quantity_unit_code`: import `MEDIDA`, export `UNIDADMEDIDA` | confirmed |
| `gross_weight_total`: import `TOT_PESO`, export `PESOBRUTOTOTAL` | confirmed |
| `gross_weight_item`: export `PESOBRUTOITEM` | confirmed for export; unknown for import |
| `item_cif_value`: import `CIF-ITEM` | confirmed |
| `item_fob_value`: export `FOBUS` | confirmed |
| `declaration_fob_value`, `freight_value`, `insurance_value`, `cif_value` | confirmed from import/export total value fields |
| `unit_price_value`: import `PRE-UNIT`, export `FOBUNITARIO` | confirmed |
| `currency_code_raw` from `MONEDA` | confirmed |
| `origin_country_code`, `acquisition_country_code`, `consignment_country_code` | confirmed for import |
| `destination_country_code`, `destination_country_label_raw` | confirmed for export |
| `customs_office_code` | confirmed |
| `embark_port_code`, `disembark_port_code` | confirmed |
| export port labels | confirmed |
| import port/country/customs labels | unknown until code-table decoding |
| `transport_mode_code`, `cargo_type_code` | confirmed |
| carrier/document-emitter names/RUTs | confirmed as transport/document parties, but not importer/exporter identity; keep raw-row-only for MVP unless a separate transport-party feature is chosen |

## Code-Table Decoding

Use `code_tables` and `code_values` as reference/dictionary tables, not as product identity tables.

| Field | Status |
| --- | --- |
| `code_table_key` | inferred |
| `source_file_id` | inferred |
| `source_domain` | confirmed |
| `applies_to_fields` | inferred |
| `code_value` | confirmed as present in source records |
| `label_es` | unknown until official code tables are inspected |
| `valid_from`, `valid_to` | unknown |
| `review_status` | inferred |

## Deferred From MVP

- `companies`, `company_aliases`, `importer_company_id`, `exporter_company_id`.
- Any user-facing claim that a legal company imported/exported a product.
- Identity candidate/evidence tables for `posible importador/exportador`.
- Export `bultos` and transport-document tables until those files are inspected.
- ClickHouse as an active dependency.

## ClickHouse-Ready Shape

Keep `trade_records` as a wide, low-nesting fact table with `trade_flow`, `period_month`, source/provenance IDs, raw code columns, normalized numeric columns, and nullable flow-specific fields.

Small decoding tables can later become ClickHouse dictionaries or replicated dimensions. Postgres remains the owner of source metadata, import batches, raw row references, and app data.

