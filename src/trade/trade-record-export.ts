import type { DbClient } from "@/db/client";
import { sourceFilenameLabel } from "@/sources/source-provenance";
import { productDisplayFromRaw } from "@/trade/trade-record-display";
import {
  formatTradeCodeLabel,
  formatTradeMoney,
  formatTradeQuantity,
} from "@/trade/trade-record-format";
import {
  formatPayloadRetainedReason,
  formatPayloadRetentionMode,
} from "@/trade/trade-record-provenance";
import {
  filtersToTradeRecordSearchParams,
  type TradeRecordSearchHrefParams,
} from "@/trade/trade-record-links";
import {
  parseTradeRecordSearchParams,
  type TradeRecordSearchInput,
} from "@/trade/trade-record-search-params";
import {
  parseTradeRecordTableView,
  tradeRecordTableViewById,
  type TradeRecordTableViewId,
} from "@/trade/trade-record-table-views";
import {
  enrichTradeRecordsWithLabels,
  type TradeRecordWithLabels,
} from "@/trade/trade-record-labels";
import {
  listTradeRecords,
  type TradeRecordFilters,
  type TradeRecordSummary,
} from "@/trade/trade-records";

export const tradeRecordExportRowCap = 500;

export const tradeRecordExportIdentityWarning =
  "Los correlativos Aduana son identificadores anónimos de fuente; no son RUT, razón social ni identidad legal verificada.";

export const tradeRecordExportProvenanceWarning =
  "La exportación incluye campos normalizados y trazabilidad de fuente. No incluye payloads crudos, rutas locales, claves R2, URLs privadas ni credenciales.";

export type TradeRecordExportWarningCode =
  | "missing_flow"
  | "missing_exact_period"
  | "broad_query"
  | "row_cap_exceeded"
  | "empty_result";

export type TradeRecordExportWarning = {
  code: TradeRecordExportWarningCode;
  message: string;
};

export type TradeRecordExportColumn = {
  key: string;
  label: string;
};

export type TradeRecordExportPlan = {
  view: TradeRecordTableViewId;
  viewLabel: string;
  rowCap: number;
  estimatedRows: number | null;
  allowed: boolean;
  fileName: string;
  columns: TradeRecordExportColumn[];
  warnings: TradeRecordExportWarning[];
  caveats: string[];
  appliedFilters: string[];
  appliedSearchParams: Record<string, string>;
};

type ExportRecord = TradeRecordWithLabels<TradeRecordSummary>;

export type TradeRecordExportRow = ExportRecord;

export type TradeRecordExportColumnDefinition = TradeRecordExportColumn & {
  value: (record: ExportRecord) => string;
};

const paginationKeys = new Set(["after", "offset", "limit"]);

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function inputValue(
  input: TradeRecordSearchInput | TradeRecordSearchHrefParams,
  key: string,
) {
  if (input instanceof URLSearchParams) {
    return input.get(key) ?? undefined;
  }

  return firstValue(input[key]);
}

export function sanitizeTradeRecordExportInput(
  input: TradeRecordSearchInput,
): Record<string, string> {
  const clean: Record<string, string> = {};

  if (input instanceof URLSearchParams) {
    for (const [key, value] of input.entries()) {
      if (!paginationKeys.has(key) && value.trim()) {
        clean[key] = value;
      }
    }

    return clean;
  }

  for (const [key, rawValue] of Object.entries(input)) {
    const value = firstValue(rawValue)?.trim();
    if (!paginationKeys.has(key) && value) {
      clean[key] = value;
    }
  }

  return clean;
}

export function parseTradeRecordExportView(
  input: TradeRecordSearchInput | TradeRecordSearchHrefParams,
) {
  return parseTradeRecordTableView(inputValue(input, "view"));
}

function hasCommercialRangeFilter(filters: TradeRecordFilters) {
  return Boolean(
    filters.minItemValue ||
      filters.maxItemValue ||
      filters.minDeclarationFob ||
      filters.maxDeclarationFob ||
      filters.minQuantity ||
      filters.maxQuantity ||
      filters.minGrossWeightItem ||
      filters.maxGrossWeightItem ||
      filters.minGrossWeightTotal ||
      filters.maxGrossWeightTotal,
  );
}

