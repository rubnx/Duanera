# Duanera Data Foundation Execution Plan

## Summary

Build the next Duanera data layer in controlled dev-only phases, ending with a first shared `trade_records` model for both imports and exports.

Execution target:

- Use Neon `dev` only until the full sample pipeline is proven.
- Start with small March 2026 import/export samples, not full-file ingestion.
- Preserve source provenance and raw rows before creating normalized trade records.
- Do not add importer/exporter legal names or RUTs.
- Do not add ClickHouse yet.

## Key Changes

- Apply existing generated migration `drizzle/0001_awesome_swarm.sql` to Neon `dev`, creating `raw_trade_rows`.
- Add dev-safety checks for data-mutating scripts so sample loaders refuse to run unless the local DB target is explicitly dev.
- Add source-file manifest seeding from existing local manifests so selected trade files exist in `source_files`.
- Add code-table schema and seed support from `cl_aduana_code_tables_2026_05_26.xlsx`:
  - `code_tables`
  - `code_values`
- Add parser utilities for Aduana main files:
  - semicolon-delimited rows
  - no header row
  - Latin-1 / Windows-1252-safe decoding
  - field-count validation against `source_layout_fields`
  - row hashing
  - decimal-comma numeric parsing
  - raw date preservation plus best-effort normalized dates
- Add sample raw-row loaders:
  - import sample: `cl_aduana_imports_2026_03.txt`, capped to 100 rows by default
  - export sample: `cl_aduana_exports_2026_03.txt`, capped to 100 rows by default
- Add first normalized trade schema:
  - `source_trade_participants` for anonymous correlatives only
  - `trade_records` as a wide, ClickHouse-ready fact table
- Add sample normalization from `raw_trade_rows` into `trade_records` for both imports and exports.

## Implementation Steps

1. **Plan file and guardrails**
   - Create this plan file.
   - Add `.env.example` guidance for `DUANERA_DB_TARGET=dev`.
   - Data-mutating seed/ingest scripts must fail unless `DUANERA_DB_TARGET=dev`.
   - Production remains untouched.

2. **Apply current dev migration**
   - Run `npm run db:migrate` against `.env.local`.
   - Verify dev contains `source_files`, `import_batches`, `source_layouts`, `source_layout_fields`, and `raw_trade_rows`.
   - Re-run `npm run db:seed:source-layouts` if needed.

3. **Source-file metadata**
   - Add a manifest seed script that reads existing Aduana manifest CSVs.
   - Upsert `source_files` for selected official March 2026 import/export main files and the code-table workbook.
   - Store local paths in source metadata for now; raw files still remain outside Postgres.

4. **Code-table foundation**
   - Add dependencies only if needed:
     - `csv-parse` for manifest/TXT parsing
     - `iconv-lite` for safer source decoding
     - `exceljs` for XLSX code-table parsing
   - Add Drizzle schema and migration for `code_tables` and `code_values`.
   - Seed only official code-table sheets already present in the workbook.
   - Do not force every Aduana source field to a decoded label until mapping is confirmed.

5. **Raw row sample ingestion**
   - Add a sample-only raw loader.
   - For each selected source file, create one `import_batches` record.
   - Insert capped `raw_trade_rows` with provenance, raw text, raw values, field count, row hash, and parse status.
   - Keep the loader idempotent by source file + row number.

6. **First trade model**
   - Add `source_trade_participants` for anonymous IDs only.
   - Add `trade_records` as one normalized row per raw main item row.
   - Include required provenance fields.
   - Store confirmed shared/flow-specific import/export fields.
   - Exclude importer/exporter legal names, legal RUTs, and company foreign keys.

7. **Sample normalization**
   - Normalize the same 100 import rows and 100 export rows from `raw_trade_rows`.
   - Upsert anonymous participants.
   - Insert `trade_records`.
   - Make normalization idempotent by `raw_trade_row_id`.

8. **Docs and handoff**
   - Update `docs/DATA_MODEL.md` only if the implemented schema differs from current direction.
   - Update `docs/DECISIONS.md` only for new schema or ingestion policy decisions.
   - Update `docs/SESSION_HANDOFF.md` after the full dev sample pass.

## Test Plan

- Run `npm run typecheck` after each code/schema pass.
- Add parser tests using tiny inline fixture rows:
  - import row maps 178 fields
  - export row maps 84 fields
  - wrong field count becomes a parse error
  - decimal comma parses correctly
  - Latin-1/Windows-1252 text survives parsing
  - row hash is stable
- Verify generated migrations before applying:
  - no `companies`
  - no importer/exporter legal-name columns
  - no importer/exporter RUT columns
  - no ClickHouse dependency
- After dev sample load, verify:
  - 100 import `raw_trade_rows`
  - 100 export `raw_trade_rows`
  - matching `import_batches`
  - matching `trade_records`
  - every `trade_records.raw_trade_row_id` points to a raw row
  - every normalized record traces to source file and batch
  - rerunning sample scripts does not duplicate rows

## Assumptions

- First implementation target is both imports and exports, using small samples first.
- March 2026 main files are the first sample files because they were already inspected and documented.
- Postgres remains the MVP operational database.
- ClickHouse readiness means wide fact records, simple scalar columns, source IDs, flow/period fields, and no UI coupling to direct table reads.
- Raw files remain in local research storage for now; object storage upload is a later phase.
- Company identity resolution remains deferred and separate from core ingestion.
