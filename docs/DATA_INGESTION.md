# Data Ingestion

## Purpose

This document defines how Duanera should acquire, store, parse, validate, and normalize customs/trade source data.

The first real Chile data source has not yet been inspected. Dataset-specific ingestion rules must be added after review.

---

## Current certainty level

### Confirmed

- Raw source files are stored outside Postgres.
- Original source files must never be overwritten.
- Postgres tracks source metadata, import batches, and processing state.
- Import pipelines must preserve provenance.
- Parser behavior must be versioned.
- Import logic should be designed so trade facts can move to ClickHouse later.
- During the Chile Aduana research phase, official source files may come from either `datos.gob.cl` or `aduana.cl`.

### Unknown

- Source format.
- Source size.
- Update frequency.
- Whether sources are public, paid, scraped, or manually acquired.
- Legal/licensing limits.
- Whether source data is row-based, monthly aggregate, or mixed.
- Whether the public data contains company-level fields suitable for a DataSur-like MVP.

---

## Ingestion principles

- Preserve first, parse second.
- Store raw files unchanged.
- Store source metadata before processing.
- Make imports repeatable.
- Make parser versions explicit.
- Do not hide errors.
- Do not normalize destructively.
- Keep provenance from normalized record back to source.
- Prefer idempotent imports where possible.
- Do not assume field meanings without checking official metadata.
- Do not implement source-specific parsing rules until at least one real source file and its metadata/dictionary have been inspected.

---

## Expected ingestion flow

```txt
1. Acquire source file.
2. Preserve the original downloaded file in raw storage.
3. Create source_file record in Postgres.
4. Create import_batch record.
5. Detect file type and parser.
6. If compressed, extract usable child files into working storage.
7. If directly usable, make the file available in working storage by copy or link.
8. Inspect columns and metadata.
9. Extract rows.
10. Store raw row snapshots where practical.
11. Validate required/known fields.
12. Normalize values into trade records and dimensions.
13. Record errors and warnings.
14. Mark import batch complete, failed, or partial.
```

## Current sample ingestion implementation

The first implementation is intentionally sample-only and dev-only.

Available scripts:

- `DUANERA_DB_TARGET=dev npm run db:seed:source-files`
- `DUANERA_DB_TARGET=dev npm run db:seed:source-layouts`
- `DUANERA_DB_TARGET=dev npm run db:seed:code-tables`
- `DUANERA_DB_TARGET=dev npm run db:load:raw-sample`
- `DUANERA_DB_TARGET=dev npm run db:normalize:trade-sample`

These scripts use the March 2026 main import/export files already preserved under `data/sources/chile-aduana/`. They load 100 rows per flow by default, preserve raw rows first, then normalize those rows into `trade_records`.

They are not full ingestion. They do not import complete files, production data, legal company identities, export companion bultos, or transport-document files.

The raw-row and normalization scripts are batched/chunked so they can be used for larger dev-only validation by increasing their limits. After the Neon project was upgraded from the 512 MB free storage limit, a full March 2026 dev load completed on May 28, 2026: 439,353 import rows and 109,187 export rows were loaded into `raw_trade_rows` and normalized into `trade_records` with 0 parse failures.

This is still a dev validation path, not production ingestion. Full-month raw row storage increased the dev database to roughly 2 GB, so storage strategy and query performance should be reviewed before loading more months.

## Raw row retention and storage policy

The March 2026 dev load confirmed that full raw row payloads are the main database growth risk. `raw_trade_rows` accounted for roughly 1.60 GiB of the 2.14 GiB dev database, mostly from `raw_text` and `raw_values` payloads. A 12-month load with the current design would be roughly 25 GiB by linear estimate before extra files, indexes, branches, or production overhead.

### Preserve forever

Duanera must preserve the official source artifacts forever outside Postgres:

- original compressed or direct source files exactly as downloaded
- official dictionaries, layouts, code tables, annexes, methodology files, and manifests
- extracted working files when they are needed to make parsing reproducible
- checksums, source URLs, acquisition metadata, period, flow, file role, and parent/child file relationships

The permanent source of truth for raw source data is object storage or the documented local research archive during discovery, not Postgres.

### Keep in Postgres

Postgres should keep lightweight trace metadata for each parsed source row:

- `source_file_id`
- `import_batch_id`
- `trade_flow`
- `period_year` and `period_month`
- `row_number`
- field count
- row hash or checksum
- parser name/version through the import batch
- parse status
- compact parse error/warning summaries
- timestamps needed for audit and reruns

Normalized `trade_records` should continue to reference `source_file_id`, `import_batch_id`, and `raw_row_id` so every user-facing record can trace back to the exact source file and source row order.

