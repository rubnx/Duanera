import { config } from "dotenv";

config({ path: ".env.local" });
config();

const { db } = await import("../../src/db/client");
const { searchTradeRecords } = await import("../../src/trade/trade-record-search");

const importRecords = await searchTradeRecords(db, {
  tradeFlow: "import",
  periodFrom: "2026-03",
  periodTo: "2026-03",
  limit: "5",
});

const exportRecords = await searchTradeRecords(db, {
  tradeFlow: "export",
  periodFrom: "2026-03",
  periodTo: "2026-03",
  limit: "5",
});

console.log("Import sample");
console.table(
  importRecords.data.map((record) => ({
    row: record.rawRowNumber,
    hs: record.hsCodeNormalized,
    product: record.productDescriptionRaw,
    importer: record.importerCorrelativeId,
    cifItem: record.itemCifValue,
    source: record.sourceFilename,
  })),
);

console.log("Export sample");
console.table(
  exportRecords.data.map((record) => ({
    row: record.rawRowNumber,
    hs: record.hsCodeNormalized,
    product: record.productDescriptionRaw,
    exporter: record.exporterPrimaryCorrelativeId,
    fobItem: record.itemFobValue,
    source: record.sourceFilename,
  })),
);
