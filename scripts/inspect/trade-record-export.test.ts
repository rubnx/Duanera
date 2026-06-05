import assert from "node:assert/strict";
import { describe, it } from "node:test";

import ExcelJS from "exceljs";

import {
  buildTradeRecordExportCsv,
  buildTradeRecordExportHref,
  createTradeRecordExportPlan,
  csvSafeCell,
  hasTradeRecordExportExactPeriod,
  hasTradeRecordExportNarrowingFilter,
  hasTradeRecordExportPeriodScope,
  sanitizeTradeRecordExportInput,
  spreadsheetSafeText,
  tradeRecordExportColumnDefinitionsForPlan,
  tradeRecordExportColumnsForView,
  tradeRecordExportIdentityWarning,
  tradeRecordExportRowCap,
} from "../../src/trade/trade-record-export";
import {
  buildTradeRecordExportXlsx,
  tradeRecordExportXlsxContentType,
  tradeRecordExportXlsxFileName,
} from "../../src/trade/trade-record-export-xlsx";
import type {
  TradeRecordFilters,
  TradeRecordIntelligenceSummary,
} from "../../src/trade/trade-records";
import { tradeRecordTableViewIds } from "../../src/trade/trade-record-table-views";

const safeFilters: TradeRecordFilters = {
  tradeFlow: "import",
  periodFrom: "2026-04",
  periodTo: "2026-04",
  hsCodePrefix: "2204",
};

const safeExportFilters: TradeRecordFilters = {
  tradeFlow: "export",
  periodFrom: "2026-04",
  periodTo: "2026-04",
  hsCodePrefix: "2204",
};

function asExcelJsBuffer(buffer: Buffer) {
  return buffer as unknown as Parameters<ExcelJS.Workbook["xlsx"]["load"]>[0];
}

const summary: TradeRecordIntelligenceSummary = {
  totals: {
    records: 2,
    operations: 1,
    anonymousParticipants: 1,
    itemValue: "1000",
    declarationFobValue: "900",
    quantity: "20",
    quantityUnitCode: "10",
    quantityUnitIsMixed: false,
    grossWeightItem: "100",
    grossWeightTotal: "120",
    currencyCode: "13",
    currencyIsMixed: false,
  },
  rankings: {
    countries: [
      {
        code: "336",
        labelRaw: "PERU",
        records: 2,
        totalItemValue: "1000",
      },
    ],
    customsOffices: [
      {
        code: "48",
        labelRaw: null,
        records: 2,
        totalItemValue: "1000",
      },
    ],
    ports: [
      {
        code: "901",
        labelRaw: "SAN ANTONIO",
        records: 2,
        totalItemValue: "1000",
      },
    ],
    hsCodes: [
      {
        code: "2204",
        labelRaw: null,
        records: 2,
        totalItemValue: "1000",
      },
    ],
    transportModes: [
      {
        code: "1",
        labelRaw: null,
        records: 2,
        totalItemValue: "1000",
      },
    ],
    participants: [
      {
        code: "123",
        labelRaw: null,
        records: 2,
        totalItemValue: "1000",
      },
    ],
  },
};

