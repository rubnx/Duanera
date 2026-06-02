import assert from "node:assert/strict";
import test from "node:test";

import {
  parseManifestInteger,
  parseManifestMonth,
  parseSourceFileManifest,
  periodDate,
  selectedRawFilenamesFromEnv,
} from "./source-file-manifest";

const manifestHeader = [
  "source_domain",
  "source_page_url",
  "resource_download_url",
  "country",
  "trade_flow",
  "source_category",
  "year",
  "month",
  "period",
  "original_filename",
  "normalized_raw_filename",
  "raw_path",
  "raw_file_role",
  "raw_file_format",
  "raw_file_size",
  "raw_checksum_sha256",
  "normalized_working_filenames",
  "working_paths",
  "working_file_formats",
  "downloaded_at",
  "notes",
];

function manifestCsv(columns = manifestHeader): string {
  const values = columns.map((column) => {
    if (column === "source_domain") {
      return "datos.gob.cl";
    }
    if (column === "country") {
      return "CL";
    }
    if (column === "year") {
      return "2026";
    }
    if (column === "month") {
      return "03";
    }
    if (column === "normalized_raw_filename") {
      return "cl_aduana_imports_2026_03_raw.rar";
    }

    return "unknown";
  });

  return `${columns.join(",")}\n${values.join(",")}\n`;
}

test("parses manifest integers strictly", () => {
  assert.equal(parseManifestInteger({ fieldName: "year", value: "2026" }), 2026);
  assert.equal(parseManifestInteger({ fieldName: "raw_file_size", value: " 123 " }), 123);
  assert.equal(parseManifestInteger({ fieldName: "year", value: "" }), null);
  assert.equal(parseManifestInteger({ fieldName: "year", value: "unknown" }), null);

  assert.throws(
    () => parseManifestInteger({ fieldName: "year", value: "2026x" }),
    /year must be an integer/,
  );
  assert.throws(
    () => parseManifestInteger({ fieldName: "raw_file_size", value: "1.5" }),
    /raw_file_size must be an integer/,
  );
});

test("validates manifest months", () => {
  assert.equal(parseManifestMonth("03"), 3);
  assert.equal(parseManifestMonth("unknown"), null);

  assert.throws(() => parseManifestMonth("0"), /month must be between 1 and 12/);
  assert.throws(() => parseManifestMonth("13"), /month must be between 1 and 12/);
  assert.throws(() => parseManifestMonth("03x"), /month must be an integer/);
});

test("formats source manifest period boundaries", () => {
  assert.equal(periodDate(2026, 3, "start"), "2026-03-01");
  assert.equal(periodDate(2026, 3, "end"), "2026-03-31");
  assert.equal(periodDate(2026, null, "start"), "2026-01-01");
  assert.equal(periodDate(2026, null, "end"), "2026-12-31");
  assert.equal(periodDate(null, null, "start"), null);
});

test("parses source manifest rows with required string columns", () => {
  const rows = parseSourceFileManifest(manifestCsv());

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.source_domain, "datos.gob.cl");
  assert.equal(rows[0]?.country, "CL");
  assert.equal(rows[0]?.normalized_raw_filename, "cl_aduana_imports_2026_03_raw.rar");
});

test("rejects source manifest rows missing required columns", () => {
  const columns = manifestHeader.filter((column) => column !== "raw_checksum_sha256");

  assert.throws(
    () => parseSourceFileManifest(manifestCsv(columns)),
    /missing string column raw_checksum_sha256/,
  );
});

test("selects default or explicit source manifest raw filenames", () => {
  assert.deepEqual(
    [...selectedRawFilenamesFromEnv("")].sort(),
    [
      "cl_aduana_code_tables_2026_05_26_raw.xlsx",
      "cl_aduana_exports_2026_03_raw.rar",
      "cl_aduana_imports_2026_03_raw.rar",
    ],
  );

  assert.deepEqual(
    [...selectedRawFilenamesFromEnv(
      " cl_aduana_imports_2026_04_raw.rar,cl_aduana_exports_2026_04_raw.rar ",
    )].sort(),
    [
      "cl_aduana_exports_2026_04_raw.rar",
      "cl_aduana_imports_2026_04_raw.rar",
    ],
  );
});
