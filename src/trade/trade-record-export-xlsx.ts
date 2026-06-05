import ExcelJS from "exceljs";

import {
  formatTradeCodeLabel,
  formatTradeDecimal,
  formatTradeSummaryValue,
} from "@/trade/trade-record-format";
import {
  spreadsheetSafeText,
  tradeRecordExportColumnDefinitionsForPlan,
  tradeRecordExportIdentityWarning,
  tradeRecordExportProvenanceWarning,
  type TradeRecordExportPlan,
  type TradeRecordExportRow,
} from "@/trade/trade-record-export";
import {
  tradeRecordSummaryCountryTitle,
  tradeRecordSummaryPortTitle,
} from "@/trade/trade-record-summary-labels";
import type {
  TradeRecordFilters,
  TradeRecordIntelligenceSummary,
  TradeRecordSummaryRank,
} from "@/trade/trade-records";

const workbookMimeType =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function tradeRecordExportXlsxFileName(plan: TradeRecordExportPlan) {
  return plan.fileName.replace(/\.csv$/i, ".xlsx");
}

export function tradeRecordExportXlsxContentType() {
  return workbookMimeType;
}

function styleHeaderRow(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FF111827" } };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE5E7EB" },
  };
  row.alignment = { vertical: "middle", wrapText: true };
}

function styleTitleCell(cell: ExcelJS.Cell) {
  cell.font = { bold: true, size: 14, color: { argb: "FF111827" } };
}

function setSheetDefaults(sheet: ExcelJS.Worksheet) {
  sheet.properties.defaultRowHeight = 18;
  sheet.views = [{ state: "frozen", ySplit: 1 }];
}

function setColumnWidths(sheet: ExcelJS.Worksheet, rows: string[][]) {
  sheet.columns?.forEach((column, index) => {
    const values = rows.map((row) => row[index] ?? "");
    const maxLength = Math.max(
      String(column.header ?? "").length,
      ...values.map((value) => value.length),
    );
    column.width = Math.min(Math.max(maxLength + 2, 12), 48);
  });
}

function addRows(sheet: ExcelJS.Worksheet, rows: string[][]) {
  for (const row of rows) {
    sheet.addRow(row.map((cell) => spreadsheetSafeText(cell)));
  }
}

function summaryValueSuffix(summary: TradeRecordIntelligenceSummary) {
  if (summary.totals.currencyIsMixed) {
    return "moneda mixta";
  }

  return summary.totals.currencyCode ?? undefined;
}

function quantityValue(summary: TradeRecordIntelligenceSummary) {
  if (summary.totals.quantityUnitIsMixed) {
    return "No se suma: múltiples unidades";
  }

  return formatTradeSummaryValue(
    summary.totals.quantity,
    summary.totals.quantityUnitCode ?? undefined,
    2,
  );
}

function addSummaryTotals(
  sheet: ExcelJS.Worksheet,
  summary: TradeRecordIntelligenceSummary,
  filters: TradeRecordFilters,
) {
  const valueSuffix = summaryValueSuffix(summary);
  const itemValueLabel =
    filters.tradeFlow === "export"
      ? "US$ FOB"
      : filters.tradeFlow === "import"
        ? "US$ CIF"
        : "Valor CIF/FOB";
  const rows = [
    ["Métrica", "Valor", "Nota"],
    ["Registros", formatTradeDecimal(summary.totals.records, 0), ""],
    [
      itemValueLabel,
      formatTradeSummaryValue(summary.totals.itemValue, valueSuffix),
      summary.totals.currencyIsMixed ? "Monedas mixtas" : "",
    ],
    [
      "US$ FOB total",
      formatTradeSummaryValue(summary.totals.declarationFobValue, valueSuffix),
      summary.totals.currencyIsMixed ? "Monedas mixtas" : "",
    ],
    [
      "Cantidad",
      quantityValue(summary),
      summary.totals.quantityUnitIsMixed ? "No comparable por unidad mixta" : "",
    ],
    ["Peso bruto", formatTradeSummaryValue(summary.totals.grossWeightItem), ""],
    ["Peso bruto total", formatTradeSummaryValue(summary.totals.grossWeightTotal), ""],
  ];

  sheet.addRow(["Resumen del resultado"]);
  styleTitleCell(sheet.getCell("A1"));
  sheet.addRow([]);
  addRows(sheet, rows);
  styleHeaderRow(sheet.getRow(3));
}

function rankLabel(rank: TradeRecordSummaryRank) {
  return formatTradeCodeLabel(rank.code, rank.labelRaw ?? undefined);
}