### Store selectively

Full row payloads should not remain in Postgres for every successfully parsed row long term. Postgres may keep full `raw_text` and `raw_values` payloads for:

- dev samples
- parser debugging
- rows with parse errors
- rows with parse warnings
- sampled QA rows
- explicitly retained audit examples

For successful high-volume rows, the preferred MVP-safe direction is to keep only trace metadata in Postgres and either:

- reconstruct the row from preserved source and working files using `source_file_id` plus `row_number`, or
- store full row payloads in object storage and keep only a storage pointer/hash in Postgres.

Do not delete existing dev payloads until a separate migration and backfill plan is approved. Do not apply this policy to production until production ingestion exists and object storage is configured.

### Parser errors and warnings

Parser errors and warnings should remain easy to inspect. Future ingestion should retain enough information to reproduce and diagnose failures:

- failed rows should keep full raw payloads in Postgres or an object-storage pointer
- warnings should keep compact summaries in Postgres and optionally retain full payloads for a bounded QA window
- parser status should remain tied to import batch, parser version, source file, and row number
- error categories should be structured enough to count and filter later

### Effect on future ingestion scripts

Future ingestion scripts should make raw-row payload retention explicit. A script should be able to choose a retention mode such as sample/debug, errors-only, object-storage payloads, or metadata-only successful rows.

The default production direction should be:

1. preserve official source files outside Postgres
2. insert source and batch metadata
3. parse rows with row numbers and hashes
4. keep metadata for all rows in Postgres
5. retain full payloads only for errors, warnings, samples, or object-storage-backed payloads
6. normalize confirmed fields into `trade_records`
7. keep `trade_records` linked to source file, import batch, and raw row metadata

Likely future schema changes, not implemented yet, include:

- nullable `raw_text` and `raw_values` for successful rows
- structured parse issue records if inline summaries become too limited
- an explicit way to identify rows whose full payload can be reconstructed from preserved source files

The first additive retention metadata fields are implemented on `raw_trade_rows`: payload retention mode, storage kind, optional storage bucket/key, payload hash, retained reason, prune timestamp, and reconstruction flag.

Current raw row loading supports `RAW_ROW_PAYLOAD_RETENTION`:

- `full_postgres` is the default and keeps current behavior.
- `errors_and_warnings` labels failed rows as `parse_error`, warning rows as `parse_warning`, and successful rows as `pending_post_normalization_prune`.

Successful-row pruning is now available as a separate dev-only post-normalization step. `raw_text` and `raw_values` are nullable, but the normalizer still reads `raw_values`, so pruning must run only after matching `trade_records` exist.

Use `DUANERA_DB_TARGET=dev npm run db:prune:raw-payloads` for a dry run. To actually prune, set `RAW_ROW_PRUNE_CONFIRM=prune`. The script prunes only rows marked `errors_and_warnings` / `pending_post_normalization_prune`, with no parse errors or warnings, and with matching provenance in `trade_records`.

Existing March 2026 dev rows remain `full_postgres` and are not eligible unless explicitly reloaded or re-marked for pruning. External payload storage remains deferred.

---

## Raw file storage

Raw files should live in:

- Cloudflare R2, or
- another S3-compatible object storage provider

For local research, use `data/sources/`.

For object storage, use organized paths such as:

```txt
raw/chile/aduana/datos-gob-cl/imports/2024/01/source-file.xlsx
raw/chile/aduana/datos-gob-cl/exports/2024/01/source-file.xlsx
raw/chile/aduana/aduana-cl/code-tables/2026/05/source-file.xlsx
```

Exact naming can change after source review, but source domain, trade flow, period, and file role must remain clear.

---

## Source file metadata

Each source file should track:

- country
- source domain
- source name
- source page URL
- resource/download URL when available
- acquisition method
- original filename
- normalized filename
- storage path
- checksum/hash when practical
- file size
- period covered
- import/export/both/reference/code-table if known
- file role
- license notes
- acquisition timestamp
- processing status
- parent source file when applicable
- working file path when applicable

Recommended file roles:

- `compressed_source_file`
- `direct_source_file`
- `working_file`
- `reference_file`
- `code_table_file`

---

## Official source handling

During the Chile Aduana research phase, official source files may come from either:

- `datos.gob.cl`
- `aduana.cl`

Both are treated as official Aduana-related sources, but their origin must be preserved separately.

`datos.gob.cl` is the primary open-data portal for discovering dataset pages and resource downloads.

`aduana.cl` is the official Aduana site for operational files, code tables, annexes, methodology, dashboards, and validation.

Original downloaded files from either domain are raw source files. This includes `.zip`, `.rar`, `.xlsx`, `.csv`, `.txt`, `.pdf`, `.html`, and other official files.

