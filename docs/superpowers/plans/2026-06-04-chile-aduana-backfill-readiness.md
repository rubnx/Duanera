# Chile Aduana Historical Backfill Readiness Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Safely start product-facing Chile Aduana coverage expansion toward `2021-01` through latest without importing too much data before acquisition, archive, parser, storage, and query risks are validated.

**Architecture:** Treat historical expansion as two separate phases: source acquisition/archive first, then dev database ingestion. The first ingestion should be a one-month canary, not a quarter or year, because 2021-2025 source files are not yet locally preserved or seeded as product `source_files`.

**Tech Stack:** Next.js App Router, TypeScript, Drizzle, Neon Postgres dev branch, local ignored `data/` archive, Cloudflare R2 archive, existing Aduana preflight/load/normalize/prune scripts.

---

## Readiness Summary

Current loaded product-facing periods:

- `2026-04`: import `408,027`, export `102,350`
- `2026-03`: import `439,353`, export `109,187`
- `2026-02`: import `354,508`, export `94,065`
- `2026-01`: import `380,834`, export `124,062`

Current dev database state:

- `trade_records`: `2,012,387`
- `raw_trade_rows`: `2,012,403`
- DB size: about `5,326 MB`
- `raw_trade_rows`: about `3,392 MB`
- `trade_records`: about `1,916 MB`
- pending prune rows: `0`
- March 2026 still has `548,540` full Postgres raw payload rows.
- Jan/Feb/Apr 2026 successful payloads are pruned after normalization.

Current local/source-manifest availability:

- Product-ready local source manifests currently cover 2026-01 through 2026-04 only.
- Local historical samples exist for 2003-01, 2010-01, and 2015-01, but those are research samples and pre-2021 product coverage is out of scope.
- 2021-2025 official upstream CKAN resources are known from the research inventory/API, but they are not locally preserved, not R2 archived, and not seeded as product `source_files`.

R2 coverage:

- Current local official source raw files, working files, and source manifests are archived in R2 with matching size/SHA-256.
- Current R2 preflight reports `0` missing official source raw files and `0` missing working files for the files already present locally.
- Missing R2 objects are research/generated evidence, not product ingestion blockers.
- 2021-2025 files cannot be considered R2-covered until they are acquired locally and archived.

Parser/layout signal:

- Existing preflight on local 2015-01 import/export samples has `0` blockers and only dictionary/payload-retention warnings.
- 2015 import sample matches the current DIN main layout field count of `178`.
- 2015 export sample matches the current DUS main layout field count of `84`.
- 2025 has not been sampled locally yet, so it still requires acquisition and preflight before loading.

Risk conclusion:

- Do not run a multi-year backfill yet.
- Do not start with a full quarter yet.
- Start with one newest missing month: `2025-12`.

## First Safe Batch

Use `2025-12` as the canary.

Why:

- It is the newest missing product-facing month before the loaded 2026 window.
- Official import and export main resources are single monthly RAR files, not multipart imports like 2021-2024.
- It tests 2025 parser/layout compatibility before committing to a larger 2025 batch.
- It should add roughly one current-month-sized increment instead of a multi-year jump.

Expected source resources:

- import main: `cl_aduana_imports_2025_12_raw.rar`
- export main: `cl_aduana_exports_2025_12_raw.rar`
- export bultos and transport-doc resources may be acquired/archived for provenance, but should not be normalized into `trade_records` until companion-file modeling is explicitly designed.

## Stop Conditions

Stop before ingestion if:

- official source download fails or file checksums cannot be computed
- extraction fails
- generated source manifest rows lack raw path, working path, size, or SHA-256
- R2 archive preflight shows missing official source raw or working files for `2025-12`
- `npm run preflight:aduana-load` reports blockers
- field counts differ from expected DIN `178` or DUS `84` without an explanation

Stop after raw load if:

- import or export parse failure rate is meaningfully above the known Jan/Feb split-line export issue rate
- raw rows are not tied to the intended `2025-12` source files
- raw payload retention is not `errors_and_warnings`
- source/import batch upsert behavior creates duplicates

Stop after normalization if:

- normalized `trade_records` materially differ from parsed raw rows
- provenance checks find orphaned trade records or duplicate raw links
- successful raw payloads remain in `pending_post_normalization_prune`
- representative `/explorer` or service queries become noticeably slower than current 2026 behavior

## Implementation Tasks