function addRankingSection(
  sheet: ExcelJS.Worksheet,
  title: string,
  ranks: TradeRecordSummaryRank[],
  valueSuffix?: string,
) {
  sheet.addRow([]);
  const titleRow = sheet.addRow([title]);
  titleRow.font = { bold: true };
  const header = sheet.addRow(["Código", "Etiqueta", "Registros", "Valor"]);
  styleHeaderRow(header);

  if (ranks.length === 0) {
    sheet.addRow(["", "Sin datos", "", ""]);
    return;
  }

  for (const rank of ranks) {
    sheet.addRow([
      spreadsheetSafeText(rank.code),
      spreadsheetSafeText(rankLabel(rank)),
      formatTradeDecimal(rank.records, 0),
      formatTradeSummaryValue(rank.totalItemValue, valueSuffix),
    ]);
  }
}

function addRecordsSheet(
  workbook: ExcelJS.Workbook,
  plan: TradeRecordExportPlan,
  rows: TradeRecordExportRow[],
) {
  const sheet = workbook.addWorksheet("Registros", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  const columns = tradeRecordExportColumnDefinitionsForPlan(plan);
  const values = rows.map((record) =>
    columns.map((column) => spreadsheetSafeText(column.value(record))),
  );

  sheet.columns = columns.map((column) => ({
    header: column.label,
    key: column.key,
    width: Math.min(Math.max(column.label.length + 2, 12), 32),
  }));
  styleHeaderRow(sheet.getRow(1));
  addRows(sheet, values);
  setColumnWidths(sheet, values);
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  };

  return sheet;
}

function addSummarySheet(
  workbook: ExcelJS.Workbook,
  summary: TradeRecordIntelligenceSummary,
  filters: TradeRecordFilters,
) {
  const sheet = workbook.addWorksheet("Resumen");
  const valueSuffix = summaryValueSuffix(summary);

  addSummaryTotals(sheet, summary, filters);
  addRankingSection(
    sheet,
    tradeRecordSummaryCountryTitle(filters),
    summary.rankings.countries,
    valueSuffix,
  );
  addRankingSection(sheet, "Top aduanas", summary.rankings.customsOffices, valueSuffix);
  addRankingSection(
    sheet,
    tradeRecordSummaryPortTitle(filters),
    summary.rankings.ports,
    valueSuffix,
  );
  addRankingSection(sheet, "Top partidas HS", summary.rankings.hsCodes, valueSuffix);
  setSheetDefaults(sheet);
  setColumnWidths(sheet, []);

  return sheet;
}

function addTraceabilitySheet(workbook: ExcelJS.Workbook, plan: TradeRecordExportPlan) {
  const sheet = workbook.addWorksheet("Filtros y trazabilidad");
  const rows = [
    ["Campo", "Valor"],
    ["Archivo XLSX", tradeRecordExportXlsxFileName(plan)],
    ["Archivo CSV equivalente", plan.fileName],
    ["Vista", plan.viewLabel],
    [
      "Registros filtrados",
      plan.estimatedRows === null
        ? "No calculado; la búsqueda necesita más filtros"
        : String(plan.estimatedRows),
    ],
    ["Tope de filas", String(plan.rowCap)],
    ["Columnas exportadas", plan.columns.map((column) => column.label).join(" | ")],
    ["Exportación permitida", plan.allowed ? "Sí" : "No"],
    ["Filtros aplicados", plan.appliedFilters.join(" | ")],
    ["Advertencia identidad", tradeRecordExportIdentityWarning],
    ["Advertencia trazabilidad", tradeRecordExportProvenanceWarning],
    [
      "Advertencias",
      plan.warnings.length === 0
        ? "Sin advertencias"
        : plan.warnings.map((warning) => warning.message).join(" | "),
    ],
    [
      "Límites",
      "Exportación MVP sin raw payloads, rutas locales, claves R2, URLs privadas, credenciales ni identidad legal inferida.",
    ],
  ];

  sheet.columns = [
    { header: "Campo", key: "field", width: 28 },
    { header: "Valor", key: "value", width: 90 },
  ];
  styleHeaderRow(sheet.getRow(1));
  addRows(sheet, rows.slice(1));
  setSheetDefaults(sheet);
  sheet.getColumn(2).alignment = { wrapText: true, vertical: "top" };

  return sheet;
}

export async function buildTradeRecordExportXlsx({
  filters,
  plan,
  rows,
  summary,
}: {
  filters: TradeRecordFilters;
  plan: TradeRecordExportPlan;
  rows: TradeRecordExportRow[];
  summary: TradeRecordIntelligenceSummary;
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Duanera";
  workbook.lastModifiedBy = "Duanera";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.subject = "Exportación controlada de registros Aduana";
  workbook.title = tradeRecordExportXlsxFileName(plan);

  addRecordsSheet(workbook, plan, rows);
  addSummarySheet(workbook, summary, filters);
  addTraceabilitySheet(workbook, plan);

  const buffer = await workbook.xlsx.writeBuffer();

  return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
}
