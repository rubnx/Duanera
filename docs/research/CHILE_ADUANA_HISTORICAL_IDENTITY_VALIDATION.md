# Chile Aduana Historical Identity Validation

Date: 2026-05-27

## Purpose

This document describes the V1 validation pipeline for testing whether pre-anonymization Chile Aduana records can identify post-anonymization importer/exporter correlatives.

The goal is not to publish company names yet. The goal is to measure whether `Posible importador` and `Posible exportador` can reach at least 80% precision for high-confidence matches.

## Implementation

Research script:

```txt
scripts/research/chile_aduana_identity_validation.py
```

Historical acquisition helper:

```txt
scripts/research/chile_aduana_historical_acquisition.py
```

Default output directory:

```txt
data/research/chile-aduana-identity-validation/
```

Generated files:

- `source_inventory.csv`: local official source files from Aduana manifests.
- `field_availability_by_year.csv`: identity field availability by local working file.
- `historical_company_fingerprints.csv`: fingerprints from files with legal names/RUTs.
- `anonymous_id_fingerprints.csv`: fingerprints from files with anonymous correlatives.
- `candidate_matches.csv`: scored candidate matches from named companies to anonymous IDs.
- `review_sample.csv`: manual review queue for top candidate matches.
- `validation_results.csv`: precision summary once manual review fields are filled.
- `run_summary.json`: counts and execution notes.

The acquisition helper writes preserved historical raw-file provenance to:

```txt
data/sources/chile-aduana/datos-gob-cl/manifests/cl_aduana_datos_gob_cl_historical_source_files_manifest.csv
```

## Method

The pipeline separates official facts from inferred identity:

1. Detect whether each local working file has named identity fields, RUT identity fields, anonymous correlative fields, or no usable identity fields.
2. Build historical company fingerprints from named records when available.
3. Build anonymous ID fingerprints from post-anonymization records.
4. Score same-flow historical and anonymous fingerprints using HS/product/geography/logistics overlap.
5. Write candidate matches for manual validation.

Carrier and document-emitter fields are used only as weak evidence. They are never treated as importer/exporter identity.

## Current Local Result

The current local archive contains 2026 datos.gob.cl files, 2023-2026 Aduana.cl operational files, and January historical acquisition samples from 2003, 2010, and 2015.

January 2003, 2010, and 2015 export files were downloaded, checksummed, extracted, and manifest-preserved. Each sampled export month includes the main export file, bultos file, and transport-document file. Example 2015 outputs:

- `cl_aduana_exports_2015_01_raw.rar` -> `cl_aduana_exports_2015_01.txt`
- `cl_aduana_exports_2015_01_bultos_raw.rar` -> `cl_aduana_exports_2015_01_bultos.txt`
- `cl_aduana_exports_2015_01_transport_docs_raw.rar` -> `cl_aduana_exports_2015_01_transport_docs.txt`

The extracted January 2003, 2010, and 2015 export main files have the same inspected identity shape as the 2026 public export files: `NRO_EXPORTADOR` and `NRO_EXPORTADOR_SEC` are present, carrier/document-emitter fields are present, and no exporter legal-name or exporter RUT field was found in the official DUS column layout.

January 2003, 2010, and 2015 import files were downloaded, checksummed, extracted, and manifest-preserved. 2003 is a single RAR; 2010 and 2015 are multipart RARs that require `unar` for reliable extraction. Example 2015 outputs:

```txt
cl_aduana_imports_2015_01_raw.part01.rar ... part05.rar -> cl_aduana_imports_2015_01.txt
```

The extracted January 2010 and 2015 import main files have 178 fields. The extracted January 2003 import main file has 157 fields, so the validation script now truncates inferred headerless columns to the observed field count. Across all three sampled import years, `NUM_UNICO_IMPORTADOR` is present, carrier/document-emitter fields are present, and no importer legal-name or importer RUT field was found.

Latest sampled validation run after this acquisition:

- `source_inventory.csv` includes 1,993 source rows.
- `field_availability_by_year.csv` includes 33 local working-file inspections.
- `anonymous_id_fingerprints.csv` includes 4,627 sampled anonymous fingerprints.
- `historical_company_fingerprints.csv` is still empty.
- `candidate_matches.csv` is still empty.

Therefore the pipeline can currently build anonymous fingerprints, but it still cannot build historical named fingerprints. The locally extracted January 2003, 2010, and 2015 import/export samples do not contain importer/exporter legal-name or RUT fields under the inspected official public layouts.

## Usage

Run:

```bash
python3 scripts/research/chile_aduana_identity_validation.py --include-ckan
```

For quick parser/scoring validation against a row sample:

```bash
python3 scripts/research/chile_aduana_identity_validation.py --include-ckan --max-rows-per-file 5000
```

After adding pre-2016 named files, rerun the full command without `--max-rows-per-file`. Then manually review `review_sample.csv` by filling:

- `review_status`
- `reviewed_identity_correct`
- `reviewer_notes`

The script can then be rerun or extended to summarize reviewed precision from the completed review file.

Current command run during implementation:

```bash
python3 scripts/research/chile_aduana_identity_validation.py --include-ckan --max-rows-per-file 5000
```

Current output status:

- `source_inventory.csv` includes 1,993 rows from local manifests plus datos.gob.cl CKAN resource inventory.
- `field_availability_by_year.csv` includes 33 local working-file inspections.
- `anonymous_id_fingerprints.csv` includes 4,627 sampled anonymous fingerprints.
- `historical_company_fingerprints.csv` is empty because no local pre-2016 named files have been found yet.
- `candidate_matches.csv` is empty for the same reason.

Historical acquisition commands used for the current January samples:

```bash
python3 scripts/research/chile_aduana_historical_acquisition.py --flow import --year 2003 --month 01
python3 scripts/research/chile_aduana_historical_acquisition.py --flow export --year 2003 --month 01
python3 scripts/research/chile_aduana_historical_acquisition.py --flow import --year 2010 --month 01
python3 scripts/research/chile_aduana_historical_acquisition.py --flow export --year 2010 --month 01
python3 scripts/research/chile_aduana_historical_acquisition.py --flow export --year 2015 --month 01
python3 scripts/research/chile_aduana_historical_acquisition.py --flow import --year 2015 --month 01
```

All commands completed. `unar` is required for multipart RAR extraction. The downloader now forces HTTP/1.1, retries transient failures, and resumes partial `.download` files because datos.gob.cl dropped one 2003 import transfer midway during acquisition.

Verification commands:

```bash
python3 -m unittest scripts/research/test_chile_aduana_historical_acquisition.py scripts/research/test_chile_aduana_identity_validation.py
python3 -m py_compile scripts/research/chile_aduana_historical_acquisition.py scripts/research/test_chile_aduana_historical_acquisition.py scripts/research/chile_aduana_identity_validation.py scripts/research/test_chile_aduana_identity_validation.py scripts/research/datos_gob_cl_aduana_discovery.py
```

## Precision Rule

Duanera should not claim "80% assurance" until:

- at least 100 importer IDs and 100 exporter IDs have been reviewed, or a smaller sample is explicitly documented as preliminary;
- high-confidence matches have at least 80% reviewer-confirmed precision;
- precision and coverage are reported separately.

## Future Evidence Layers

This V1 intentionally uses official Aduana data only. Future versions may add:

- official business registries;
- CMF, ChileCompra, Diario Oficial, and sector registries;
- company websites;
- paid or licensed company/RUT directories;
- manual analyst confirmations;
- user-submitted corrections.

Each source must remain a separate evidence layer. Inferred identities must not overwrite official Aduana fields.