describe("trade record export policy", () => {
  it("allows exact-month narrowed exports within the row cap", () => {
    const plan = createTradeRecordExportPlan({
      filters: safeFilters,
      totalRows: tradeRecordExportRowCap,
      view: "commercial",
    });

    assert.equal(plan.allowed, true);
    assert.equal(plan.estimatedRows, tradeRecordExportRowCap);
    assert.equal(plan.fileName, "duanera-registros-import-2026-04-commercial.csv");
    assert.equal(
      plan.columns.length,
      tradeRecordExportColumnsForView("commercial").length,
    );
    assert.equal(plan.availableColumns.length, plan.columns.length);
    assert.deepEqual(
      plan.warnings.map((warning) => warning.code),
      [],
    );
    assert.ok(plan.caveats.includes(tradeRecordExportIdentityWarning));
  });

  it("treats multi-country filters as export narrowing filters", () => {
    const filters: TradeRecordFilters = {
      tradeFlow: "import",
      periodFrom: "2026-04",
      periodTo: "2026-04",
      originCountryCode: "156",
      originCountryCodes: ["156", "356"],
    };
    const plan = createTradeRecordExportPlan({
      filters,
      totalRows: 100,
      view: "commercial",
    });

    assert.equal(plan.allowed, true);
    assert.equal(hasTradeRecordExportNarrowingFilter(filters), true);
    assert.ok(plan.appliedFilters.includes("País origen: 156, 356"));
  });

  it("treats logistics party filters as export narrowing filters", () => {
    const filters: TradeRecordFilters = {
      tradeFlow: "import",
      periodFrom: "2026-04",
      periodTo: "2026-04",
      logisticsPartyId: "11111111-1111-4111-8111-111111111111",
      logisticsRole: "carrier",
    };
    const plan = createTradeRecordExportPlan({
      filters,
      totalRows: 25,
      view: "logistics",
    });

    assert.equal(plan.allowed, true);
    assert.equal(hasTradeRecordExportNarrowingFilter(filters), true);
    assert.deepEqual(
      plan.warnings.map((warning) => warning.code),
      [],
    );
  });

  it("treats logistics role filters as export narrowing filters", () => {
    const filters: TradeRecordFilters = {
      tradeFlow: "import",
      periodFrom: "2026-04",
      periodTo: "2026-04",
      logisticsRole: "carrier",
    };
    const plan = createTradeRecordExportPlan({
      filters,
      totalRows: 25,
      view: "logistics",
    });

    assert.equal(plan.allowed, true);
    assert.equal(hasTradeRecordExportNarrowingFilter(filters), true);
    assert.deepEqual(
      plan.warnings.map((warning) => warning.code),
      [],
    );
  });

  it("allows narrowed multi-month exports within the row cap", () => {
    const filters: TradeRecordFilters = {
      tradeFlow: "import",
      periodFrom: "2025-11",
      periodTo: "2026-04",
      hsCodePrefix: "8471",
      importerCorrelativeId: "601",
      originCountryCode: "336",
      originCountryCodes: ["336", "317"],
    };

    const plan = createTradeRecordExportPlan({
      filters,
      totalRows: 2,
      view: "commercial",
    });

    assert.equal(plan.allowed, true);
    assert.equal(plan.estimatedRows, 2);
    assert.equal(
      plan.fileName,
      "duanera-registros-import-2025-11-a-2026-04-commercial.csv",
    );
    assert.deepEqual(
      plan.warnings.map((warning) => warning.code),
      [],
    );
    assert.ok(plan.appliedFilters.includes("Periodo: 2025-11 a 2026-04"));
    assert.ok(
      plan.appliedFilters.includes("Importador ID Aduana: 601 (no identidad legal)"),
    );
    assert.ok(plan.appliedFilters.includes("País origen: 336, 317"));
  });

  it("sanitizes repeated multi-country export params without losing values", () => {
    const params = new URLSearchParams();
    params.set("tradeFlow", "import");
    params.set("periodFrom", "2026-04");
    params.set("periodTo", "2026-04");
    params.append("originCountry", "156");
    params.append("originCountry", "356");
    params.set("columns", "period,product");

    assert.deepEqual(sanitizeTradeRecordExportInput(params), {
      tradeFlow: "import",
      periodFrom: "2026-04",
      periodTo: "2026-04",
      originCountry: "156,356",
      columns: "year,month,product",
    });
  });

  it("blocks broad exports even when flow and period are present", () => {
    const plan = createTradeRecordExportPlan({
      filters: {
        tradeFlow: "export",
        periodFrom: "2026-04",
        periodTo: "2026-04",
      },
      totalRows: 100,
      view: "logistics",
    });

    assert.equal(plan.allowed, false);
    assert.deepEqual(
      plan.warnings.map((warning) => warning.code),
      ["broad_query"],
    );
  });

  it("supports blocked preview plans without counting broad result sets", () => {
    const plan = createTradeRecordExportPlan({
      filters: {
        tradeFlow: "export",
        periodFrom: "2026-04",
        periodTo: "2026-04",
      },
      totalRows: null,
      view: "logistics",
    });

    assert.equal(plan.allowed, false);
    assert.equal(plan.estimatedRows, null);
    assert.deepEqual(
      plan.warnings.map((warning) => warning.code),
      ["broad_query"],
    );
  });

  it("blocks range exports above the row cap", () => {
    const plan = createTradeRecordExportPlan({
      filters: {
        tradeFlow: "import",
        periodFrom: "2026-03",
        periodTo: "2026-04",
        hsCodePrefix: "2204",
      },
      totalRows: tradeRecordExportRowCap + 1,
      view: "commercial",
    });

    assert.equal(plan.allowed, false);
    assert.deepEqual(
      plan.warnings.map((warning) => warning.code),
      ["row_cap_exceeded"],
    );
  });

  it("blocks exports without a bounded period scope", () => {
    const plan = createTradeRecordExportPlan({
      filters: {
        tradeFlow: "import",
        hsCodePrefix: "2204",
      },
      totalRows: 10,
      view: "commercial",
    });

    assert.equal(plan.allowed, false);
    assert.deepEqual(
      plan.warnings.map((warning) => warning.code),
      ["missing_period"],
    );
  });

  it("recognizes exact period and narrowing filters separately", () => {
    assert.equal(hasTradeRecordExportExactPeriod(safeFilters), true);
    assert.equal(hasTradeRecordExportPeriodScope(safeFilters), true);
    assert.equal(hasTradeRecordExportNarrowingFilter(safeFilters), true);
    assert.equal(
      hasTradeRecordExportExactPeriod({
        tradeFlow: "import",
        periodFrom: "2026-03",
        periodTo: "2026-04",
      }),
      false,
    );
    assert.equal(
      hasTradeRecordExportPeriodScope({
        tradeFlow: "import",
        periodFrom: "2026-03",
        periodTo: "2026-04",
      }),
      true,
    );
    assert.equal(
      hasTradeRecordExportPeriodScope({
        tradeFlow: "import",
        periodFrom: "2026-03",
      }),
      false,
    );
    assert.equal(
      hasTradeRecordExportNarrowingFilter({
        tradeFlow: "import",
        periodFrom: "2026-04",
        periodTo: "2026-04",
      }),
      false,
    );
  });
});

