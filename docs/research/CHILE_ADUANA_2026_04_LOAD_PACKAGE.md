# Chile Aduana 2026-04 Load Package

## Purpose

Prepare the next Aduana dev-month candidate before any database load.

This is a read-only package note. It does not authorize schema changes, database
loads, migrations, production promotion, R2 uploads, payload pruning, code-table
mutation, or ClickHouse.

## Candidate Decision

Recommended next candidate: April 2026 DIN/DUS main files from datos.gob.cl.

Why:

- March 2026 is the current loaded MVP month.
- Local `data/` contains January, February, and March 2026 files only.
- The official datos.gob.cl 2026 import/export datasets now list April 2026
  resources, created on 2026-05-28.
- April is the next chronological complete main-file month after March.

Current package state: acquired, preflighted, and loaded into the Neon dev
database. The April raw files are preserved under ignored `data/` raw paths,
extracted working files are present, and the main import/export files loaded and
normalized with 0 parse failures.

## Official Resources To Acquire

Source pages:

- `https://datos.gob.cl/dataset/registro-de-importacion-2026`
- `https://datos.gob.cl/dataset/registro-de-exportacion-2026`

Official CKAN API checks performed on 2026-06-02:

- `https://datos.gob.cl/api/3/action/package_show?id=registro-de-importacion-2026`
- `https://datos.gob.cl/api/3/action/package_show?id=registro-de-exportacion-2026`

Candidate main files:

| Flow | Resource | Format | Size | Resource id | Official download URL |
| --- | --- | ---: | ---: | --- | --- |
| import | Importaciones - abril 2026 | rar | 26,253,905 | `0f0af9b1-9c51-41f8-bafe-f84a1743930d` | `https://datos.gob.cl/dataset/984f4871-8a8e-436d-a77e-0bebe9d8af68/resource/0f0af9b1-9c51-41f8-bafe-f84a1743930d/download/importaciones-abril-2026.rar` |
| export | Exportaciones abril 2026 | rar | 4,949,761 | `3555b797-3489-413d-b0ab-2947a6dad9ae` | `https://datos.gob.cl/dataset/f6a643e7-a2e4-48e4-866e-732c7ceb51f3/resource/3555b797-3489-413d-b0ab-2947a6dad9ae/download/exportaciones-abril-2026.rar` |

Export companion files to preserve now, but not load into `trade_records` until a
separate companion-file design is approved:

| Role | Resource | Format | Size | Resource id | Official download URL |
| --- | --- | ---: | ---: | --- | --- |
| bultos | Exportaciones abril 2026 - Bultos | rar | 349,174 | `09209b40-3c02-4bf3-96fe-87ee2c61c29c` | `https://datos.gob.cl/dataset/f6a643e7-a2e4-48e4-866e-732c7ceb51f3/resource/09209b40-3c02-4bf3-96fe-87ee2c61c29c/download/exportaciones-abril-2026-bultos.rar` |
| transport docs | Exportaciones abril 2026 - Documentos de Transporte | rar | 673,118 | `d9156913-8dfc-45a8-aa1b-512780aec733` | `https://datos.gob.cl/dataset/f6a643e7-a2e4-48e4-866e-732c7ceb51f3/resource/d9156913-8dfc-45a8-aa1b-512780aec733/download/exportaciones-abril-2026-documentos-de-transporte.rar` |

HTTP HEAD checks on 2026-06-02 returned `200` for all four official download
URLs and content lengths matching the CKAN API sizes.

## Local Paths

Raw files:

```txt
data/sources/chile-aduana/datos-gob-cl/imports/raw/cl_aduana_imports_2026_04_raw.rar
data/sources/chile-aduana/datos-gob-cl/exports/raw/cl_aduana_exports_2026_04_raw.rar
data/sources/chile-aduana/datos-gob-cl/exports/raw/cl_aduana_exports_2026_04_bultos_raw.rar
data/sources/chile-aduana/datos-gob-cl/exports/raw/cl_aduana_exports_2026_04_transport_docs_raw.rar
```

Working files expected after extraction:

```txt
data/sources/chile-aduana/datos-gob-cl/imports/working/cl_aduana_imports_2026_04.txt
data/sources/chile-aduana/datos-gob-cl/exports/working/cl_aduana_exports_2026_04.txt
data/sources/chile-aduana/datos-gob-cl/exports/working/cl_aduana_exports_2026_04_bultos.txt
data/sources/chile-aduana/datos-gob-cl/exports/working/cl_aduana_exports_2026_04_transport_docs.txt
```

Do not commit these files. They belong in ignored `data/` and later in private R2
after explicit upload confirmation.

## Acquisition Evidence

Acquisition date: 2026-06-02.

Ignored local evidence updated:

- `data/sources/chile-aduana/datos-gob-cl/manifests/cl_aduana_datos_gob_cl_2026_source_files_manifest.csv`
- `data/sources/chile-aduana/datos-gob-cl/manifests/sha256sums.txt`
- `data/sources/chile-aduana/datos-gob-cl/manifests/cl_aduana_datos_gob_cl_imports_2026_package_show.json`
- `data/sources/chile-aduana/datos-gob-cl/manifests/cl_aduana_datos_gob_cl_exports_2026_package_show.json`
- `data/sources/chile-aduana/datos-gob-cl/manifests/cl_aduana_datos_gob_cl_imports_2026_resources.tsv`
- `data/sources/chile-aduana/datos-gob-cl/manifests/cl_aduana_datos_gob_cl_exports_2026_resources.tsv`