### Task 1: Acquire and manifest 2025-12 sources only

**Files:**

- Read: `scripts/research/chile_aduana_historical_acquisition.py`
- Modify only if necessary: `data/sources/chile-aduana/datos-gob-cl/manifests/cl_aduana_datos_gob_cl_historical_source_files_manifest.csv`
- Create local ignored source files under `data/sources/chile-aduana/datos-gob-cl/`

- [ ] Run dry-run acquisition for import 2025-12:

```bash
python3 scripts/research/chile_aduana_historical_acquisition.py \
  --flow import \
  --year 2025 \
  --month 12 \
  --dry-run
```

Expected: selects exactly one import `dataset_resource` for `2025-12`.

- [ ] Run dry-run acquisition for export 2025-12:

```bash
python3 scripts/research/chile_aduana_historical_acquisition.py \
  --flow export \
  --year 2025 \
  --month 12 \
  --dry-run
```

Expected: selects export main, bultos, and transport-doc resources for `2025-12`.

- [ ] Acquire import 2025-12:

```bash
python3 scripts/research/chile_aduana_historical_acquisition.py \
  --flow import \
  --year 2025 \
  --month 12
```

Expected: raw and working files exist; manifest row includes size and SHA-256.

- [ ] Acquire export 2025-12:

```bash
python3 scripts/research/chile_aduana_historical_acquisition.py \
  --flow export \
  --year 2025 \
  --month 12
```

Expected: raw and working files exist for export main, bultos, and transport docs; manifest rows include size and SHA-256.

### Task 2: Archive acquired 2025-12 sources to R2 before database loading

**Files:**

- Read: `docs/R2_ARCHIVE_PLAN.md`
- Use: `scripts/archive/r2-archive-preflight.ts`
- Use: `scripts/archive/r2-upload-plan.ts`
- Use: `scripts/archive/r2-upload-archive.ts`

- [ ] Run snapshot-mode R2 preflight:

```bash
npm run archive:r2:preflight -- --manifest-key-mode snapshot --pretty
```

Expected before upload: 2025-12 official source raw/working files appear as missing, with no unsafe objects or plan errors.

- [ ] Generate dry-run upload plan:

```bash
npm --silent run archive:r2:plan -- --manifest-key-mode snapshot --pretty > /tmp/duanera-r2-upload-plan.json
```

Expected: plan includes the new 2025-12 official raw files, working files, and refreshed source manifest snapshots.

- [ ] Upload only after reviewing the dry-run plan:

```bash
R2_UPLOAD_CONFIRM=upload npm run archive:r2:upload -- \
  --plan-file /tmp/duanera-r2-upload-plan.json \
  --confirm-upload
```

Expected: uploads new 2025-12 official/source-manifest objects only; no overwrites.

- [ ] Re-run R2 preflight:

```bash
npm run archive:r2:preflight -- --manifest-key-mode snapshot --pretty
```

Expected: 2025-12 official raw and working files are archived with matching size/SHA-256.

### Task 3: Seed 2025-12 source files into dev only

**Files:**

- Use: `scripts/seed/source-file-manifest.ts`

- [ ] Run source-file manifest seed against dev:

```bash
DUANERA_DB_TARGET=dev npm run db:seed:source-files
```

Expected: source-file manifest seed completes without malformed period/size/checksum errors.

- [ ] Confirm source rows exist for 2025-12 main files:

```bash
npx tsx scripts/inspect/trade-records.ts --help
```

If no existing inspect command covers source rows, run a read-only SQL probe with the existing DB client. Expected: import and export `dataset_resource` source rows exist for `2025-12`.

### Task 4: Preflight 2025-12 main files before loading

**Files:**

- Use: `scripts/ingest/aduana-load-preflight.ts`

- [ ] Run import/export main preflight:

```bash
npm run preflight:aduana-load -- \
  --manifest-file data/sources/chile-aduana/datos-gob-cl/manifests/cl_aduana_datos_gob_cl_historical_source_files_manifest.csv \
  --normalized-raw-filename cl_aduana_imports_2025_12_raw.rar \
  --normalized-raw-filename cl_aduana_exports_2025_12_raw.rar \
  --sample-rows 100 \
  --pretty
```

Expected:

- `0` blockers
- import sample field count `178`
- export sample field count `84`
- no header
- only known dictionary/payload-retention warnings

### Task 5: Load, normalize, prune, and validate 2025-12 dev data

**Files:**

