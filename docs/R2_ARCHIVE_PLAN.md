# Cloudflare R2 Archive Plan

## Purpose

Duanera uses Cloudflare R2 as the private archive for official source files, working extracts, source manifests, and internal research evidence.

The repository must not track large source files. The local `data/` directory remains ignored and should be treated as a working copy of the archive, not as durable storage by itself.

## Bucket

Initial bucket:

```txt
duanera-source-archive
```

The bucket must remain private. Do not enable public bucket access, `r2.dev`, or custom-domain access for this archive.

## Object Layout

Use deterministic keys that preserve country, source, source domain, category, period, and file role.

```txt
sources/cl/aduana/datos-gob-cl/imports/2026/03/raw/cl_aduana_imports_2026_03_raw.rar
sources/cl/aduana/datos-gob-cl/imports/2026/03/working/cl_aduana_imports_2026_03.txt
sources/cl/aduana/datos-gob-cl/exports/2026/03/raw/cl_aduana_exports_2026_03_raw.rar
sources/cl/aduana/aduana-cl/code-tables/2026/05/raw/cl_aduana_code_tables_2026_05_26_raw.xlsx
manifests/cl/aduana/datos-gob-cl/cl_aduana_datos_gob_cl_2026_source_files_manifest.csv
manifests/cl/aduana/datos-gob-cl/snapshots/cl_aduana_datos_gob_cl_2026_source_files_manifest.csv/<sha256>/cl_aduana_datos_gob_cl_2026_source_files_manifest.csv
research/cl/aduana/identity-validation/run_summary.json
```

## File Classes

- `official_source_raw`: files under `data/sources/**/raw/`; upload first and preserve indefinitely.
- `working_file`: extracted or copied usable files under `data/sources/**/working/`; upload after raw files if reproducible parsing needs remote working copies.
- `source_manifest`: source manifests, checksums, and source README files; keep small copies in Git and upload to R2.
- `research_evidence`: PDFs, HTML captures, Wayback/CDX JSON, and transparency responses under `data/research/`; keep private.
- `generated_validation`: generated identity-validation CSV/JSON outputs; keep private and label as generated.
- `disposable`: `.DS_Store`, temporary downloads, and local cache files; do not upload.

## Checksums And Metadata

SHA-256 is the canonical integrity check. Do not use ETags as canonical checksums because multipart uploads can make ETags unsuitable for whole-file integrity checks.

R2 custom metadata should be compact and should not replace source manifests:

```txt
country=CL
source_domain=datos.gob.cl
source_kind=official_source
file_role=compressed_source_file
trade_flow=import
period=2026-03
sha256=<hex>
manifest_local_path=data/sources/chile-aduana/datos-gob-cl/manifests/...
```

## Source Manifest Refresh Policy

Official raw source objects are immutable and must never be overwritten. Source manifests and checksum files are also treated as provenance artifacts, but they can legitimately change as new official files are acquired. For example, the local 2026 datos.gob.cl manifests changed after the April 2026 acquisition because April package/resource rows and checksums were added after the earlier R2 upload.

Do not overwrite an existing manifest object when a local manifest changes. Preserve the existing R2 object as a historical snapshot and upload the refreshed local manifest under a content-addressed snapshot key:

```txt
manifests/cl/aduana/{source-domain}/snapshots/{filename}/{sha256}/{filename}
```

The legacy non-snapshot manifest keys remain historical first-upload objects. Duanera does not currently maintain a mutable `latest` manifest pointer in R2; adding one would require a separate reviewed policy because it would intentionally overwrite or update a pointer-like object.

To evaluate refreshed manifests without overwriting existing R2 objects, use snapshot mode:

```bash
npm run archive:r2:preflight -- --manifest-key-mode snapshot --pretty
```

Snapshot mode only changes `source_manifest` keys. Official raw files, working files, research evidence, generated validation outputs, and disposable-file behavior keep the normal archive layout.

## Dry-Run Manifest

Generate a dry-run manifest:

```bash
npm --silent run archive:r2:plan -- --pretty > /tmp/duanera-r2-upload-plan.json
```

For a reviewed source-manifest refresh, generate a snapshot-keyed plan instead:

```bash
npm --silent run archive:r2:plan -- --manifest-key-mode snapshot --pretty > /tmp/duanera-r2-upload-plan.json
```

The command:

- scans the ignored local `data/` directory
- computes byte size and SHA-256 for every file
- proposes R2 keys and metadata
- excludes disposable files
- validates official raw files against source manifests
- does not upload or write files

The command exits non-zero if an official raw file lacks a manifest reference, file role, checksum, proposed R2 key, or has a checksum mismatch.

## Archive Preflight

Use the read-only preflight before any upload batch:

```bash
npm run archive:r2:preflight -- --pretty
```

The command:

- verifies required R2 environment variables without printing secret values
- checks private bucket read/list access
- builds the local upload plan from ignored `data/`
- compares each planned upload object against R2 by object key, byte size, and stored SHA-256 metadata
- groups results by file class: `official_source_raw`, `working_file`, `source_manifest`, `research_evidence`, `generated_validation`, and `disposable`
- highlights April 2026 objects so newly acquired months are visible
- prints the guarded upload commands for safe missing batches
- does not upload, delete, overwrite, mutate metadata, write local files, or touch the database

The preflight exits non-zero if it finds plan errors, checksum mismatches, remote size/SHA mismatches, or unsafe upload candidates. Missing objects are not errors by themselves; they identify what is ready for an explicit upload pass. Private research evidence and generated validation outputs are reported as missing but require manual review before upload.

If legacy preflight reports source-manifest remote mismatches, do not upload over the mismatched keys. Run snapshot preflight and snapshot planning, then upload only the `source_manifest` snapshot objects after review.

If you need a machine-readable report, run the command directly or use npm's silent mode so stdout remains valid JSON:

```bash
npm --silent run archive:r2:preflight -- --pretty > /tmp/duanera-r2-preflight.json
```

## Credential And Bucket Verification

After R2 credentials are stored in `.env.local`, verify bucket access without uploading:

```bash
npm run archive:r2:verify
```

The command checks that required R2 environment variables are present without printing secret values, then performs a read/list-only `ListObjectsV2` request against the private bucket.

Required local environment variables:

```txt
CLOUDFLARE_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET
R2_ENDPOINT
```

## Upload Workflow

The upload script is dry-run by default:

```bash
npm run archive:r2:upload -- --plan-file /tmp/duanera-r2-upload-plan.json
```

By default it selects only `official_source_raw` objects and prints the object count and byte summary that would be uploaded. It verifies bucket access first and does not upload unless both confirmations are present:

```bash
R2_UPLOAD_CONFIRM=upload npm run archive:r2:upload -- \
  --plan-file /tmp/duanera-r2-upload-plan.json \
  --only-classification official_source_raw \
  --confirm-upload
```

Do not run the confirmed command until the dry-run manifest has been reviewed.

The upload command refuses plan files with warnings or errors. During confirmed uploads, existing remote objects are treated as immutable: matching objects are verified and left in place, while mismatched objects stop the run instead of being overwritten.

## Upload Order

When upload work is explicitly requested later:

1. Create the private R2 bucket.
2. Create least-privilege R2 credentials for this archive.
3. Run the dry-run manifest and save a reviewed manifest artifact.
4. Upload `official_source_raw` objects first.
5. Verify remote object size and SHA-256 metadata.
6. Upload source manifests and checksum files.
7. Decide whether to upload all `working_file` objects or regenerate them during ingestion.
8. Upload private research evidence only after confirming access controls.

Do not delete local source files until R2 upload and verification have passed.