export function hasTradeRecordExportNarrowingFilter(filters: TradeRecordFilters) {
  return Boolean(
    filters.hsCodePrefix ||
      filters.productQuery ||
      filters.importerCorrelativeId ||
      filters.exporterCorrelativeId ||
      filters.originCountryCode ||
      filters.destinationCountryCode ||
      filters.customsOfficeCode ||
      filters.transportModeCode ||
      filters.portCode ||
      filters.sourceFileId ||
      filters.importBatchId ||
      hasCommercialRangeFilter(filters),
  );
}

function exactPeriod(filters: TradeRecordFilters) {
  if (filters.periodYear && filters.periodMonth) {
    return `${filters.periodYear}-${String(filters.periodMonth).padStart(2, "0")}`;
  }

  if (filters.periodFrom && filters.periodTo && filters.periodFrom === filters.periodTo) {
    return filters.periodFrom;
  }

  return undefined;
}

export function hasTradeRecordExportExactPeriod(filters: TradeRecordFilters) {
  return Boolean(exactPeriod(filters));
}

function flowLabel(value: string | undefined) {
  if (value === "import") return "Importaciones";
  if (value === "export") return "Exportaciones";
  return "Flujo no seleccionado";
}

function relevantCountryLabel(filters: TradeRecordFilters) {
  if (filters.tradeFlow === "export" && filters.destinationCountryCode) {
    return `País destino: ${filters.destinationCountryCode}`;
  }

  if (filters.tradeFlow === "import" && filters.originCountryCode) {
    return `País origen: ${filters.originCountryCode}`;
  }

  return undefined;
}

export function summarizeTradeRecordExportFilters(filters: TradeRecordFilters) {
  const items: string[] = [];
  const period = exactPeriod(filters);

  if (filters.tradeFlow) items.push(`Operación: ${flowLabel(filters.tradeFlow)}`);
  if (period) items.push(`Periodo: ${period}`);
  if (filters.hsCodePrefix) items.push(`HS inicia con: ${filters.hsCodePrefix}`);
  if (filters.productQuery) items.push(`Producto contiene: ${filters.productQuery}`);
  if (filters.importerCorrelativeId) {
    items.push(
      `Correlativo importador Aduana: ${filters.importerCorrelativeId} (no identidad legal)`,
    );
  }
  if (filters.exporterCorrelativeId) {
    items.push(
      `Correlativo exportador Aduana: ${filters.exporterCorrelativeId} (no identidad legal)`,
    );
  }

  const country = relevantCountryLabel(filters);
  if (country) items.push(country);
  if (filters.customsOfficeCode) items.push(`Aduana: ${filters.customsOfficeCode}`);
  if (filters.transportModeCode) items.push(`Vía transporte: ${filters.transportModeCode}`);
  if (filters.portCode) items.push(`Puerto: ${filters.portCode}`);
  if (filters.sourceFileId) items.push(`Fuente: ${filters.sourceFileId}`);
  if (filters.importBatchId) items.push(`Lote: ${filters.importBatchId}`);
  if (filters.minItemValue || filters.maxItemValue) {
    items.push(
      `Valor item: ${filters.minItemValue ?? "sin mínimo"} a ${filters.maxItemValue ?? "sin máximo"}`,
    );
  }
  if (filters.minDeclarationFob || filters.maxDeclarationFob) {
    items.push(
      `FOB declaración: ${filters.minDeclarationFob ?? "sin mínimo"} a ${filters.maxDeclarationFob ?? "sin máximo"}`,
    );
  }
  if (filters.minQuantity || filters.maxQuantity) {
    items.push(
      `Cantidad: ${filters.minQuantity ?? "sin mínimo"} a ${filters.maxQuantity ?? "sin máximo"}`,
    );
  }
  if (filters.minGrossWeightItem || filters.maxGrossWeightItem) {
    items.push(
      `Peso bruto item: ${filters.minGrossWeightItem ?? "sin mínimo"} a ${filters.maxGrossWeightItem ?? "sin máximo"}`,
    );
  }
  if (filters.minGrossWeightTotal || filters.maxGrossWeightTotal) {
    items.push(
      `Peso bruto total: ${filters.minGrossWeightTotal ?? "sin mínimo"} a ${filters.maxGrossWeightTotal ?? "sin máximo"}`,
    );
  }
  if (filters.sort) items.push(`Orden: ${filters.sort}`);

  return items.length > 0 ? items : ["Sin filtros aplicados"];
}

