import assert from "node:assert/strict";
import test from "node:test";

import { exportInspectionRow, importInspectionRow } from "./trade-records";

test("formats import inspection rows with flow-aware value fields", () => {
  assert.deepEqual(
    importInspectionRow({
      rawRowNumber: 10,
      hsCodeNormalized: "08081000",
      productDescriptionRaw: "MANZANAS",
      importerCorrelativeId: "123",
      itemCifValue: "1000.50",
      sourceFilename: "imports.rar",
    }),
    {
      row: 10,
      hs: "08081000",
      product: "MANZANAS",
      importer: "123",
      cifItem: "1000.50",
      source: "imports.rar",
    },
  );
});

test("formats export inspection rows with flow-aware value fields", () => {
  assert.deepEqual(
    exportInspectionRow({
      rawRowNumber: 20,
      hsCodeNormalized: "08061000",
      productDescriptionRaw: "UVAS",
      exporterPrimaryCorrelativeId: "456",
      itemFobValue: "2000.75",
      sourceFilename: "exports.rar",
    }),
    {
      row: 20,
      hs: "08061000",
      product: "UVAS",
      exporter: "456",
      fobItem: "2000.75",
      source: "exports.rar",
    },
  );
});