Raw source files must not be destroyed unless they have first been preserved in the raw source archive location or uploaded to object storage with provenance metadata.

Recommended local structure:

```txt
data/sources/chile-aduana/
  datos-gob-cl/
    imports/
      raw/
      working/
    exports/
      raw/
      working/
    references/
      raw/
      working/
    manifests/

  aduana-cl/
    imports/
      raw/
      working/
    exports/
      raw/
      working/
    code-tables/
      raw/
      working/
    references/
      raw/
      working/
    manifests/
```

Local duplicate copies may be deleted only after confirming that the original source file is preserved in the correct `raw/` location and documented in the manifest.

Never delete the only copy of an official downloaded source file.

Shared dictionaries, metadata workbooks, schemas, methodology documents, and similar non-trade-data reference files should live under the source domain's `references/` directory. Keep `imports/` and `exports/` focused on actual monthly or yearly trade data resources.

Use `code-tables/` only for lookup tables that decode coded values, such as country codes, customs offices, operation codes, currencies, units, transport modes, or ports.

---

## Raw and working files

Duanera separates provenance files from usable working files.

### `raw/`

`raw/` stores official downloaded files exactly as received, with normalized local filenames.

Raw files are preserved for provenance.

Examples:

```txt
raw/cl_aduana_imports_2025_01_raw.part01.rar
raw/cl_aduana_exports_2025_01_raw.zip
raw/cl_aduana_data_dictionary_2026_05_26_raw.xlsx
raw/cl_aduana_annex51_code_tables_2026_05_26_raw.xlsx
```

### `working/`

`working/` stores the usable files that Codex, scripts, and future parsers should inspect.

Codex and parser scripts should use `working/` as the default location for inspection and parsing.

If the source file was compressed, `working/` contains the extracted child files.

If the source file was directly usable, `working/` contains a copy or link to that usable file.

Examples:

```txt
working/cl_aduana_imports_2025_01.csv
working/cl_aduana_exports_2025_01.csv
working/cl_aduana_data_dictionary_2026_05_26.xlsx
working/cl_aduana_annex51_code_tables_2026_05_26.xlsx
```

Do not treat `working/` as provenance. The source of truth for provenance is always `raw/` plus the manifest.

---

## Source file handling

Every official downloaded file is a raw source file, whether compressed or directly usable.

If the downloaded source is compressed, such as `.zip`, `.rar`, `.7z`, `.tar`, or `.gz`:

- store the original compressed package in `raw/`
- extract its contents into `working/`
- record the relationship in the manifest

If the downloaded source is directly usable, such as `.csv`, `.xlsx`, `.txt`, `.json`, `.xml`, `.pdf`, or `.html`:

- store the original downloaded file in `raw/`
- copy or link the usable file into `working/`
- record both paths in the manifest

Do not force extraction when the source file is already directly usable.

Do not delete raw files. Duplicate temporary files outside the documented structure may be deleted only after the raw file and working file are both present and documented.

---

## Filename normalization

Local and object-storage filenames should be normalized for predictable ingestion.

The original official filename must always be preserved in the source manifest.

Recommended filename rules:

- lowercase
- ASCII only
- snake_case
- no spaces
- no accents
- no ambiguous punctuation
- preserve the file extension
- preserve multipart archive part numbers
- include country, source, trade flow, period, and file role where practical

Recommended raw filename pattern:

```txt
cl_aduana_{flow}_{yyyy}_{mm}_raw[.partNN].{ext}
```

Recommended working filename pattern:

```txt
cl_aduana_{flow}_{yyyy}_{mm}.{ext}
```

For code tables or references:

```txt
cl_aduana_{source_or_reference}_{yyyy}_{mm}_{dd}_raw.{ext}
cl_aduana_{source_or_reference}_{yyyy}_{mm}_{dd}.{ext}
```

Examples:

```txt
raw/cl_aduana_imports_2025_01_raw.part01.rar
working/cl_aduana_imports_2025_01.csv

raw/cl_aduana_exports_2025_01_raw.zip
working/cl_aduana_exports_2025_01.csv

raw/cl_aduana_data_dictionary_2026_05_26_raw.xlsx
working/cl_aduana_data_dictionary_2026_05_26.xlsx

raw/cl_aduana_annex51_code_tables_2026_05_26_raw.xlsx
working/cl_aduana_annex51_code_tables_2026_05_26.xlsx
```

Do not treat the normalized filename as the only provenance record. The manifest must preserve:

- original filename
- normalized raw filename
- normalized working filename when applicable
- source domain
- source page URL
- resource/download URL
- file size
- checksum when practical
- download date
- parent/child relationship when applicable