describe("trade record export columns and links", () => {
  it("keeps export column keys unique per table view", () => {
    for (const view of tradeRecordTableViewIds) {
      const keys = tradeRecordExportColumnsForView(view).map((column) => column.key);

      assert.deepEqual(
        keys,
        [...new Set(keys)],
        `${view} export columns should not contain duplicate keys`,
      );
    }
  });

  it("maps every table view to view-specific CSV columns", () => {
    const commercial = tradeRecordExportColumnsForView("commercial").map(
      (column) => column.key,
    );
    const values = tradeRecordExportColumnsForView("values").map(
      (column) => column.key,
    );
    const logistics = tradeRecordExportColumnsForView("logistics").map(
      (column) => column.key,
    );
    const provenance = tradeRecordExportColumnsForView("provenance").map(
      (column) => column.key,
    );

    assert.ok(commercial.includes("item_value"));
    assert.ok(commercial.includes("participant_correlative"));
    assert.ok(commercial.includes("year"));
    assert.ok(commercial.includes("month"));
    assert.ok(commercial.includes("acceptance_date"));
    assert.equal(commercial.includes("period"), false);
    assert.ok(values.includes("freight_value"));
    assert.ok(values.includes("unit_price_value"));
    assert.ok(values.includes("acceptance_date"));
    assert.ok(logistics.includes("transport_company"));
    assert.ok(logistics.includes("transport_document_issuer"));
    assert.ok(logistics.includes("payment_form"));
    assert.ok(logistics.includes("sale_clause"));
    assert.ok(logistics.includes("package_type"));
    assert.ok(logistics.includes("package_count"));
    assert.ok(logistics.includes("manifest_number"));
    assert.ok(logistics.includes("transport_document_number"));
    assert.ok(provenance.includes("source_file_id"));
    assert.ok(provenance.includes("payload_retention_mode"));
    assert.ok(provenance.includes("acceptance_date"));
  });

  it("uses Aduana-style spreadsheet labels for import exports", () => {
    const plan = createTradeRecordExportPlan({
      filters: safeFilters,
      totalRows: 2,
      view: "commercial",
    });
    const labels = plan.columns.map((column) => column.label);

    assert.ok(labels.includes("Año"));
    assert.ok(labels.includes("Mes"));
    assert.ok(labels.includes("Fecha de aceptación"));
    assert.ok(labels.includes("Número de aceptación"));
    assert.ok(labels.includes("Ítem declaración"));
    assert.ok(labels.includes("ID importador Aduana"));
    assert.ok(labels.includes("País origen"));
    assert.ok(labels.includes("Puerto desembarque"));
    assert.ok(labels.includes("US$ CIF"));
    assert.equal(labels.includes("Periodo"), false);
    assert.equal(labels.includes("País relevante"), false);
    assert.equal(labels.includes("Puerto relevante"), false);
    assert.equal(labels.includes("RUT probable importador"), false);
    assert.equal(labels.includes("Probable importador"), false);
  });

  it("uses flow-aware Aduana-style spreadsheet labels for export exports", () => {
    const plan = createTradeRecordExportPlan({
      filters: safeExportFilters,
      totalRows: 2,
      view: "commercial",
    });
    const labels = plan.columns.map((column) => column.label);

    assert.ok(labels.includes("ID exportador Aduana"));
    assert.ok(labels.includes("País destino"));
    assert.ok(labels.includes("Puerto embarque"));
    assert.ok(labels.includes("US$ FOB"));
    assert.equal(labels.includes("ID importador Aduana"), false);
    assert.equal(labels.includes("País origen"), false);
    assert.equal(labels.includes("Puerto desembarque"), false);
    assert.equal(labels.includes("RUT probable exportador"), false);
    assert.equal(labels.includes("Probable exportador"), false);
  });

  it("uses public original wording for traceability columns", () => {
    const labels = tradeRecordExportColumnsForView("provenance").map(
      (column) => column.label,
    );

    assert.ok(labels.includes("Archivo original"));
    assert.ok(labels.includes("ID archivo original"));
    assert.ok(labels.includes("Fila original"));
    assert.ok(labels.includes("Retención del original"));
    assert.equal(labels.includes("Archivo fuente"), false);
    assert.equal(labels.includes("Fila cruda"), false);
    assert.equal(labels.includes("Modo payload"), false);
  });

  it("selects only valid requested columns in view order", () => {
    const plan = createTradeRecordExportPlan({
      filters: safeFilters,
      selectedColumnKeys: ["product", "unknown_column", "period", "hs_code"],
      totalRows: 2,
      view: "commercial",
    });

    assert.equal(plan.allowed, true);
    assert.deepEqual(
      plan.columns.map((column) => column.key),
      ["year", "month", "hs_code", "product"],
    );
    assert.equal(plan.appliedSearchParams.columns, "year,month,hs_code,product");
    assert.deepEqual(
      tradeRecordExportColumnDefinitionsForPlan(plan).map((column) => column.key),
      ["year", "month", "hs_code", "product"],
    );
    assert.deepEqual(
      tradeRecordExportColumnDefinitionsForPlan(plan).map((column) => column.label),
      ["Año", "Mes", "Partida arancelaria", "Producto"],
    );
  });

  it("blocks explicit export requests with no valid selected columns", () => {
    const plan = createTradeRecordExportPlan({
      filters: safeFilters,
      selectedColumnKeys: ["unknown_column"],
      totalRows: 2,
      view: "commercial",
    });

    assert.equal(plan.allowed, false);
    assert.deepEqual(plan.columns, []);
    assert.deepEqual(
      plan.warnings.map((warning) => warning.code),
      ["missing_columns"],
    );
  });

  it("strips table pagination params from export routes", () => {
    const params = new URLSearchParams({
      tradeFlow: "import",
      periodFrom: "2026-04",
      periodTo: "2026-04",
      hsCodePrefix: "2204",
      view: "product",
      columns: "period,product",
      limit: "25",
      offset: "50",
      after: "cursor",
    });

    const clean = sanitizeTradeRecordExportInput(params);
    const href = buildTradeRecordExportHref(params, "/api/trade-records/export-preview");

    assert.equal(clean.limit, undefined);
    assert.equal(clean.offset, undefined);
    assert.equal(clean.after, undefined);
    assert.equal(clean.columns, "year,month,product");
    assert.equal(
      href,
      "/api/trade-records/export-preview?tradeFlow=import&periodFrom=2026-04&periodTo=2026-04&hsCodePrefix=2204&view=product&columns=year%2Cmonth%2Cproduct",
    );
  });
});