function itemValueLabel(record: ExportRecord) {
  return record.tradeFlow === "import" ? "CIF item" : "FOB item";
}

function itemValue(record: ExportRecord) {
  return record.tradeFlow === "import" ? record.itemCifValue : record.itemFobValue;
}

function relevantCountry(record: ExportRecord) {
  if (record.tradeFlow === "export") {
    return formatTradeCodeLabel(
      record.destinationCountryCode,
      record.decodedLabels.destinationCountry,
      "",
    );
  }

  return formatTradeCodeLabel(
    record.originCountryCode,
    record.decodedLabels.originCountry,
    "",
  );
}

function relevantPort(record: ExportRecord) {
  if (record.tradeFlow === "export") {
    return formatTradeCodeLabel(record.embarkPortCode, record.decodedLabels.embarkPort, "");
  }

  return formatTradeCodeLabel(
    record.disembarkPortCode,
    record.decodedLabels.disembarkPort,
    "",
  );
}

function participantValue(record: ExportRecord) {
  if (record.tradeFlow === "import") {
    return record.importerCorrelativeId ?? "";
  }

  return record.exporterPrimaryCorrelativeId ?? record.exporterSecondaryCorrelativeId ?? "";
}

function participantLabel(record: ExportRecord) {
  return record.tradeFlow === "import"
    ? "Correlativo importador Aduana (no identidad legal)"
    : "Correlativo exportador Aduana (no identidad legal)";
}

function sourceFilename(record: ExportRecord) {
  return sourceFilenameLabel(record.sourceFilename) ?? record.sourceFilename;
}

function productTitle(record: ExportRecord) {
  return productDisplayFromRaw(record.productDescriptionRaw).title;
}

function productReference(record: ExportRecord) {
  return productDisplayFromRaw(record.productDescriptionRaw).sourceReference ?? "";
}

function productDetails(record: ExportRecord) {
  return productDisplayFromRaw(record.productDescriptionRaw).details.join(" | ");
}

function period(record: ExportRecord) {
  return `${record.periodYear}-${String(record.periodMonth).padStart(2, "0")}`;
}

function operation(record: ExportRecord) {
  return record.tradeFlow === "import" ? "Importación" : "Exportación";
}

function money(value: string | null, record: ExportRecord) {
  return formatTradeMoney(value, record.decodedLabels.currency, "");
}

function quantity(record: ExportRecord) {
  return formatTradeQuantity(
    record.quantity,
    record.quantityUnitCode,
    record.decodedLabels.quantityUnit,
    "",
  );
}

