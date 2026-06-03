# Duanera Export and Reporting Roadmap

Date: 2026-06-03

Scope: roadmap only. This document does not approve schema changes, migrations, data loads, production promotion, R2 uploads, raw-row reconstruction, code-table mutation, authentication, billing, ClickHouse, or unbounded exports.

## Current State

`/trade-records` has a controlled CSV export foundation for March and April 2026 dev data.

The current export policy is intentionally narrow:

- CSV only.
- Existing normalized `trade_records` fields only.
- Selected table view controls the exported columns.
- Exact trade flow is required.
- Exact single month is required.
- At least one narrowing product, commercial, geography, logistics, source, or numeric-range filter is required.
- Maximum 500 rows.
- Broad preview requests are blocked before expensive row counts.
- Table pagination params are stripped from export URLs.
- CSV output includes metadata rows, applied filters, identity warning, traceability warning, and formula-safe cell escaping.
- No raw payloads, local paths, R2 keys, bucket URLs, credentials, or legal identity claims are exported.

This is the right MVP baseline. The next work should improve business usefulness without weakening those guardrails.

## Business Gaps

### XLSX vs CSV

CSV is useful for quick download and testing, but business users expect spreadsheet workbooks for repeated analysis. The local DataSur research showed a useful pattern: separate row data, summary, and applied-filter sheets. Duanera should adapt that idea in its own structure, using only Duanera fields and caveats.

Recommended next step: add a bounded XLSX workbook route using the same export policy and row cap as CSV.

### Richer Export Metadata

The CSV metadata is intentionally compact. A workbook can carry richer context without making the row table messy:

- export timestamp
- selected view
- period and trade flow
- applied filters
- row cap
- estimated rows
- exported rows
- source/provenance caveats
- anonymous-correlative warning
- payload-retention caveat
- Duanera field provenance note

### Summary and Report Exports

The app already computes trade-record summary and comparison context. A workbook can include a `Resumen` sheet with existing safe aggregates for the same filtered scope:

- total records
- total item value using flow-aware item value
- declaration FOB total
- quantity and weight totals only where existing summary logic considers them safe
- top countries, customs offices, ports, and HS codes where decoded labels exist

This should reuse existing read-only summary helpers rather than introduce new broad aggregations.

### Per-View Column Selection

The current export follows table view columns. That is good enough for MVP. Manual column selection would be useful, but it adds UI state, validation, and future saved-search implications.

Recommended sequence:

1. Keep table-view-driven columns for CSV/XLSX.
2. Add a read-only column catalog so users can see exactly what each view exports.
3. Add column selection later, after saved searches or user preferences exist.

### Saved-Search Export Presets

The current preset views are URL-only convenience views. Export presets should remain URL-only until auth exists. Persistent saved exports require user/org identity and should wait for auth.

Immediate safe option: let preset URLs flow into CSV/XLSX export using the same policy.

### Larger Async Exports

Larger exports should wait for:

- authentication
- authorization
- billing or usage limits
- production storage policy
- rate limiting
- background job infrastructure
- object-storage output retention policy
- audit logs

Do not increase the sync row cap materially before those decisions exist.

### Audit and Provenance

Exports must keep Duanera's trust model:

- Aduana correlatives are anonymous source identifiers, not legal identities.
- Source filenames are sanitized display names, not local paths or private storage keys.
- Raw payloads remain excluded.
- Reconstructed raw-only fields require a separate reviewed workflow.
- Export metadata should make the filtered scope and field limitations visible.

## Recommended Roadmap

### Immediate Read-Only Work

1. Bounded XLSX workbook export.
   - Same safety policy as CSV.
   - Same 500-row cap.
   - Sheets: `Registros`, `Resumen`, `Filtros y trazabilidad`.
   - Existing normalized table-view fields only.
   - Existing summary helpers only.
   - No raw reconstruction.

2. Export preview enrichment.
   - Show whether CSV and XLSX are available.
   - Show exported row count vs estimated rows.
   - Show sheet/column counts.
   - Show why a workbook is blocked.

3. Export column catalog.
   - Document columns per table view in code and UI.
   - Keep labels Spanish-first.
   - Mark anonymous-correlative and provenance columns explicitly.

4. Export smoke CLI or test helper.
   - Verify representative safe import/export CSV and XLSX routes.
   - Verify broad exports stay blocked.
   - Verify no raw payload/storage fields leak.

### Future Auth/Billing-Dependent Work

1. Larger async exports.
2. Persistent export history.
3. Saved export presets per user or organization.
4. Download links stored in private object storage.
5. Export quotas, rate limits, and audit logs.
6. Admin controls for export permissions.

### Future Schema/Model-Dependent Work

1. Normalized logistics/payment/package fields if product users need them in exports.
2. Optional source-only operational context after controlled row reconstruction exists.
3. Possible identity evidence exports only after a separate reviewed identity-evidence model exists.
4. ClickHouse-backed export/report workloads only if Postgres becomes insufficient.

## Recommended Next Implementation

Build a bounded XLSX export/report workbook for `/trade-records` using the existing CSV export policy.

Why this is the best next step:

- It is valuable to business users.
- It matches the DataSur lesson without copying DataSur.
- It remains read-only.
- It can reuse existing normalized fields and summary helpers.
- It does not require schema changes, auth, billing, R2, ClickHouse, or raw reconstruction.
- It gives Duanera a stronger export/report story before loading many more months.

Keep the row cap at 500 until auth, billing, rate limits, and production export policy exist.
