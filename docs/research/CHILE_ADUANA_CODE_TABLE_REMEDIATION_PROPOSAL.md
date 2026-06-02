# Chile Aduana Code-Table Remediation Proposal

Date prepared: 2026-06-01

Scope: March 2026 dev data only. This note records evidence and the reviewed dev-only port remediation for the remaining `/data-quality/load-readiness` code-table blocker. It does not approve a schema change, new trade-data load, migration, pruning pass, R2 upload, production promotion, or unresolved Aduana/currency code-table mutation.

## Summary

The current load-readiness no-go signal is correctly narrowed to evidence-backed dictionary gaps, not parser failure or data loss.

- Aduana code `56` appears in 644 March 2026 trade records: 501 import records and 143 export records. The current workbook-backed `chile_aduana:aduanas` dictionary does not decode it.
- Nonzero port gaps were small but commercially visible: 61 import disembark-port records and 24 export embark-port records. A 2026-06-01 evidence pass found official Anexo 51-11 update evidence for the nonzero port gaps, and a reviewed dev-only remediation inserted the 11 verified `chile_aduana:puertos` rows.
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
| Import disembark port | `817`, `818`, `819`, `820`, `822`, `823`, `824`, `826` | 61 total | Remediated in dev from official label evidence | DIN records do not carry port glosas for these fields. `scripts/remediation/aduana-port-code-remediation.ts` inserted reviewed `chile_aduana:puertos` rows with official Anexo 51-11 update provenance metadata. |
| Export embark port | `225`, `817`, `821`, `827` | 24 | Remediated in dev from official label evidence | DUS raw records include `PASO GUANACO SONSO`, `PUERTO CABO FROWARD`, `ESPERANZA`, and `T.GNELES NORTE`; official Anexo 51-11 update notices confirm the exact mappings, and dev now decodes these port rows. |
| Export embark/disembark and transport special code | `0` | 3,132 export embark-port records; 4,602 transport records in the broad March count | Source-special/current-source code | Keep classified as source-special/null. It is often seen with service-style exports and absent glosas. |
| Import currency | `141`, `145`, `147` | 8 | Needs manual official evidence | The values are present in raw `MONEDA`, but the current `Moneda` workbook sheet did not confirm them as currency labels. Do not borrow labels from country or operation-code tables. |

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

Do not include unresolved gaps in the same remediation:

- `chile_aduana:aduanas` code `56`: expected impact up to 644 decoded records if exact official evidence is found later.
- `chile_aduana:moneda` codes `141`, `145`, `147`: expected impact 8 decoded import records if exact official currency evidence is found later.

Rollback/reseed strategy:

- Keep the mutation deterministic and scoped by `code_table_key`, code value, and provenance metadata so a rollback can delete only rows inserted by this remediation.
- Do not rewrite or reseed the full workbook-backed dictionary unless the official workbook itself is updated and archived.
- Preserve the 2026-05-26 workbook as the baseline source and store legal-update provenance separately in metadata for the added rows.

## Readiness Impact

The evidence-backed port rows reduce the port portion of the code-table blocker, but `/data-quality/load-readiness` still remains `no-go`. Aduana code `56` is still the largest unresolved high-priority gap, so readiness should remain conservative until exact official aduana-code evidence is acquired or the blocker is explicitly reclassified. It may still remain `review-first` because payload retention, performance guardrails, field-mapping caveats, and medium-priority dictionary gaps are intentionally conservative before loading another dev month.

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
- Decreto 354 Exento (2025) and a vLex index entry for Resolución 5330 (2025) show official Aduana de La Araucanía activity and Anexo 1/51 updates, but they do not provide a visible exact `56` -> label mapping in the inspected public text.

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

## Next Step

Continue with unresolved non-port evidence:

- Acquire exact official evidence for Aduana `56`; do not infer it from transactional context or Pino Hachado/Liucura glosas.
- Acquire exact official currency evidence for import `MONEDA` codes `141`, `145`, and `147`.
- Keep export source-special code `0` excluded from actionable code-table gaps.
- Review whether `/data-quality/load-readiness` should remain `no-go` or be reclassified after the remaining official evidence pass.