function baseColumns(): Record<string, TradeRecordExportColumnDefinition> {
  return {
    operation: {
      key: "operation",
      label: "Operación",
      value: operation,
    },
    period: {
      key: "period",
      label: "Periodo",
      value: period,
    },
    declarationId: {
      key: "declaration_id",
      label: "Declaración",
      value: (record) => record.declarationIdRaw ?? "",
    },
    itemNumber: {
      key: "item_number",
      label: "Item",
      value: (record) => String(record.itemNumber ?? ""),
    },
    hsCode: {
      key: "hs_code",
      label: "Código HS",
      value: (record) => record.hsCodeNormalized ?? record.hsCodeRaw ?? "",
    },
    product: {
      key: "product",
      label: "Producto",
      value: productTitle,
    },
    productReference: {
      key: "product_reference",
      label: "Referencia producto fuente",
      value: productReference,
    },
    productDetails: {
      key: "product_details",
      label: "Detalle producto fuente",
      value: productDetails,
    },
    participantLabel: {
      key: "participant_type",
      label: "Tipo correlativo Aduana",
      value: participantLabel,
    },
    participant: {
      key: "participant_correlative",
      label: "Correlativo Aduana (no identidad legal)",
      value: participantValue,
    },
    itemValueType: {
      key: "item_value_type",
      label: "Tipo valor item",
      value: itemValueLabel,
    },
    itemValue: {
      key: "item_value",
      label: "Valor item",
      value: (record) => money(itemValue(record), record),
    },
    declarationFobValue: {
      key: "declaration_fob_value",
      label: "FOB declaración",
      value: (record) => money(record.declarationFobValue, record),
    },
    quantity: {
      key: "quantity",
      label: "Cantidad",
      value: quantity,
    },
    grossWeightItem: {
      key: "gross_weight_item",
      label: "Peso bruto item",
      value: (record) => record.grossWeightItem ?? "",
    },
    grossWeightTotal: {
      key: "gross_weight_total",
      label: "Peso bruto total",
      value: (record) => record.grossWeightTotal ?? "",
    },
    relevantCountry: {
      key: "relevant_country",
      label: "País relevante",
      value: relevantCountry,
    },
    customsOffice: {
      key: "customs_office",
      label: "Aduana",
      value: (record) =>
        formatTradeCodeLabel(
          record.customsOfficeCode,
          record.decodedLabels.customsOffice,
          "",
        ),
    },
    relevantPort: {
      key: "relevant_port",
      label: "Puerto relevante",
      value: relevantPort,
    },
    transportMode: {
      key: "transport_mode",
      label: "Vía de transporte",
      value: (record) =>
        formatTradeCodeLabel(
          record.transportModeCode,
          record.decodedLabels.transportMode,
          "",
        ),
    },
    cargoType: {
      key: "cargo_type",
      label: "Tipo de carga",
      value: (record) =>
        formatTradeCodeLabel(record.cargoTypeCode, record.decodedLabels.cargoType, ""),
    },
    sourceFilename: {
      key: "source_filename",
      label: "Archivo fuente",
      value: sourceFilename,
    },
    sourceFileId: {
      key: "source_file_id",
      label: "ID fuente Duanera",
      value: (record) => record.sourceFileId,
    },
    importBatchId: {
      key: "import_batch_id",
      label: "ID lote Duanera",
      value: (record) => record.importBatchId,
    },
    rawRowNumber: {
      key: "raw_row_number",
      label: "Fila cruda",
      value: (record) => String(record.rawRowNumber),
    },
    parser: {
      key: "parser",
      label: "Parser",
      value: (record) => `${record.parserName} ${record.parserVersion}`,
    },
    batchStatus: {
      key: "batch_status",
      label: "Estado lote",
      value: (record) => record.importBatchStatus,
    },
    payloadRetentionMode: {
      key: "payload_retention_mode",
      label: "Modo payload",
      value: (record) => formatPayloadRetentionMode(record.payloadRetentionMode),
    },
    payloadRetainedReason: {
      key: "payload_retained_reason",
      label: "Razón payload",
      value: (record) => formatPayloadRetainedReason(record.payloadRetainedReason),
    },
    payloadReconstructable: {
      key: "payload_reconstructable",
      label: "Payload reconstruible",
      value: (record) => (record.payloadReconstructable ? "Sí" : "No"),
    },
  };
}

