import test from "node:test";
import assert from "node:assert/strict";

import {
  isSourceProvenanceId,
  sourceDisplayFilename,
  sourceFilenameLabel,
  sourcePeriodLabel,
  sourceTradeRecordsHref,
} from "../../src/sources/source-provenance";

test("builds source-filtered trade record links without storage paths", () => {
  const href = sourceTradeRecordsHref({
    sourceFileId: "source-1",
    importBatchId: "batch-1",
  });

  assert.equal(
    href,
    "/trade-records?sourceFileId=source-1&limit=25&importBatchId=batch-1",
  );
  assert.equal(href.includes("storage"), false);
  assert.equal(href.includes("data/sources"), false);
});

test("keeps source-filtered trade links flow-aware when the source flow is known", () => {
  const href = sourceTradeRecordsHref({
    sourceFileId: "source-1",
    importBatchId: "batch-1",
    tradeFlow: "export",
  });

  assert.equal(
    href,
    "/trade-records?sourceFileId=source-1&limit=25&tradeFlow=export&importBatchId=batch-1",
  );
});

test("validates source provenance route ids before database lookup", () => {
  assert.equal(
    isSourceProvenanceId("5f657989-ef41-40a9-9cfd-219d920e5000"),
    true,
  );
  assert.equal(isSourceProvenanceId("not-a-uuid"), false);
  assert.equal(
    isSourceProvenanceId("../../../data/sources/chile-aduana/raw/file.rar"),
    false,
  );
});

test("strips directory segments from displayed source filenames", () => {
  assert.equal(
    sourceFilenameLabel("data/sources/chile-aduana/raw/importaciones-marzo-2026.rar"),
    "importaciones-marzo-2026.rar",
  );
  assert.equal(
    sourceDisplayFilename({
      originalFilename: "C:\\duanera\\sources\\exportaciones-marzo-2026.rar",
      normalizedRawFilename: null,
    }),
    "exportaciones-marzo-2026.rar",
  );
});

test("formats source filename and period labels conservatively", () => {
  assert.equal(
    sourceDisplayFilename({
      originalFilename: "importaciones-marzo-2026.rar",
      normalizedRawFilename: "cl_aduana_imports_2026_03_raw.rar",
    }),
    "cl_aduana_imports_2026_03_raw.rar",
  );

  assert.equal(
    sourceDisplayFilename({
      originalFilename: "tablas_de_codigos.xlsx",
      normalizedRawFilename: null,
    }),
    "tablas_de_codigos.xlsx",
  );

  assert.equal(
    sourcePeriodLabel({
      periodYear: 2026,
      periodMonth: 3,
      periodStart: "2026-03-01",
      periodEnd: "2026-03-31",
    }),
    "2026-03",
  );

  assert.equal(
    sourcePeriodLabel({
      periodYear: null,
      periodMonth: null,
      periodStart: "2026-05-01",
      periodEnd: "2026-05-31",
    }),
    "2026-05-01 a 2026-05-31",
  );

  assert.equal(
    sourcePeriodLabel({
      periodYear: null,
      periodMonth: null,
      periodStart: null,
      periodEnd: null,
    }),
    "No informado",
  );
});
