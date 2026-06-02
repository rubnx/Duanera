import test from "node:test";
import assert from "node:assert/strict";

import {
  buildArchivePreflightReport,
  type ArchivePreflightReport,
} from "./r2-archive-preflight";
import type { ArchiveUploadCandidate, ArchiveUploadPlan } from "./r2-upload-plan";

function candidate(
  overrides: Partial<ArchiveUploadCandidate>,
): ArchiveUploadCandidate {
  return {
    checksumMatchesManifest: true,
    classification: "official_source_raw",
    country: "CL",
    exclusionReason: null,
    fileRole: "compressed_source_file",
    includeInUpload: true,
    localPath:
      "data/sources/chile-aduana/datos-gob-cl/imports/raw/cl_aduana_imports_2026_04_raw.rar",
    manifestSha256: "a".repeat(64),
    metadata: { sha256: "a".repeat(64) },
    period: "2026-04",
    r2Bucket: "duanera-source-archive",
    r2Key:
      "sources/cl/aduana/datos-gob-cl/imports/2026/04/raw/cl_aduana_imports_2026_04_raw.rar",
    sha256: "a".repeat(64),
    sizeBytes: 10,
    sourceDomain: "datos.gob.cl",
    sourceKind: "official_source",
    sourceManifestPath: "data/sources/chile-aduana/datos-gob-cl/manifests/source.csv",
    tradeFlow: "import",
    ...overrides,
  };
}

function plan(objects: ArchiveUploadCandidate[]): ArchiveUploadPlan {
  return {
    bucket: "duanera-source-archive",
    dataDir: "data",
    errors: [],
    generatedAt: "2026-06-02T00:00:00.000Z",
    mode: "dry-run",
    objects,
    policy: {
      canonicalChecksum: "sha256",
      firstUploadPriority: "official_source_raw",
      provider: "Cloudflare R2",
      publicAccess: "disabled",
    },
    summary: {
      byClassification: {},
      excludedFiles: 0,
      totalBytes: objects.reduce((sum, object) => sum + object.sizeBytes, 0),
      totalFiles: objects.length,
      uploadBytes: objects
        .filter((object) => object.includeInUpload)
        .reduce((sum, object) => sum + object.sizeBytes, 0),
      uploadCandidates: objects.filter((object) => object.includeInUpload).length,
    },
    uploadAttempted: false,
    version: 1,
    warnings: [],
  };
}

function access(): ArchivePreflightReport["access"] {
  return {
    bucket: "duanera-source-archive",
    isTruncated: false,
    keyCountKnown: 1,
    objectSampleCount: 1,
  };
}

test("compares archive plan objects with remote R2 state", () => {
  const archived = candidate({ localPath: "data/sources/archive/raw/a.rar", r2Key: "sources/a.rar" });
  const missing = candidate({
    localPath: "data/sources/chile-aduana/datos-gob-cl/exports/raw/cl_aduana_exports_2026_04_raw.rar",
    r2Key: "sources/cl/aduana/datos-gob-cl/exports/2026/04/raw/cl_aduana_exports_2026_04_raw.rar",
    sizeBytes: 20,
  });
  const mismatch = candidate({
    localPath: "data/sources/archive/raw/c.rar",
    r2Key: "sources/c.rar",
    sizeBytes: 30,
  });
  const skipped = candidate({
    classification: "disposable",
    exclusionReason: "Disposable local file.",
    includeInUpload: false,
    localPath: "data/.DS_Store",
    r2Key: null,
    sizeBytes: 40,
  });

  const report = buildArchivePreflightReport({
    access: access(),
    generatedAt: "2026-06-02T00:00:00.000Z",
    plan: plan([archived, missing, mismatch, skipped]),
    remoteByKey: new Map([
      ["sources/a.rar", { sha256: archived.sha256, sizeBytes: archived.sizeBytes }],
      ["sources/c.rar", { sha256: mismatch.sha256, sizeBytes: 31 }],
    ]),
  });

  assert.equal(report.summary.alreadyArchived, 1);
  assert.equal(report.summary.missing, 1);
  assert.equal(report.summary.remoteMismatches, 1);
  assert.equal(report.summary.skipped, 1);
  assert.equal(report.errors.length, 1);
  assert.match(report.errors[0] ?? "", /remote size or SHA-256 metadata mismatch/);
});

test("generates guarded upload commands only for safe missing batches", () => {
  const raw = candidate({
    classification: "official_source_raw",
    r2Key: "sources/raw.rar",
    sizeBytes: 10,
  });
  const manifest = candidate({
    classification: "source_manifest",
    localPath: "data/sources/chile-aduana/datos-gob-cl/manifests/source.csv",
    r2Key: "manifests/cl/aduana/datos-gob-cl/source.csv",
    sizeBytes: 5,
  });
  const research = candidate({
    classification: "research_evidence",
    localPath: "data/research/private.pdf",
    r2Key: "research/cl/aduana/private.pdf",
    sizeBytes: 7,
  });

  const report = buildArchivePreflightReport({
    access: access(),
    generatedAt: "2026-06-02T00:00:00.000Z",
    plan: plan([raw, manifest, research]),
    remoteByKey: new Map(),
  });

  assert.deepEqual(
    report.uploadCommands.map((command) => command.classification).sort(),
    ["official_source_raw", "source_manifest"],
  );
  assert.match(report.uploadPlanCommand, /npm --silent run archive:r2:plan/);
  assert.match(report.uploadCommands[0]?.command ?? "", /R2_UPLOAD_CONFIRM=upload/);
  assert.match(report.uploadCommands[0]?.command ?? "", /--confirm-upload/);
  assert.equal(report.warnings.length, 1);
  assert.match(report.warnings[0] ?? "", /requires manual review before upload/);
});

test("keeps April 2026 objects visible in the preflight report", () => {
  const april = candidate({});
  const march = candidate({
    localPath:
      "data/sources/chile-aduana/datos-gob-cl/imports/raw/cl_aduana_imports_2026_03_raw.rar",
    period: "2026-03",
    r2Key:
      "sources/cl/aduana/datos-gob-cl/imports/2026/03/raw/cl_aduana_imports_2026_03_raw.rar",
  });

  const report = buildArchivePreflightReport({
    access: access(),
    generatedAt: "2026-06-02T00:00:00.000Z",
    plan: plan([april, march]),
    remoteByKey: new Map([[march.r2Key ?? "", { sha256: march.sha256, sizeBytes: march.sizeBytes }]]),
  });

  assert.equal(report.april2026.planned, 1);
  assert.equal(report.april2026.missing, 1);
  assert.equal(report.april2026.objects[0]?.localPath, april.localPath);
});

test("marks checksum mismatch and unsafe upload candidates as errors", () => {
  const checksumMismatch = candidate({
    checksumMatchesManifest: false,
    localPath: "data/sources/archive/raw/bad.rar",
    r2Key: "sources/bad.rar",
  });
  const unsafe = candidate({
    classification: "unknown",
    localPath: "data/sources/archive/unknown.bin",
    r2Key: "unclassified/sources/archive/unknown.bin",
  });

  const report = buildArchivePreflightReport({
    access: access(),
    generatedAt: "2026-06-02T00:00:00.000Z",
    plan: plan([checksumMismatch, unsafe]),
    remoteByKey: new Map(),
  });

  assert.equal(report.summary.checksumMismatches, 1);
  assert.equal(report.summary.unsafe, 1);
  assert.equal(report.errors.length, 2);
});