export function tradeRecordExportColumnsForView(
  view: TradeRecordTableViewId,
): TradeRecordExportColumnDefinition[] {
  const columns = baseColumns();
  const viewColumns = {
    commercial: [
      columns.operation,
      columns.period,
      columns.declarationId,
      columns.itemNumber,
      columns.hsCode,
      columns.product,
      columns.participant,
      columns.itemValueType,
      columns.itemValue,
      columns.declarationFobValue,
      columns.quantity,
      columns.grossWeightItem,
      columns.grossWeightTotal,
      columns.relevantCountry,
      columns.customsOffice,
      columns.relevantPort,
      columns.transportMode,
      columns.sourceFilename,
      columns.rawRowNumber,
      columns.payloadRetentionMode,
    ],
    logistics: [
      columns.operation,
      columns.period,
      columns.customsOffice,
      columns.relevantPort,
      columns.transportMode,
      columns.cargoType,
      columns.relevantCountry,
      columns.hsCode,
      columns.product,
      columns.quantity,
      columns.grossWeightItem,
      columns.grossWeightTotal,
      columns.participant,
      columns.sourceFilename,
      columns.rawRowNumber,
      columns.parser,
    ],
    product: [
      columns.operation,
      columns.period,
      columns.hsCode,
      columns.product,
      columns.productReference,
      columns.productDetails,
      columns.itemNumber,
      columns.itemValueType,
      columns.itemValue,
      columns.declarationFobValue,
      columns.quantity,
      columns.grossWeightItem,
      columns.grossWeightTotal,
      columns.relevantCountry,
      columns.relevantPort,
      columns.participant,
      columns.sourceFilename,
      columns.rawRowNumber,
    ],
    provenance: [
      columns.sourceFilename,
      columns.sourceFileId,
      columns.importBatchId,
      columns.rawRowNumber,
      columns.parser,
      columns.batchStatus,
      columns.payloadRetentionMode,
      columns.payloadRetainedReason,
      columns.payloadReconstructable,
      columns.operation,
      columns.period,
      columns.declarationId,
      columns.itemNumber,
      columns.hsCode,
      columns.product,
      columns.participant,
      columns.customsOffice,
      columns.relevantPort,
    ],
  } satisfies Record<TradeRecordTableViewId, TradeRecordExportColumnDefinition[]>;

  return viewColumns[view];
}

function structuralExportWarnings(filters: TradeRecordFilters) {
  const warnings: TradeRecordExportWarning[] = [];

  if (!filters.tradeFlow) {
    warnings.push({
      code: "missing_flow",
      message: "Selecciona importaciones o exportaciones antes de exportar.",
    });
  }

  if (!hasTradeRecordExportExactPeriod(filters)) {
    warnings.push({
      code: "missing_exact_period",
      message:
        "La exportación MVP requiere un mes exacto para evitar descargas amplias.",
    });
  }

  if (!hasTradeRecordExportNarrowingFilter(filters)) {
    warnings.push({
      code: "broad_query",
      message:
        "Agrega al menos un filtro comercial, geográfico, logístico, de producto, fuente o rango numérico.",
    });
  }

  return warnings;
}

