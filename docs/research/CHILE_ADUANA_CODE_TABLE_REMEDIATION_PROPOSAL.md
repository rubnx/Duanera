# Chile Aduana Code-Table Remediation Proposal

Date prepared: 2026-06-01
Latest evidence update: 2026-06-02

Scope: March and April 2026 dev data. This note records evidence and the reviewed dev-only code-table remediations for the `/data-quality/load-readiness` code-table blocker. It does not approve a schema change, new trade-data load, migration, pruning pass, R2 upload, production promotion, or unrelated code-table mutation.

## Summary

The former load-readiness no-go signal was correctly narrowed to dictionary gaps, not parser failure or data loss. After the reviewed dev-only remediations, the code-table blocker is resolved in Neon dev and load-readiness is now `review-first`.

- Aduana code `56` appears in 1,327 March+April 2026 trade records: 958 import records and 369 export records. The current workbook-backed `chile_aduana:aduanas` dictionary did not decode it, but the live Aduana Anexo 51 page provides exact official evidence: `ARAUCANÍA 56`, and dev now has the reviewed code-table row.
- Nonzero port gaps were small but commercially visible: 61 import disembark-port records and 24 export embark-port records. A 2026-06-01 evidence pass found official Anexo 51-11 update evidence for the nonzero port gaps, and a reviewed dev-only remediation inserted the 11 verified `chile_aduana:puertos` rows.
- April 2026 added port code `825` as a high-priority relevant-port gap: 1 import record and 1 export record. BCN Resolución Exenta 2222 evidence confirms `825` as Aeródromo La Araucanía, and dev now has the reviewed code-table row.
- DUS export port code `0` and transport code `0` remain source-special/null style values and should not be treated as dictionary gaps.
- DIN import `grossWeightItem` remains an expected source limitation: March 2026 DIN has `TOT_PESO` total gross weight, but no confirmed item-level gross-weight field.
- Import `MONEDA` had 11 medium-priority March+April undecoded values (`141`, `145`, `147`, `149`, `157`). The live Aduana Anexo 51-20 page gives exact official labels, and dev now has the reviewed currency rows.

## Evidence Classes

Use these classes before any future mutation:

| Class | Meaning | Allowed next action |
| --- | --- | --- |
| Official label found | Exact code-to-label mapping is found in a trusted current official code table or equivalent Aduana reference. | Prepare a reviewed code-table seed/backfill plan. |
| Workbook missing/stale | March records use a code absent from the currently seeded workbook-backed table. | Find newer official dictionary evidence or document as source limitation. |
| Raw glosa only | The official row-level DUS source includes a glosa for the code, but the seeded dictionary lacks the code. | Use as candidate evidence; require manual review before mutating code tables. |
| Source-special/current-source code | The code represents a null/special source value in context, not a normal lookup gap. | Keep excluded from actionable gap counts. |
| Needs manual official evidence | Transactional context suggests a label, but no exact trusted mapping was found. | Do not mutate. Gather official dictionary/source proof. |

## Current March+April 2026 Gaps

