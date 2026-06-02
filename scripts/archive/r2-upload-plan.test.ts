import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import {
  parseArchiveSourceManifestRows,
  repoRelativePath,
  resolveArchiveDataDirPath,
} from "./r2-upload-plan";
import {
  archiveR2KeyFor,
  archiveR2MetadataFor,
  classifyArchivePath,
} from "./r2-upload-policy";

test("resolves archive planner repository paths safely", () => {
  assert.equal(repoRelativePath(path.resolve("package.json")), "package.json");
  assert.throws(
    () => repoRelativePath(path.resolve("..", "outside.txt")),
    /archive planner path must stay inside the repository/,
  );
});

test("limits archive planner data directories to the ignored data archive", () => {
  assert.equal(resolveArchiveDataDirPath("data"), path.resolve("data"));
  assert.equal(resolveArchiveDataDirPath("data/sources"), path.resolve("data/sources"));
  assert.equal(resolveArchiveDataDirPath(path.resolve("data/research")), path.resolve("data/research"));

  assert.throws(
    () => resolveArchiveDataDirPath("."),
    /must be inside the ignored data\/ archive/,
  );
  assert.throws(
    () => resolveArchiveDataDirPath("scripts"),
    /must be inside the ignored data\/ archive/,
  );
  assert.throws(
    () => resolveArchiveDataDirPath(path.resolve("..", "data")),
    /archive planner path must stay inside the repository/,
  );
});

test("parses archive source manifest rows with source manifest provenance", () => {
  const rows = parseArchiveSourceManifestRows(
    "raw_path,raw_checksum_sha256,working_paths\nraw/file.zip,abc,working/file.csv\n",
    "data/sources/chile-aduana/example/manifests/source_manifest.csv",
  );

  assert.deepEqual(rows, [
    {
      __sourceManifestPath: "data/sources/chile-aduana/example/manifests/source_manifest.csv",
      raw_checksum_sha256: "abc",
      raw_path: "raw/file.zip",
      working_paths: "working/file.csv",
    },
  ]);
});

test("classifies Aduana archive paths and builds stable R2 keys", () => {
  const rawPath =
    "data/sources/chile-aduana/datos-gob-cl/imports/2026/03/raw/cl_aduana_imports_2026_03_raw.rar";
  const manifestPath =
    "data/sources/chile-aduana/datos-gob-cl/imports/2026/03/manifests/source_manifest.csv";

  assert.equal(classifyArchivePath(rawPath), "official_source_raw");
  assert.equal(classifyArchivePath(manifestPath), "source_manifest");

  assert.equal(
    archiveR2KeyFor(rawPath, "official_source_raw"),
    "sources/cl/aduana/datos-gob-cl/imports/2026/03/raw/cl_aduana_imports_2026_03_raw.rar",
  );
  assert.equal(
    archiveR2KeyFor(manifestPath, "source_manifest"),
    "manifests/cl/aduana/datos-gob-cl/source_manifest.csv",
  );
  assert.equal(
    archiveR2KeyFor(manifestPath, "source_manifest", undefined, {
      manifestKeyMode: "snapshot",
      sha256: "a".repeat(64),
    }),
    `manifests/cl/aduana/datos-gob-cl/snapshots/source_manifest.csv/${"a".repeat(64)}/source_manifest.csv`,
  );
  assert.throws(
    () => archiveR2KeyFor(manifestPath, "source_manifest", undefined, { manifestKeyMode: "snapshot" }),
    /snapshot source manifest keys require a SHA-256 checksum/,
  );
});

test("builds R2 metadata from archive candidate provenance", () => {
  assert.deepEqual(
    archiveR2MetadataFor({
      country: "CL",
      fileRole: "official_source_file",
      period: "2026-03",
      sha256: "abc",
      sourceDomain: "datos.gob.cl",
      sourceKind: "official_source",
      sourceManifestPath: "data/sources/chile-aduana/example/manifests/source_manifest.csv",
      tradeFlow: "import",
    }),
    {
      country: "CL",
      file_role: "official_source_file",
      manifest_local_path: "data/sources/chile-aduana/example/manifests/source_manifest.csv",
      period: "2026-03",
      sha256: "abc",
      source_domain: "datos.gob.cl",
      source_kind: "official_source",
      trade_flow: "import",
    },
  );
});