- Use: `scripts/ingest/load-raw-trade-row-sample.ts`
- Use: `scripts/ingest/normalize-trade-record-sample.ts`
- Use: `scripts/ingest/prune-raw-trade-row-payloads.ts`

- [ ] Load raw rows with safe retention:

```bash
DUANERA_DB_TARGET=dev \
RAW_ROW_PAYLOAD_RETENTION=errors_and_warnings \
RAW_TRADE_ROW_SOURCE_FILENAMES=cl_aduana_imports_2025_12_raw.rar,cl_aduana_exports_2025_12_raw.rar \
SAMPLE_ROW_LIMIT=999999999 \
npm run db:load:raw-sample
```

Expected: import/export raw rows loaded for `2025-12`; parse failures are zero or explicitly explained.

- [ ] Normalize only `2025-12`:

```bash
DUANERA_DB_TARGET=dev \
NORMALIZE_PERIOD=2025-12 \
npm run db:normalize:trade-sample
```

Expected: normalized trade records match parsed raw rows.

- [ ] Dry-run pruning:

```bash
DUANERA_DB_TARGET=dev npm run db:prune:raw-payloads -- --dry-run
```

Expected: eligible rows match successful parsed `2025-12` rows; blocked rows are `0`.

- [ ] Prune export then import with explicit confirmations and limits sized to actual row counts:

```bash
DUANERA_DB_TARGET=dev \
RAW_ROW_PRUNE_CONFIRM=prune \
RAW_ROW_PRUNE_FLOW=export \
RAW_ROW_PRUNE_LIMIT=999999999 \
npm run db:prune:raw-payloads -- --prune
```

```bash
DUANERA_DB_TARGET=dev \
RAW_ROW_PRUNE_CONFIRM=prune \
RAW_ROW_PRUNE_FLOW=import \
RAW_ROW_PRUNE_LIMIT=999999999 \
npm run db:prune:raw-payloads -- --prune
```

Expected: successful rows pruned, parse-error rows retained, pending prune returns `0`.

### Task 6: Final validation and next-batch decision

**Files:**

- Read/update: `docs/SESSION_HANDOFF.md`

- [ ] Validate row/provenance counts using read-only SQL:

Expected:

- `0` orphaned trade records for 2025-12
- `0` duplicate raw links
- `0` parsed raw rows missing trade records
- `0` pending prune rows

- [ ] Run focused tests:

```bash
npm run test:aduana-load-preflight
npm run test:raw-row-loader
npm run test:trade-normalizer
npm run test:raw-row-pruner
npm run test:source-provenance
npm run test:trade-search
npm run typecheck
```

Expected: all pass.

- [ ] Smoke-check Explorer/query behavior:

Use the current local dev server if running. Otherwise start it on an available port.

Expected:

- `/explorer` still defaults to the latest product period.
- `2025-12` can be selected by period filters.
- broad multi-month queries remain bounded or visibly warned.

- [ ] Update `docs/SESSION_HANDOFF.md` with counts, parse issues, storage impact, R2 status, and recommendation.

## Recommended Next Step After Canary

If `2025-12` passes with clean parse/provenance/pruning and acceptable query behavior, load the rest of 2025 in two-month batches:

1. `2025-10` and `2025-11`
2. `2025-08` and `2025-09`
3. Continue backward through `2025-01`

Do not move to 2024 until 2025 is complete and query/storage behavior is reviewed.

2024 and earlier imports may involve multipart archive handling more often. Treat the first 2024 month as a separate canary.

## Exact Next `/goal` Prompt

```text
/goal Run the first safe Chile Aduana historical backfill canary described in docs/superpowers/plans/2026-06-04-chile-aduana-backfill-readiness.md. Execute only the 2025-12 canary: acquire official datos.gob.cl import/export sources locally, archive the new official raw/working files and source-manifest snapshots to private R2 using existing archive tooling, seed source_files in Neon dev only, preflight the 2025-12 import/export main files, load raw rows with RAW_ROW_PAYLOAD_RETENTION=errors_and_warnings, normalize only 2025-12, prune successful raw payloads, validate provenance/counts/query behavior, run focused tests and typecheck, and update docs/SESSION_HANDOFF.md. Do not modify schema, production data, /, /trade-records UI, public page styling, or source data. Stop immediately on any listed stop condition and report commands, counts, R2 status, validation results, and whether the next batch should be one month or two months.
```