---

## Manifest requirements

Each source group should have a manifest.

A manifest may be one file per source batch, one file per period, or one file per downloaded resource. The exact format can be decided after source review.

For now, each manifest should record:

- source domain
- source page URL
- resource/download URL
- original filename
- normalized raw filename
- normalized working filename when applicable
- country
- trade flow or source category
- year
- month or period
- file format
- file size
- checksum when practical
- downloaded at
- file role
- requires extraction
- working files
- notes

Example:

```json
{
  "source_domain": "datos.gob.cl",
  "source_page_url": "https://datos.gob.cl/dataset/registro-de-importacion-2025",
  "resource_download_url": "https://...",
  "original_filename": "Importaciones Enero 2025.part01.rar",
  "normalized_raw_filename": "cl_aduana_imports_2025_01_raw.part01.rar",
  "normalized_working_filename": "cl_aduana_imports_2025_01.csv",
  "country": "CL",
  "trade_flow": "import",
  "period": "2025-01",
  "file_format": "rar",
  "file_role": "compressed_source_file",
  "requires_extraction": true,
  "working_files": ["cl_aduana_imports_2025_01.csv"],
  "checksum_sha256": null,
  "downloaded_at": "YYYY-MM-DD",
  "notes": ""
}
```

For a direct source file:

```json
{
  "source_domain": "datos.gob.cl",
  "source_page_url": "https://datos.gob.cl/dataset/diccionario-de-datos-para-datos-abiertos-aduana/resource/792ca993-e4e4-4b83-a965-7aafca93fe2f",
  "resource_download_url": "https://...",
  "original_filename": "DiccionarioDatos_Codigos_Glosas.xlsx",
  "normalized_raw_filename": "cl_aduana_data_dictionary_2026_05_26_raw.xlsx",
  "normalized_working_filename": "cl_aduana_data_dictionary_2026_05_26.xlsx",
  "country": "CL",
  "source_category": "data_dictionary",
  "period": null,
  "file_format": "xlsx",
  "file_role": "direct_source_file",
  "requires_extraction": false,
  "working_files": ["cl_aduana_data_dictionary_2026_05_26.xlsx"],
  "checksum_sha256": null,
  "downloaded_at": "YYYY-MM-DD",
  "notes": ""
}
```

---

## Parser versioning

Every parser should have a name and version.

Example:

```txt
chile_aduana_xlsx_v1
chile_aduana_csv_v1
chile_aduana_txt_v1
```

If a parser changes meaningfully, increment its version.

This allows old records to be traced to the parser that created them.

---

## Validation

Validation should detect:

- missing required columns
- unexpected column names
- invalid dates
- invalid numeric values
- invalid HS codes
- inconsistent country names/codes
- negative or impossible quantities
- duplicated source rows
- suspiciously large or small values
- malformed company names

Validation can produce:

- errors, blocking import
- warnings, allowing partial import
- review flags, requiring manual inspection

---

## Normalization

Normalization may include:

- date parsing
- numeric parsing
- currency handling
- country code mapping
- HS code cleanup
- company name normalization
- unit normalization
- port/customs office mapping
- transport mode mapping

Never delete the raw value. Store normalized values separately.

Normalization must preserve:

- original raw field value
- normalized value
- parser version
- source file reference
- raw row reference where practical
- warning/review flags where needed

---

## Idempotency and duplicates

Imports should avoid creating duplicate records when the same file is processed twice.

Possible duplicate keys:

- source file hash
- raw row hash
- source-provided declaration id if available
- combination of period, company, HS code, value, quantity, and row hash

Exact strategy depends on source data.

---

## Background jobs

MVP may start with simple server-side import scripts or admin-triggered jobs.

Add a job system later if imports become slow or frequent:

- Inngest
- Trigger.dev
- custom worker
- queue-based ingestion

Do not block the user interface while large files are processing.

---

## ClickHouse readiness

The ingestion pipeline must be designed so that, later:

- normalized trade facts can be written to ClickHouse
- Postgres remains the owner of app data and import metadata
- source/provenance remains intact
- query services can switch heavy reads to ClickHouse

Do not couple ingestion exclusively to Postgres table names in UI code.

During MVP, Postgres may hold the first normalized customs/trade records if the dataset is manageable. The schema and service layer must still treat those records as trade facts that may move to ClickHouse later.

---

## Legal and licensing review

Before publishing or reselling data, document:

- source origin
- acquisition method
- license or public-use terms
- redistribution permissions
- restrictions on commercial usage
- attribution requirements
- retention requirements

If unclear, mark data as internal/research only until reviewed.
