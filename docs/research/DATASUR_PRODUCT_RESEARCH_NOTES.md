# DataSur Product Research Notes

Date: 2026-06-02

Scope: local-only review of `docs/research/datasur-research/`. No DataSur scraping, no credential use, no database writes, no schema changes, and no R2 activity.

## Materials Inspected

- `docs/research/datasur-research/screenshots/`: 21 PNG screenshots covering D-Comex search, result summaries, full result table, export modal, saved/history dialogs, profile/contact modal, and Mundo DataSur source catalog pages.
- `docs/research/datasur-research/sample-data/datasur_sample_export.csv`: 111,992 import rows plus report metadata.
- `docs/research/datasur-research/sample-data/datasur_sample_export.xlsx`: workbook with `Datasur`, `Resumen`, and `Filtros aplicados` sheets.

The screenshots and sample files should be treated as competitive/product research only. Do not copy DataSur UI, wording, design, or proprietary structure directly.

## Export Shape Observations

The CSV begins with report metadata before the row table:

- operation: import
- period start/end
- operation count
- record count
- aggregate FOB/CIF totals
- applied filters

The XLSX version separates this into:

- `Datasur`: row-level data
- `Resumen`: operation, period, operation count, record count, aggregate FOB/CIF, origin/company counts
- `Filtros aplicados`: filter audit trail

This is a useful model for future Duanera exports: include row data plus a clear summary and applied-filter audit trail.

## Exported Column Groups

The sample export has 58 columns. Useful groups:

- Time/declaration: day, month, year, customs office, acceptance number, item number, total items.
- Possible identity: probable importer RUT, verifier digit, probable importer.
- Product: HS/tariff code, tariff description, product, brand, variety, additional description.
- Geography: origin country, acquisition country.
- Logistics: transport mode, embark port, disembark port, transport company, transport-company country, cargo type, package type, package count, manifest number/date, transport document number/date, warehouse, warehouse date.
- Commercial values: FOB, freight, insurance, CIF, CIF unit, FOB unit, declaration-level FOB/freight/insurance/CIF, tax, tax USD, IVA.
- Transaction/payment: payment form, purchase/sales clause, operation type, trade agreement.
- Quantity: commercial quantity/unit, physical quantity/unit.
- Condition/context: goods condition, issuer.

In this sample, the probable importer fields are empty for all 111,992 rows. Product/logistics/value fields are strongly populated.

## Identity And Provenance Cautions

DataSur’s own Chile search screen displays a caution that Chile Aduana removed company name and RUT columns from import/export data from August 2016 onward to avoid identifying the responsible party.

The local sample export still includes “probable importer” columns, but they are empty in the sample. Some screenshots show “probable” identity-style columns in the table. Duanera must not assume those values come from public Aduana main files or treat them as verified legal identity.

Implication for Duanera:

- Keep Aduana importer/exporter correlatives as anonymous source identifiers.
- Keep possible company identity as a separate evidence-backed research layer with confidence, review status, and provenance.
- If manifests or other companion files expose shipper/consignee names, model that as separate source evidence, not as verified importer/exporter legal identity.

## Product Lessons For Duanera

DataSur patterns worth adapting in Duanera’s own way:

- A clear search-to-results flow with a visible period, operation, record count, value totals, and origin/company counts.
- Ranked summary views by HS/product, company/participant, country, and comparison group.
- Toggle between summarized rankings and full row table.
- Saved searches and search history.
- Export workflow with format choice, full/custom view choice, and compression option.
- XLSX export with separate data, summary, and filters sheets.
- Country/source catalog that shows available source type and latest available month.

Duanera already supports several of these ideas:

- Period-aware `/trade-records` search.
- Flow-aware values, quantity, weight, country, port, customs, and transport display.
- Decoded lookup filters.
- Active filter summaries.
- Intelligence summary and comparison panels.
- Drilldowns from rankings and rows.
- Source/provenance and trust indicators.
- Internal QA/load-readiness views.

## Duanera Gaps And Opportunities

High-value fields that are present in Aduana raw layouts but are not first-class in `trade_records` today:

- Import transport company: `GNOM_CIA_T`
- Import transport-company country: `CODPAISCIA`
- Import manifest number/date: `NUM_MANIF`, `FEC_MANIF`
- Import transport document number/date: `NUM_CONOC`, `FEC_CONOC`
- Import transport-document issuer: `NOMEMISOR`
- Import payment form: `FORM_PAGO`
- Import purchase/sales clause: `CL_COMPRA`
- Import package totals/types/counts: `TOT_BULTOS`, `TPO_BUL*`, `CANT_BUL*`, `ID_BULTOS`
- Import warehouse/date: `ALMACEN`, `FEC_ALMAC`
- Export transport company and issuer: `NOMBRECIATRANSP`, `NOMBREEMISORDOCTRANSP`
- Export payment/clause: `FORMAPAGO`, `CLAUSULAVENTA`
- Export total packages and canceling document fields: `TOTALBULTOS`, `NUMERODOCTOCANCELA`, `FECHADOCTOCANCELA`
- Product enrichment already partially captured in `productAttributes`, but table/detail views can make brand/variety/attributes easier to scan.

Potential product improvements:

- Add table view presets: compact commercial, full Aduana, logistics, product/HS, values, provenance.
- Add column visibility controls before implementing broad CSV/XLSX export.
- Add a controlled export workflow for filtered results with clear row limits, applied filters, and provenance caveats.
- Add a source-availability catalog that shows loaded months, archived R2 files, preflight state, and source role coverage.
- Add logistics-focused filters and details after deciding which extra fields should be normalized or reconstructed safely.

## Recommended Next Implementation Direction

Before loading many more months, the highest-value next product task is not DataSur-style identity. It is to make Duanera’s result table and export/view workflow more useful for business users while preserving trust boundaries.

Recommended next longer task:

1. Audit which DataSur-inspired logistics/product/payment fields are available in current March+April raw layouts.
2. Determine which can be surfaced read-only from existing normalized fields, which require raw reconstruction, and which would require schema/model changes.
3. Implement only low-risk UI/read-only improvements first:
   - table view presets or column groups
   - better product attributes display
   - clearer logistics/details sections on `/trade-records/[id]`
   - export-readiness plan without exporting unbounded data
4. Stop before any schema/model change and propose it separately with rationale.