describe("trade record CSV safety", () => {
  it("quotes cells and neutralizes spreadsheet formulas", () => {
    assert.equal(spreadsheetSafeText("normal"), "normal");
    assert.equal(spreadsheetSafeText("=IMPORTXML(A1)"), "'=IMPORTXML(A1)");
    assert.equal(spreadsheetSafeText("+SUM(1,1)"), "'+SUM(1,1)");
    assert.equal(spreadsheetSafeText(" -10"), "' -10");
    assert.equal(spreadsheetSafeText("@cmd"), "'@cmd");
    assert.equal(csvSafeCell("normal"), '"normal"');
    assert.equal(csvSafeCell('a "quoted" value'), '"a ""quoted"" value"');
    assert.equal(csvSafeCell("=IMPORTXML(A1)"), "\"'=IMPORTXML(A1)\"");
    assert.equal(csvSafeCell("+SUM(1,1)"), "\"'+SUM(1,1)\"");
    assert.equal(csvSafeCell(" -10"), "\"' -10\"");
    assert.equal(csvSafeCell("@cmd"), "\"'@cmd\"");
  });

  it("writes metadata and headers even for an empty safe row set", () => {
    const plan = createTradeRecordExportPlan({
      filters: safeFilters,
      totalRows: 1,
      view: "product",
    });
    const csv = buildTradeRecordExportCsv({ plan, rows: [] });

    assert.ok(csv.startsWith("\ufeff"));
    assert.match(csv, /"Duanera exportación CSV"/);
    assert.match(csv, /"Advertencia identidad"/);
    assert.match(csv, /"Producto"/);
    assert.match(csv, /"ID importador Aduana"/);
  });

  it("writes only selected columns when a plan has column choices", () => {
    const plan = createTradeRecordExportPlan({
      filters: safeFilters,
      selectedColumnKeys: ["period", "product"],
      totalRows: 1,
      view: "product",
    });
    const csv = buildTradeRecordExportCsv({ plan, rows: [] });

    assert.match(csv, /"Columnas","Año \| Mes \| Producto"/);
    assert.match(csv, /"Año","Mes","Producto"/);
    assert.doesNotMatch(csv, /"Periodo"/);
    assert.doesNotMatch(csv, /"Texto producto fuente exacto"/);
    assert.doesNotMatch(csv, /"ID importador Aduana"/);
  });
});