| Field | Codes | Affected records | Evidence status | Recommendation |
| --- | --- | ---: | --- | --- |
| Aduana import/export | `56` | 1,327 total | Remediated in dev from official label evidence | `scripts/remediation/aduana-evidence-code-remediation.ts` inserted the reviewed `chile_aduana:aduanas` row with official Anexo 51-1 provenance metadata. |
| Import disembark port | `817`, `818`, `819`, `820`, `822`, `823`, `824`, `826` | 61 total | Remediated in dev from official label evidence | DIN records do not carry port glosas for these fields. `scripts/remediation/aduana-port-code-remediation.ts` inserted reviewed `chile_aduana:puertos` rows with official Anexo 51-11 update provenance metadata. |
| Export embark port | `225`, `817`, `821`, `827` | 24 | Remediated in dev from official label evidence | DUS raw records include `PASO GUANACO SONSO`, `PUERTO CABO FROWARD`, `ESPERANZA`, and `T.GNELES NORTE`; official Anexo 51-11 update notices confirm the exact mappings, and dev now decodes these port rows. |
| Import/export relevant port | `825` | 2 total | Remediated in dev from official label evidence | `scripts/remediation/aduana-evidence-code-remediation.ts` inserted the reviewed `chile_aduana:puertos` row with official Anexo 51-11 provenance metadata. April export raw glosa also shows `AE.LA ARAUCANIA`, but the reviewed label comes from Anexo 51-11 evidence. |
| Export embark/disembark and transport special code | `0` | 3,132 export embark-port records; 4,602 transport records in the broad March count | Source-special/current-source code | Keep classified as source-special/null. It is often seen with service-style exports and absent glosas. |
| Import currency | `141`, `145`, `147`, `149`, `157` | 11 | Remediated in dev from official label evidence | `scripts/remediation/aduana-evidence-code-remediation.ts` inserted the reviewed `chile_aduana:moneda` rows. Labels come from Anexo 51-20 currency evidence only, not country, port, or operation-code tables. |

## Official Port Evidence Found

The current Aduana workbook downloaded from `tablas_de_codigos.xlsx` still hashes to `9a06201c5b1450851ff11188457876f0ed29ac60817af2832e3d16fc972c9376`, matching the local 2026-05-26 archived workbook. It still omits the March gap codes below as `chile_aduana:puertos` code-value rows. The evidence is therefore not "already seeded"; it is official Anexo 51-11 update evidence that should feed a reviewed dictionary remediation.

| Code | Proposed label | March 2026 impact | Evidence source | Confidence |
| --- | --- | ---: | --- | --- |
| `225` | Paso Guanaco Sonso | 1 export embark record | Resolución Exenta 3194, published 2020-11-19, adds Paso Guanaco Sonso to Anexo 51-11 with code 225. | High: exact official code-to-label extract. |
| `817` | Puerto Cabo Froward | 15 import disembark records; 3 export embark records | Resolución Exenta 477, published 2021-03-02, adds Puerto Cabo Froward to Anexo 51-11 with code 817. | High: exact official code-to-label extract. |
| `818` | Muelle Huachipato | 4 import disembark records | Resolución Exenta 2424, published 2021-10-26, adds Muelle Huachipato to Anexo 51-11 with code 818. | High: exact official code-to-label extract. |
| `819` | Terminal Marítimo Escuadrón | 8 import disembark records | Resolución Exenta 2424, published 2021-10-26, adds Terminal Marítimo Escuadrón to Anexo 51-11 with code 819. | High: exact official code-to-label extract. |
| `820` | Terminal Portuario Terquim | 15 import disembark records | Resolución Exenta 2424, published 2021-10-26, adds Terminal Portuario Terquim to Anexo 51-11 with code 820. | High: exact official code-to-label extract. |
| `821` | Terminal Muelle Mecanizado Esperanza | 4 export embark records | Resolución Exenta 356, published 2022-02-15, adds Terminal Muelle Mecanizado Esperanza to Anexo 51-11 with code 821. | High: exact official code-to-label extract. |
| `822` | Terminal Marítimo Enaex | 2 import disembark records | Resolución Exenta 870, published 2022-04-08, adds Terminal Marítimo Enaex to Anexo 51-11 with code 822. | High: exact official code-to-label extract. |
| `823` | Terminal Marítimo Oxiquim | 10 import disembark records | Resolución Exenta 1242, published 2022-05-23, adds Terminal Marítimo Oxiquim to Anexo 51-11 with code 823. | High: exact official code-to-label extract. |
| `824` | Paso Buta Mallin | 6 import disembark records | Resolución Exenta 2222, published 2022-08-26, adds Paso Buta Mallin to Anexo 51-11 with code 824. | High: exact official code-to-label extract. |
| `826` | Estación de Medición Recinto | 1 import disembark record | Resolución Exenta 2222, published 2022-08-26, adds Estación de Medición Recinto to Anexo 51-11 with code 826. | High: exact official code-to-label extract. |
| `827` | Terminal Gráneles del Norte | 16 export embark records | Resolución Exenta 2800, published 2022-11-04, creates/habilitates code 827 for Terminal Gráneles del Norte and leaves without effect Resolución Exenta 1244. | High: exact official code-to-label extract and explicit replacement context. |