Raw and working checksums:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `cl_aduana_imports_2026_04_raw.rar` | 26,253,905 | `71fe54339540048e10f0be4fe2ed1283bd42d428e5a402ea2efed1152e892940` |
| `cl_aduana_imports_2026_04.txt` | 309,862,242 | `e87724ff85155f2534f91999f9c672e716eb9d6fb84ba8f880eeae4ef728b04b` |
| `cl_aduana_exports_2026_04_raw.rar` | 4,949,761 | `830788dee5d0a26a816fd02d8f11ef4e32e6fcec0a97cca4223d4d8adca455b0` |
| `cl_aduana_exports_2026_04.txt` | 48,370,903 | `72de502b60dcd5aae646cd9fe41e937852cd6767f1cc43841a68e00a0491292e` |
| `cl_aduana_exports_2026_04_bultos_raw.rar` | 349,174 | `7fc21b0851a4b8ae789558caa90e4ec19f90162f56171046d7fe4dfe63f3bdf6` |
| `cl_aduana_exports_2026_04_bultos.txt` | 3,781,752 | `0a027b72dbcb1d4d9b36b9d56043bc603848653bce2d56799ee3c9f48b3319de` |
| `cl_aduana_exports_2026_04_transport_docs_raw.rar` | 673,118 | `06ba396f11cc72d40f215910abf3e98b6688f22c747dae7431916c25a0126365` |
| `cl_aduana_exports_2026_04_transport_docs.txt` | 4,246,398 | `8cf413b16944e9559d0c59de089ebdffb5755a97af10b9ac7a5f9347dc2cf78e` |

## Preflight Results

April acquired-file preflight command:

```bash
npx tsx scripts/ingest/aduana-load-preflight.ts \
  --normalized-raw-filename cl_aduana_imports_2026_04_raw.rar \
  --normalized-raw-filename cl_aduana_exports_2026_04_raw.rar \
  --sample-rows 50 \
  --pretty
```

Result:

- candidates: 2
- overall status: `warning`
- blockers: 0
- import sample: 50/50 parsed, field count `178`, no header detected
- export sample: 50/50 parsed, field count `84`, no header detected
- raw and working SHA-256 checks matched the local source manifest
- known pending code-table-risk codes were not observed in the sample
- warnings are existing coded-field dictionary caveats and the recommendation to
  use `RAW_ROW_PAYLOAD_RETENTION=errors_and_warnings` before any real additional
  dev-month load

March 2026 control preflight command:

```bash
npx tsx scripts/ingest/aduana-load-preflight.ts \
  --normalized-raw-filename cl_aduana_imports_2026_03_raw.rar \
  --normalized-raw-filename cl_aduana_exports_2026_03_raw.rar \
  --sample-rows 25 \
  --pretty
```

Control result:

- candidates: 2
- overall status: `warning`
- blockers: 0
- import sample: 25/25 parsed, field count `178`
- export sample: 25/25 parsed, field count `84`
- raw and working SHA-256 checks matched the local source manifest
- warnings were known coded-field dictionary caveats and payload-retention policy

## Compatibility Assessment

Current parser/model assumptions appear compatible for an April controlled dev
load because acquisition confirmed:

- import main working file samples have 178 semicolon-delimited fields
- export main working file samples have 84 semicolon-delimited fields
- first sampled row is not a header
- parse sample has 0 failed rows
- raw and working sizes/checksums match the updated local source manifest
- source period and flow remain `2026-04`, `import` / `export`

April has completed a controlled dev load using read/write guards,
`DUANERA_DB_TARGET=dev`, and `RAW_ROW_PAYLOAD_RETENTION=errors_and_warnings`.

Load result on 2026-06-02:

- source files inserted in dev: 2 April main files
- import raw rows: 408,027 parsed, 0 failed
- export raw rows: 102,350 parsed, 0 failed
- import trade records: 408,027
- export trade records: 102,350
- orphaned trade records: 0
- duplicate raw links: 0
- parsed raw rows missing trade records: 0
- payload retention: all 510,377 April raw rows are
  `errors_and_warnings` / `pending_post_normalization_prune`
- payload pruning: 0 rows pruned in this pass
- participant stats were repaired from aggregate `trade_records` truth after the
  period-scoped normalizer exposed that current-run in-memory stats were not
  safe for cross-month counts

## Known Risks To Carry Forward

- Aduana code `56` remains unresolved in code-table evidence.
- Import currency codes `141`, `145`, and `147` still need official currency
  evidence before mutation.
- DUS source-special logistics code `0` must remain classified as a source
  special/null value, not an actionable dictionary gap.
- DIN has total gross weight (`TOT_PESO`) but no confirmed item-level gross
  weight field; do not reclassify missing import `grossWeightItem` as a load
  blocker.
- Export companion bultos/transport-doc files should be preserved and checked
  for provenance, but not joined into the normalized trade-record model in this
  pass.
- Anonymous importer/exporter correlatives remain Aduana source identifiers, not
  RUTs, company names, or legal identity verification.

## Post-Load Follow-Up Gate

1. Review and commit the April load script hardening and docs updates.
2. Run a separate dry-run raw-payload pruning review for April successful rows.
3. Re-check `/data-quality` and `/data-quality/load-readiness` now that the dev
   database has March plus April.
4. Do not load May or any additional month until April storage/performance impact
   and pruning readiness are reviewed.
