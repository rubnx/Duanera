# DataSur-Informed Duanera UX/Data Plan

Date: 2026-06-02

Scope: local DataSur research only. This plan does not approve scraping, credential use, schema changes, database loads, R2 uploads, code-table mutations, payload pruning, production promotion, or ClickHouse.

## Goal

Use the local DataSur research materials to improve Duanera's trade-record experience without copying DataSur's proprietary UI and without weakening Duanera's provenance and anonymous-identity rules.

DataSur is useful as product research because it shows what business users expect from a trade-data tool: compact tables, value totals, applied filters, logistics fields, downloadable reports, and multiple ways to compare products, countries, ports, and participants. Duanera should adapt the useful patterns in its own design, using only evidence-backed public Aduana data.

## Current Duanera Coverage

Duanera already supports these DataSur-like needs with March and April 2026 dev data:

- Period-aware trade-record search, defaulting to the latest loaded month.
- Import/export flow filters and decoded country, aduana, transport, and port controls.
- Flow-aware value ranges: CIF item for imports and FOB item for exports.
- Quantity and gross-weight filters.
- Active filter summaries.
- Summary totals and ranked breakdowns.
- Commercial comparison groups.
- Drilldown links from summaries and table rows.
- Source, batch, raw-row, parser, payload-retention, and reconstructability provenance.
- Detail pages with flow-aware value sections and raw/pruned payload messaging.

These are strong foundations. The next work should focus on better table/view ergonomics and explicit handling of raw-only logistics context.

## Immediate UI-Only / Read-Only Improvements

These can be implemented with existing normalized fields and service contracts:

1. Add table view modes on `/trade-records`.
   - Commercial view: current default fields, optimized for product, value, quantity, country, logistics, and provenance.
   - Logistics view: emphasize aduana, relevant port, transport mode, cargo type, source/batch, and row traceability.
   - Product/HS view: emphasize HS, source product text, parsed source reference, product attributes where already normalized, and related drilldowns.
   - Provenance view: emphasize source file, batch, parser, payload retention, reconstructability, and raw row number.

2. Keep view modes URL-only.
   - Use a query parameter such as `view=commercial|logistics|product|provenance`.
   - Preserve existing filters, cursor/offset behavior, sort controls, and pagination.
   - Do not introduce saved-search persistence yet.

3. Improve labels around normalized versus source-only fields.
   - Make clear that the table shows first-class normalized Aduana fields.
   - Explain that carrier, manifest, transport document, package, payment, and warehouse context may exist in raw source layouts but is not yet normalized into the main table.
   - Keep anonymous Aduana correlatives labeled as non-identity.

4. Improve detail-page product/logistics context.
   - Keep the current normalized geography/logistics card.
   - Add copy that carrier, manifest, package, payment, and warehouse fields require raw reconstruction or future model work before they can be shown consistently.
   - Do not imply those fields are absent from Aduana; say they are not currently first-class normalized Duanera fields.

## Raw Reconstruction / Detail-Page Opportunities

These are valuable, but should be a separate implementation pass because April successful raw payloads were pruned from Postgres and must be reconstructed from preserved source files when needed.

Candidate fields to expose as "source-only operational context" on `/trade-records/[id]`:

- Transport company.
- Transport-company country.
- Manifest number and date.
- Transport document number, date, and issuer.
- Payment form.
- Purchase/sales clause.
- Package total, package types, and package counts.
- Warehouse and warehouse date.
- Trade agreement.
- Goods condition.
- Taxes or IVA, if product requirements justify them.

Recommended implementation shape:

1. Build a read-only raw reconstruction helper.
   - Input: source file id, raw row id, row number, expected hash, parser layout.
   - Read only from preserved local/R2 source files.
   - Reconstruct one row or a bounded sample.
   - Verify row hash/payload hash before returning source-only fields.
   - Never expose local file paths, R2 keys, or private bucket URLs.

2. Show reconstructed fields only in a clearly labeled detail-page section.
   - Suggested title: `Campos operativos de fuente`.
   - Copy: `Campos reconstruidos desde la fila Aduana preservada; no son identidad legal de importador/exportador.`
   - Keep values read-only and provenance-linked.

3. Do not use reconstructed fields for broad table columns or filters until performance and model decisions are reviewed.

## Future Schema / Model Proposals

These require separate approval because they would change the data model and normalizer behavior:

1. Add normalized optional logistics fields to `trade_records`.
   - `transportCompanyName`
   - `transportCompanyCountryCode`
   - `manifestNumber`
   - `manifestDate`
   - `transportDocumentNumber`
   - `transportDocumentDate`
   - `transportDocumentIssuer`
   - `paymentFormCode`
   - `saleClauseCode`
   - `packageTotal`
   - `packageSummary`
   - `warehouseCode`
   - `warehouseDate`
   - `tradeAgreementCode`
   - `goodsConditionCode`

2. Add tests and backfill strategy.
   - Validate import/export field availability separately.
   - Confirm raw layouts and official dictionaries for decoded labels.
   - Backfill March/April before loading additional months if these become core product fields.

3. Keep possible identity separate.
   - Do not add legal importer/exporter identity fields to `trade_records`.
   - If future manifest or licensed data provides names, model it as evidence with confidence, review status, and provenance.

## Export Workflow Proposal

Duanera should eventually support filtered exports, but not as an unbounded UI query.

Recommended export design:

- Start with CSV only, then XLSX once row limits and memory behavior are proven.
- Require explicit filters and row caps.
- Include an export summary with operation, period, filters, record count, value totals, and provenance caveats.
- Include applied-filter metadata, similar in spirit to the DataSur sample workbook structure but not copied.
- Add a clear identity warning: Aduana correlatives are anonymous source identifiers, not legal company identities.
- Avoid exporting raw payloads by default.
- Consider async export jobs only after auth/permissions and production storage policy are decided.

## Recommended Next Implementation Order

1. Implement `/trade-records` table view modes using existing normalized fields only.
2. Add small detail-page copy clarifying normalized versus source-only logistics fields.
3. Design and test a raw-row reconstruction helper for one-row detail-page use.
4. Add a source-only operational context section on `/trade-records/[id]` after reconstruction is proven.
5. Propose schema/model changes only if users need those fields in filters, sorting, exports, or broad table views.
6. Design controlled CSV export after table view modes settle.

## Guardrails

- Do not copy DataSur UI, wording, screenshots, workbook structure, or proprietary behavior directly.
- Do not weaken Duanera's source/provenance display.
- Do not imply company identity from Aduana main files.
- Do not make raw-only fields look like fully normalized verified facts.
- Do not introduce expensive broad queries for view modes.
- Do not expose local paths, R2 keys, private bucket URLs, or credentials.