describe("trade record XLSX export", () => {
  it("derives XLSX file names and content type from the CSV export plan", () => {
    const plan = createTradeRecordExportPlan({
      filters: safeFilters,
      totalRows: 2,
      view: "commercial",
    });

    assert.equal(
      tradeRecordExportXlsxFileName(plan),
      "duanera-registros-import-2026-04-commercial.xlsx",
    );
    assert.equal(
      tradeRecordExportXlsxContentType(),
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  });

  it("builds a bounded workbook with records, summary, and traceability sheets", async () => {
    const plan = createTradeRecordExportPlan({
      filters: safeFilters,
      totalRows: 2,
      view: "product",
    });
    const buffer = await buildTradeRecordExportXlsx({
      filters: safeFilters,
      plan,
      rows: [],
      summary,
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(asExcelJsBuffer(buffer));

    assert.deepEqual(
      workbook.worksheets.map((sheet) => sheet.name),
      ["Registros", "Resumen", "Filtros y trazabilidad"],
    );

    const records = workbook.getWorksheet("Registros");
    const summarySheet = workbook.getWorksheet("Resumen");
    const traceability = workbook.getWorksheet("Filtros y trazabilidad");
    assert.ok(records);
    assert.ok(summarySheet);
    assert.ok(traceability);

    const headers = (records.getRow(1).values as Array<unknown>).join(" | ");
    assert.match(headers, /Producto/);
    assert.match(headers, /ID importador Aduana/);
    assert.equal(summarySheet.getCell("A1").value, "Resumen del resultado");
    assert.equal(traceability.getCell("A2").value, "Archivo XLSX");
    assert.equal(
      traceability.getCell("B2").value,
      "duanera-registros-import-2026-04-product.xlsx",
    );
  });

  it("uses selected columns in the records and traceability sheets", async () => {
    const plan = createTradeRecordExportPlan({
      filters: safeFilters,
      selectedColumnKeys: ["period", "product"],
      totalRows: 2,
      view: "product",
    });
    const buffer = await buildTradeRecordExportXlsx({
      filters: safeFilters,
      plan,
      rows: [],
      summary,
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(asExcelJsBuffer(buffer));

    const records = workbook.getWorksheet("Registros");
    const traceability = workbook.getWorksheet("Filtros y trazabilidad");
    assert.ok(records);
    assert.ok(traceability);

    const headers = (records.getRow(1).values as Array<unknown>).join(" | ");
    assert.match(headers, /Año/);
    assert.match(headers, /Mes/);
    assert.match(headers, /Producto/);
    assert.doesNotMatch(headers, /Periodo/);
    assert.doesNotMatch(headers, /ID importador Aduana/);
    assert.equal(traceability.getCell("B7").value, "Año | Mes | Producto");
  });

  it("keeps XLSX headers and metadata free of raw payload and storage fields", async () => {
    const plan = createTradeRecordExportPlan({
      filters: safeFilters,
      totalRows: 2,
      view: "provenance",
    });
    const buffer = await buildTradeRecordExportXlsx({
      filters: safeFilters,
      plan,
      rows: [],
      summary,
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(asExcelJsBuffer(buffer));
    const allSheetText = workbook.worksheets
      .flatMap((sheet) =>
        sheet.getSheetValues().flatMap((row) =>
          Array.isArray(row) ? row.map((cell) => String(cell ?? "")) : [],
        ),
      )
      .join(" | ");

    assert.doesNotMatch(
      allSheetText,
      /raw_text|raw_values|storageBucket|storageKey|workingStorageKey/i,
    );
    assert.doesNotMatch(allSheetText, /r2\.dev|credential|secret/i);
    assert.match(allSheetText, /no son RUT|identidad legal/i);
  });
});