Total evidence-backed port impact: 85 March 2026 relevant-port records. Export code `0` remains excluded because it is source-special/null style context, not a nonzero dictionary row.

Important cross-table caveat: local seeded `chile_aduana:puertos` already contains port codes `141`, `145`, and `147` for Miami, Palm Beach, and Columbres. That does not decode import `MONEDA` values `141`, `145`, or `147`; those codes remain unresolved in `chile_aduana:moneda`.

## Official Aduana/Currency Evidence Found

The 2026-06-02 evidence pass found exact official evidence for the remaining March+April high-priority code-table blockers and the visible medium-priority currency gaps. This is enough to prepare a separate reviewed remediation, but this pass does not mutate `code_tables`.

| Code table | Code | Proposed label | March+April impact | Evidence source | Confidence |
| --- | --- | --- | ---: | --- | --- |
| `chile_aduana:aduanas` | `56` | Araucanía | 958 import records; 369 export records | Live Aduana Anexo 51-1 lists `ARAUCANÍA 56` and references Resolución N° 5.330 of 2025. | High: exact official code-to-label row. |
| `chile_aduana:puertos` | `825` | Aeródromo La Araucanía | 1 import disembark-port record; 1 export embark-port record | BCN/Ley Chile Resolución Exenta 2222 says Anexo 51-11 adds Aeródromo La Araucanía code 825. April DUS raw glosa also shows `AE.LA ARAUCANIA`. | High: exact official code-to-label extract plus transactional raw glosa support. |
| `chile_aduana:moneda` | `141` | Zloty | 4 import records | Live Aduana Anexo 51-20 lists code 141 as Zloty, abbreviation Zloty PL, country Polonia. | High: exact official code-to-label row. |
| `chile_aduana:moneda` | `145` | Baht tailandés | 2 import records | Live Aduana Anexo 51-20 lists code 145 as Baht Tailandés, abbreviation Baht TH, country Tailandia. | High: exact official code-to-label row. |
| `chile_aduana:moneda` | `147` | Ringgit | 2 import records | Live Aduana Anexo 51-20 lists code 147 as Ringgit, abbreviation Ringgit MY, country Malasia. | High: exact official code-to-label row. |
| `chile_aduana:moneda` | `149` | Rupia Indonesia | 2 import records | Live Aduana Anexo 51-20 lists code 149 as Rupia Indonesia, abbreviation Rupia ID, country Indonesia. | High: exact official code-to-label row. |
| `chile_aduana:moneda` | `157` | Leu rumano | 1 import record | Live Aduana Anexo 51-20 lists code 157 as Leu Rumano, abbreviation Leu RO, country Rumania. | High: exact official code-to-label row. |

Recommended mutation scope for a future reviewed pass:

- Insert/update only these seven rows: Aduana `56`, port `825`, and currency `141`, `145`, `147`, `149`, `157`.
- Set `review_status = reviewed_official_update`.
- Store provenance metadata with the evidence URL, evidence date, source table (`Anexo 51-1`, `Anexo 51-11`, or `Anexo 51-20`), and the local baseline workbook hash `9a06201c5b1450851ff11188457876f0ed29ac60817af2832e3d16fc972c9376`.
- Keep the mutation dev-only, idempotent, dry-run by default, and guarded by explicit confirmation.
- Do not include source-special DUS code `0`, cargo-type `S`, or any cross-table lookalike code in the same remediation.

## Dev Remediation Applied

The reviewed port-only remediation has been applied to Neon dev.

