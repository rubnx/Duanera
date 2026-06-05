# Explorer Data Load Goal

Use this document as the referenced instruction set for a long `/goal` run. The short `/goal` prompt can point here instead of pasting the full task text.

## Goal

Run a long safe data-foundation pass for `/explorer` by loading as many additional product-facing Aduana months as safely possible within the current product coverage target.

Expand the real dev Aduana dataset behind `/explorer` while preserving provenance, preserving source files, avoiding database bloat, and stopping if ingestion, storage, or query behavior shows risk.

## Month Target

- Target product-facing Chile Aduana coverage from `2021-01` through the latest available product-facing month.
- Continue from the currently loaded product-facing months and load suitable missing months until the `2021-01` lower bound is reached or a stop condition is met.
- Prefer recent missing months first unless source availability, archive status, or parser/layout risk makes another order safer.
- Do not load future, smoke, fixture, test, QA, or internal `source_category` data.
- Do not load `2099-01` or any clearly non-product-facing period.
- Do not load pre-2021 Aduana files into product-facing Explorer paths for now.
- Stop when product-facing coverage reaches `2021-01` through the latest available month, or earlier if any stop condition is met.

## Safety

- Do not touch production data.
- Do not change schema unless you stop and ask first.
- Do not delete or overwrite existing raw/source data.
- Preserve source files, import batches, raw row references, and normalized trade record provenance.
- Keep smoke/test/internal records available for QA but excluded from product-facing Explorer defaults.
- Use existing ingestion scripts and data-access architecture.
- Avoid full raw payload retention for high-volume successful rows if the current tooling supports a safer retention mode.

## R2 And Source Archive Requirements

- Inspect the existing R2/archive scripts and source storage conventions before loading.
- For each candidate month, verify whether the raw official source files are already preserved locally and whether an R2 archive record/path exists or can be produced by existing scripts.
- If existing R2 archive tooling and credentials are available, run the existing archive preflight/verify/upload flow for selected source files before or alongside ingestion.
- Do not create a new R2 architecture or storage convention.
- Do not store raw customs files inside Postgres.
- Do not delete local source files after upload.
- If R2 credentials or bucket config are missing, do not block small dev loading automatically, but clearly report that source archive is local-only and flag it as a risk.
- If a source file is not preserved locally and cannot be archived or verified, skip that month.
- Record R2/local archive status for every attempted month in `docs/SESSION_HANDOFF.md`.

## Stop Conditions

- Stop if projected or observed database growth looks unsafe for the dev Neon database.
- Stop if a month has a meaningful parser failure rate or unexplained parse warnings.
- Stop if normalized trade record count differs materially from expected source row count without explanation.
- Stop if source/import batch creation is not idempotent or appears to create duplicates.
- Stop if representative Explorer queries become noticeably slow or unstable.
- Stop if loading requires schema changes.
- Stop if source files are missing, corrupted, ambiguous, not preserved, or not clearly product-facing.

## Tasks

1. Inspect currently loaded periods, source files, import batches, raw row counts, normalized record counts, and payload retention state.
2. Inspect available local/source-manifest Aduana files and identify candidate months not yet loaded.
3. Select candidate months using the target rules above.
4. For each selected month, before loading:
   - run the existing preflight checks
   - confirm source files, period, flow, layout compatibility, and expected counts
   - verify local source preservation
   - verify or run existing R2 archive preflight/verify/upload if available
   - estimate storage/payload impact where possible
5. If preflight and preservation checks pass, load and normalize that month into the dev database.
6. After each month, validate:
   - source file records
   - import batch records
   - raw row counts
   - normalized trade record counts
   - parser warnings/errors
   - source provenance links
   - code-table decoding coverage
   - payload retention state
   - local/R2 source archive status
   - product-facing period discovery
   - representative `/explorer` query
7. Continue to the next month only if validation passes and no stop condition is met.
8. At the end, run typecheck and relevant ingestion/search tests.
9. Update `docs/SESSION_HANDOFF.md` with:
   - months attempted
   - months successfully loaded
   - skipped/failed months and reasons
   - counts by period/flow
   - data quality notes
   - storage/payload retention notes
   - local/R2 archive status
   - Explorer/default-period impact
   - next recommended months or blockers

## Constraints

- Do not modify `/` or `/trade-records` UI.
- Do not add product features.
- Do not fake data.
- Do not change public page styling.
- Report all commands run and final validation results.

## Short `/goal` Prompt

```text
Run the long Explorer data-foundation load described in docs/research/EXPLORER_DATA_LOAD_GOAL.md. Follow that document exactly: load as many missing product-facing Aduana months as safely possible toward coverage from 2021-01 through the latest available month, preserve source/R2 provenance, avoid schema changes, stop on any listed risk condition, validate after each month, run final checks, and update docs/SESSION_HANDOFF.md. Do not modify /, /trade-records UI, public page styling, schema, or source data. Report commands run and final validation results.
```
