import { config } from "dotenv";
import { pathToFileURL } from "node:url";

import type { DbClient } from "../../src/db/client";
import { searchTradeRecords } from "../../src/trade/trade-record-search";

type ImportInspectionRecord = {
  rawRowNumber: number | null;
  hsCodeNormalized: string | null;
  productDescriptionRaw: string | null;
  importerCorrelativeId: string | null;
  itemCifValue: string | null;
  sourceFilename: string | null;
};

type ExportInspectionRecord = {
  rawRowNumber: number | null;
  hsCodeNormalized: string | null;
  productDescriptionRaw: string | null;
  exporterPrimaryCorrelativeId: string | null;
  itemFobValue: string | null;
  sourceFilename: string | null;
};

export function importInspectionRow(record: ImportInspectionRecord) {
  return {
    row: record.rawRowNumber,
    hs: record.hsCodeNormalized,
    product: record.productDescriptionRaw,
    importer: record.importerCorrelativeId,
    cifItem: record.itemCifValue,
    source: record.sourceFilename,
  };
}

export function exportInspectionRow(record: ExportInspectionRecord) {
  return {
    row: record.rawRowNumber,
    hs: record.hsCodeNormalized,
    product: record.productDescriptionRaw,
    exporter: record.exporterPrimaryCorrelativeId,
    fobItem: record.itemFobValue,
    source: record.sourceFilename,
  };
}

export async function runTradeRecordInspection(database: DbClient) {
  const importRecords = await searchTradeRecords(database, {
    tradeFlow: "import",
    periodFrom: "2026-03",
    periodTo: "2026-03",
    limit: "5",
  });

  const exportRecords = await searchTradeRecords(database, {
    tradeFlow: "export",
    periodFrom: "2026-03",
    periodTo: "2026-03",
    limit: "5",
  });

  const samples = {
    imports: importRecords.data.map(importInspectionRow),
    exports: exportRecords.data.map(exportInspectionRow),
  };

  process.stdout.write(`${JSON.stringify(samples, null, 2)}\n`);
  return samples;
}

async function main() {
  config({ path: ".env.local" });
  config();

  const { db } = await import("../../src/db/client");
  await runTradeRecordInspection(db);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Trade record inspection failed: ${message}\n`);
    process.exitCode = 1;
  });
}
