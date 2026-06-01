# Chile Aduana Code-Table Remediation Proposal

Date prepared: 2026-06-01

Scope: March 2026 dev data only. This note is read-only evidence for the remaining `/data-quality/load-readiness` code-table blocker. It does not approve a schema change, data load, migration, pruning pass, R2 upload, or code-table mutation.

## Summary

The current load-readiness no-go signal is correctly narrowed to evidence-backed dictionary gaps, not parser failure or data loss.

- Aduana code `56` appears in 644 March 2026 trade records: 501 import records and 143 export records. The current workbook-backed `chile_aduana:aduanas` dictionary does not decode it.
- Nonzero port gaps are small but commercially visible: 61 import disembark-port records and 24 export embark-port records.
- DUS export port code `0` and transport code `0` remain source-special/null style values and should not be treated as dictionary gaps.
- DIN import `grossWeightItem` remains an expected source limitation: March 2026 DIN has `TOT_PESO` total gross weight, but no confirmed item-level gross-weight field.
- Import `MONEDA` has 8 medium-priority undecoded values (`141`, `145`, `147`) that need separate evidence before currency decoding changes.

## Evidence Classes

Use these classes before any future mutation:

| Class | Meaning | Allowed next action |
| --- | --- | --- |
| Official label found | Exact code-to-label mapping is found in a trusted current official code table or equivalent Aduana reference. | Prepare a reviewed code-table seed/backfill plan. |
| Workbook missing/stale | March records use a code absent from the currently seeded workbook-backed table. | Find newer official dictionary evidence or document as source limitation. |
| Raw glosa only | The official row-level DUS source includes a glosa for the code, but the seeded dictionary lacks the code. | Use as candidate evidence; require manual review before mutating code tables. |
| Source-special/current-source code | The code represents a null/special source value in context, not a normal lookup gap. | Keep excluded from actionable gap counts. |
| Needs manual official evidence | Transactional context suggests a label, but no exact trusted mapping was found. | Do not mutate. Gather official dictionary/source proof. |

## Current March 2026 Gaps

| Field | Codes | Affected records | Evidence status | Recommendation |
| --- | --- | ---: | --- | --- |
| Aduana import/export | `56` | 644 total | Needs manual official evidence | Do not decode yet. Find exact current Aduana code-table evidence for aduana `56`. Transactional records often pair export code `56` with raw embark glosa `PINO HACHADO(LIUCURA`, but an older official Aduana resolution maps Liucura/Pino Hachado to code `64`, not `56`, so this is not safe to mutate. |
| Import disembark port | `817`, `819`, `820`, `823`, `824` | 54 shown in top codes; 61 total in service rollup | Workbook missing/stale | DIN records do not carry port glosas for these fields. Do not infer labels from export rows or adjacent code ranges. Find official current port table evidence. |
| Export embark port | `225`, `817`, `821`, `827` | 24 | Raw glosa only | DUS raw records include `PASO GUANACO SONSO`, `PUERTO CABO FROWARD`, `ESPERANZA`, and `T.GNELES NORTE`. Treat as candidate labels, not final dictionary rows, until an official code-table source confirms exact code mappings. |
| Export embark/disembark and transport special code | `0` | 3,132 export embark-port records; 4,602 transport records in the broad March count | Source-special/current-source code | Keep classified as source-special/null. It is often seen with service-style exports and absent glosas. |
| Import currency | `141`, `145`, `147` | 8 | Needs manual official evidence | The values are present in raw `MONEDA`, but the current `Moneda` workbook sheet did not confirm them as currency labels. Do not borrow labels from country or operation-code tables. |

## Candidate Mutation Plan, Not Yet Approved

No code-table mutation is recommended yet.

If a future pass finds exact official evidence, use this shape:

1. Add or update only the affected `code_values` rows under the existing `code_table_key`.
2. Store source provenance in code-value metadata: source file id, workbook or public Aduana reference, sheet/section, observed date, and confidence.
3. Re-run `/data-quality/code-tables` and `/data-quality/load-readiness`.
4. Verify record counts before/after:
   - `chile_aduana:aduanas` code `56`: expected impact up to 644 decoded records.
   - `chile_aduana:puertos` codes `817`, `819`, `820`, `821`, `823`, `824`, `827`, `225`: expected impact up to 85 decoded relevant-port records across import/export.
   - `chile_aduana:moneda` codes `141`, `145`, `147`: expected impact 8 decoded import records if confirmed.
5. Keep a rollback path by making the change as a deterministic seed/backfill script that can remove only the newly inserted reviewed rows.

## Readiness Impact

If official evidence confirms and decodes the high-priority aduana and port gaps, `/data-quality/load-readiness` should move away from the current code-table blocker. It may still remain `review-first` because payload retention, performance guardrails, field-mapping caveats, and medium-priority dictionary gaps are intentionally conservative before loading another dev month.

## Evidence Notes

Local read-only queries checked:

- `/data-quality/load-readiness`
- `/data-quality/code-tables`
- March 2026 `trade_records` and linked `raw_trade_rows`
- Current workbook-backed code-table data under `data/sources/chile-aduana/aduana-cl/code-tables/working/`
- Current datos.gob.cl data dictionary workbooks under `data/sources/chile-aduana/datos-gob-cl/references/working/`

External official Aduana material checked:

- Aduana Resolucion Exenta 6915 (2014) includes a historical Aduana/pass table, but it maps Liucura/Pino Hachado to code `64`, so it does not validate March 2026 code `56`.
- Aduana statistical compendia mention port/place names such as Puerto Cabo Froward, Paso Guanaco Sonso, Terminal Graneles del Norte, and Pino Hachado/Liucura, but those documents are not exact current code-to-label dictionaries for the March 2026 row-level codes.

Relevant official URLs:

- https://www.aduana.cl/resolucion-exenta-n-6915-05-12-2014/aduana/2014-12-05/162630.html
- https://www.aduana.cl/aduana/site/docs/20181217/20181217125337/compendio_comex_marzo_2021_2022_final.pdf
- https://www.aduana.cl/aduana/site/docs/20181217/20181217125337/compendio_comex_diciembre_2021_2022_final_v06022023.pdf

## Next Step

Before mutating dictionaries, run a dedicated official-code-table acquisition pass:

- Search for a newer Aduana Annex 51 or equivalent official lookup source covering aduanas, ports, and currencies.
- Preserve the source file in the local source archive and R2 plan before use.
- Compare exact code mappings against March 2026 gaps.
- Prepare a deterministic, reviewed seed/backfill script only after exact official evidence is documented.