- Script: `scripts/remediation/aduana-port-code-remediation.ts`.
- Package command: `npm run db:remediate:aduana-ports`.
- Guardrails: script requires `DUANERA_DB_TARGET=dev`; apply mode additionally requires `--apply` and `ADUANA_PORT_REMEDIATION_CONFIRM=apply`.
- Rows inserted: 11 under `chile_aduana:puertos`.
- Review status: `reviewed_official_update`.
- Metadata marker: `metadata.remediation_id = chile_aduana_ports_anexo_51_11_2026_06_01`.
- Idempotency check: a follow-up dry-run returned 0 inserts, 0 updates, and 11 noops.

Verification after apply:

- Import disembark-port high-priority row: `recordsWithUndecodedCode` changed from 61 to 0.
- Export embark-port high-priority row: `recordsWithUndecodedCode` changed from 24 to 0.
- Code-table summary high-priority gaps changed from 4 to 2.
- Code-table summary records with undecoded codes changed from 5,944 to 5,859.
- `/data-quality/load-readiness` remains `no-go` because Aduana code `56` is still a high-priority unresolved dictionary gap.

Do not include newly reviewed gaps in the old 2026-06-01 port remediation. They are handled by the separate 2026-06-02 evidence-code remediation:

- `chile_aduana:aduanas` code `56`: expected impact up to 1,327 decoded March+April records if a new reviewed remediation is applied.
- `chile_aduana:puertos` code `825`: expected impact 2 decoded April records if a new reviewed remediation is applied.
- `chile_aduana:moneda` codes `141`, `145`, `147`, `149`, `157`: expected impact 11 decoded March+April import records if a new reviewed remediation is applied.

## Dev Evidence-Code Remediation Applied

The reviewed Aduana/currency evidence-code remediation has been applied to Neon dev.

- Script: `scripts/remediation/aduana-evidence-code-remediation.ts`.
- Package command: `npm run db:remediate:aduana-evidence-codes`.
- Guardrails: script requires `DUANERA_DB_TARGET=dev`; apply mode additionally requires `--apply` and `ADUANA_EVIDENCE_CODE_REMEDIATION_CONFIRM=apply`.
- Dry-run before apply: 7 inserts, 0 updates, 0 noops.
- Rows inserted: 7 total:
  - `chile_aduana:aduanas` code `56` -> `Araucanía`.
  - `chile_aduana:puertos` code `825` -> `Aeródromo La Araucanía`.
  - `chile_aduana:moneda` codes `141`, `145`, `147`, `149`, and `157`.
- Review status: `reviewed_official_update`.
- Metadata marker: `metadata.remediation_id = chile_aduana_evidence_codes_anexo_51_2026_06_02`.
- Idempotency check: a follow-up dry-run returned 0 inserts, 0 updates, and 7 noops.

Verification after apply:

- March 2026 `/data-quality/code-tables`: 0 high-priority gaps, 0 medium-priority gaps, 2 low-priority source-special gaps, and 5,207 records with low-priority undecoded source values.
- April 2026 `/data-quality/code-tables`: 0 high-priority gaps, 0 medium-priority gaps, 2 low-priority source-special gaps, and 4,726 records with low-priority undecoded source values.
- March+April `/data-quality/code-tables`: 0 high-priority gaps, 0 medium-priority gaps, 2 low-priority source-special gaps, and 9,933 records with low-priority undecoded source values.
- `/data-quality/load-readiness` now returns `review-first` for March 2026, April 2026, and March+April, with 2 ready areas, 5 review areas, and 0 blocked areas.
- Remaining low-priority undecoded values are export disembark port `0` and export cargo type `S`; both are preserved as source-special/source-limitation signals, not evidence-backed code-table blockers.

Rollback/reseed strategy:

- Keep the mutation deterministic and scoped by `code_table_key`, code value, and provenance metadata so a rollback can delete only rows inserted by this remediation.
- Do not rewrite or reseed the full workbook-backed dictionary unless the official workbook itself is updated and archived.
- Preserve the 2026-05-26 workbook as the baseline source and store legal-update provenance separately in metadata for the added rows.

## Readiness Impact

The evidence-backed code-table blocker is now remediated in Neon dev. `/data-quality/load-readiness` moved from `no-go` to `review-first` for March 2026, April 2026, and the combined March+April range. It remains conservative because payload retention, performance guardrails, field-mapping caveats, and source-special export values are still review items before loading another dev month.

## Evidence Notes

Local read-only queries checked:

- `/data-quality/load-readiness`
- `/data-quality/code-tables`
- March 2026 `trade_records` and linked `raw_trade_rows`
- Current workbook-backed code-table data under `data/sources/chile-aduana/aduana-cl/code-tables/working/`
- Current datos.gob.cl data dictionary workbooks under `data/sources/chile-aduana/datos-gob-cl/references/working/`

External official Aduana material checked:

- Aduana Resolución Exenta 6915 (2014) includes a historical Aduana/pass table, but it maps Liucura/Pino Hachado to code `64`, so it does not validate March 2026 code `56`.
- Aduana statistical compendia mention port/place names such as Puerto Cabo Froward, Paso Guanaco Sonso, Terminal Gráneles del Norte, and Pino Hachado/Liucura, but those documents are not exact current code-to-label dictionaries for the March 2026 row-level codes.
- BCN/Ley Chile and Diario Oficial extracts for Aduana Anexo 51-11 updates provide exact port-code evidence for the March 2026 nonzero port gaps. These are suitable for a reviewed remediation proposal, not an automatic mutation.
- Decreto 354 Exento (2025) and a vLex index entry for Resolución 5330 (2025) show official Aduana de La Araucanía activity and Anexo 1/51 updates. A later 2026-06-02 check of live Aduana Anexo 51 found the exact `56` -> `ARAUCANÍA` row.
- BCN/Ley Chile Resolución Exenta 2222 provides exact Anexo 51-11 evidence for port `825` -> `Aeródromo La Araucanía`.
- Live Aduana Anexo 51-20 provides exact currency evidence for `141`, `145`, `147`, `149`, and `157`.

Relevant official URLs:

- https://www.aduana.cl/resolucion-exenta-n-6915-05-12-2014/aduana/2014-12-05/162630.html
- https://www.aduana.cl/aduana/site/docs/20181217/20181217125337/compendio_comex_marzo_2021_2022_final.pdf
- https://www.aduana.cl/aduana/site/docs/20181217/20181217125337/compendio_comex_diciembre_2021_2022_final_v06022023.pdf
- https://www.bcn.cl/leychile/navegar?idNorma=1151885
- https://www.bcn.cl/leychile/navegar?idNorma=1156469
- https://www.bcn.cl/leychile/navegar?i=1167006&f=2021-10-26
- https://www.diariooficial.interior.gob.cl/publicaciones/2022/02/15/43179/01/2086306.pdf
- https://www.diariooficial.interior.gob.cl/publicaciones/2022/04/08/43224/01/2111321.pdf
- https://www.bcn.cl/leychile/navegar?idNorma=1176404
- https://www.bcn.cl/leychile/navegar?f=2022-08-26&i=1180469
- https://www.bcn.cl/leychile/navegar?idNorma=1183791&idVersion=2022-11-04
- https://www.bcn.cl/leychile/navegar?idNorma=1219265
- https://vlex.cl/source/30890/c/resolucion
- https://www.aduana.cl/compendio-de-normas-anexo-51-b/aduana/2009-11-19/163937.html

## Next Step

Review and commit the evidence-code remediation helper and docs. After that, focus on the remaining `review-first` items before May: performance guardrails, payload/storage policy, and source-special export caveat wording. Do not infer any extra labels from transactional context, raw glosas, or cross-table code collisions, and keep export source-special code `0` excluded from actionable code-table gaps.