function rowCountExportWarnings(totalRows: number | null) {
  const warnings: TradeRecordExportWarning[] = [];

  if (totalRows === null) {
    return warnings;
  }

  if (totalRows > tradeRecordExportRowCap) {
    warnings.push({
      code: "row_cap_exceeded",
      message: `El resultado tiene ${totalRows} registros y supera el tope CSV/XLSX de ${tradeRecordExportRowCap}. Acota la búsqueda antes de descargar.`,
    });
  }

  if (totalRows === 0) {
    warnings.push({
      code: "empty_result",
      message: "No hay registros para exportar con los filtros actuales.",
    });
  }

  return warnings;
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function exportFileName(filters: TradeRecordFilters, view: TradeRecordTableViewId) {
  const parts = [
    "duanera-registros",
    filters.tradeFlow ?? "flujo",
    exactPeriod(filters) ?? "periodo",
    view,
  ];

  return `${slug(parts.join("-"))}.csv`;
}

export function createTradeRecordExportPlan({
  filters,
  totalRows,
  view,
}: {
  filters: TradeRecordFilters;
  totalRows: number | null;
  view: TradeRecordTableViewId;
}): TradeRecordExportPlan {
  const columns = tradeRecordExportColumnsForView(view);
  const warnings = [
    ...structuralExportWarnings(filters),
    ...rowCountExportWarnings(totalRows),
  ];
  const viewMeta = tradeRecordTableViewById(view);
  const appliedSearchParams = filtersToTradeRecordSearchParams(filters);
  appliedSearchParams.view = view;

  return {
    view,
    viewLabel: viewMeta.label,
    rowCap: tradeRecordExportRowCap,
    estimatedRows: totalRows,
    allowed: totalRows !== null && warnings.length === 0,
    fileName: exportFileName(filters, view),
    columns: columns.map(({ key, label }) => ({ key, label })),
    warnings,
    caveats: [tradeRecordExportIdentityWarning, tradeRecordExportProvenanceWarning],
    appliedFilters: summarizeTradeRecordExportFilters(filters),
    appliedSearchParams,
  };
}

export async function planTradeRecordExport(
  db: DbClient,
  input: TradeRecordSearchInput,
): Promise<TradeRecordExportPlan> {
  const cleanInput = sanitizeTradeRecordExportInput(input);
  const view = parseTradeRecordExportView(cleanInput);
  const filters = parseTradeRecordSearchParams(cleanInput);
  const structuralWarnings = structuralExportWarnings(filters);

  if (structuralWarnings.length > 0) {
    return createTradeRecordExportPlan({
      filters,
      totalRows: null,
      view,
    });
  }

  const result = await listTradeRecords(db, { ...filters, limit: 1, offset: 0 });

  return createTradeRecordExportPlan({
    filters,
    totalRows: result.total,
    view,
  });
}

export async function listTradeRecordsForExport(
  db: DbClient,
  input: TradeRecordSearchInput,
) {
  const cleanInput = sanitizeTradeRecordExportInput(input);
  const filters = parseTradeRecordSearchParams(cleanInput);
  const plan = await planTradeRecordExport(db, cleanInput);

  if (!plan.allowed) {
    return { filters, plan, rows: [] };
  }

  const result = await listTradeRecords(db, {
    ...filters,
    limit: tradeRecordExportRowCap,
    offset: 0,
  });
  const rows = await enrichTradeRecordsWithLabels(db, result.records);

  return { filters, plan, rows };
}

export function spreadsheetSafeText(
  value: string | number | boolean | null | undefined,
) {
  const text = value === null || value === undefined ? "" : String(value);

  return /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
}

export function csvSafeCell(value: string | number | boolean | null | undefined) {
  const formulaSafeText = spreadsheetSafeText(value);

  return `"${formulaSafeText.replace(/"/g, '""')}"`;
}

export function buildTradeRecordExportCsv({
  plan,
  rows,
}: {
  plan: TradeRecordExportPlan;
  rows: ExportRecord[];
}) {
  const columns = tradeRecordExportColumnsForView(plan.view);
  const metadataRows = [
    ["Duanera exportación CSV"],
    ["Vista", plan.viewLabel],
    ["Archivo", plan.fileName],
    [
      "Registros filtrados",
      plan.estimatedRows === null
        ? "No calculado; la búsqueda necesita más filtros"
        : String(plan.estimatedRows),
    ],
    ["Tope de filas", String(plan.rowCap)],
    ["Filtros aplicados", plan.appliedFilters.join(" | ")],
    ["Advertencia identidad", tradeRecordExportIdentityWarning],
    ["Advertencia trazabilidad", tradeRecordExportProvenanceWarning],
    [],
  ];
  const headerRow = columns.map((column) => column.label);
  const dataRows = rows.map((record) =>
    columns.map((column) => column.value(record)),
  );
  const csvRows = [...metadataRows, headerRow, ...dataRows];

  return `\ufeff${csvRows
    .map((row) => row.map((cell) => csvSafeCell(cell)).join(","))
    .join("\r\n")}\r\n`;
}

export function buildTradeRecordExportHref(
  params: TradeRecordSearchHrefParams,
  route = "/api/trade-records/export",
) {
  const clean = sanitizeTradeRecordExportInput(params);
  const query = new URLSearchParams(clean);
  const text = query.toString();

  return text ? `${route}?${text}` : route;
}
