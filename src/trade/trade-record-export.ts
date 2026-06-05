import type { DbClient } from "@/db/client";
import { reconstructTradeRecordSourceRows } from "@/sources/source-row-reconstruction";
import { sourceFilenameLabel } from "@/sources/source-provenance";
import { formatTradeFlowLabel } from "@/trade/trade-flow-ui";
import { productDisplayFromRaw } from "@/trade/trade-record-display";
import {
  findOperationalSourceField,
} from "@/trade/trade-record-detail-display";
import {
  formatTradeCodeLabel,
  formatTradeMoney,
  formatTradeQuantityDisplay,
} from "@/trade/trade-record-format";
import { loadOperationalCodeLabelMaps } from "@/trade/trade-record-operational-code-labels";
import {
  operationalSourceFieldGroups,
  type OperationalSourceFieldGroup,
} from "@/trade/trade-record-operational-fields";
import {
  formatPayloadRetainedReason,
  formatPayloadRetentionMode,
} from "@/trade/trade-record-provenance";
import {
  filtersToTradeRecordSearchParams,
  type TradeRecordSearchHrefParams,
} from "@/trade/trade-record-links";
import { formatTradeRecordPeriodValue } from "@/trade/trade-record-periods";
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
import { baseTradeRecordDetailQuery } from "@/trade/trade-record-summary-query";
import {
  listTradeRecords,
  type TradeRecordDetail,
  type TradeRecordFilters,
  type TradeRecordSummary,
} from "@/trade/trade-records";
import {
  buildTradeRecordWhere,
  type TradeRecordWhereOptions,
} from "@/trade/trade-record-where";
import { tradeRecords } from "@/db/schema";
import { and, inArray } from "drizzle-orm";

export const tradeRecordExportRowCap = 500;

export const tradeRecordExportIdentityWarning =
  "Los IDs Aduana son identificadores anónimos de fuente; no son RUT, razón social ni identidad legal verificada.";

export const tradeRecordExportProvenanceWarning =
  "La exportación incluye campos normalizados y trazabilidad de fuente. No incluye payloads crudos, rutas locales, claves R2, URLs privadas ni credenciales.";

export type TradeRecordExportWarningCode =
  | "missing_flow"
  | "missing_period"
  | "broad_query"
  | "missing_columns"
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
  availableColumns: TradeRecordExportColumn[];
  columns: TradeRecordExportColumn[];
  warnings: TradeRecordExportWarning[];
  caveats: string[];
  appliedFilters: string[];
  appliedSearchParams: Record<string, string>;
};

type ExportRecord = TradeRecordWithLabels<TradeRecordSummary> & {
  operationalSourceFields?: OperationalSourceFieldGroup[];
};

export type TradeRecordExportRow = ExportRecord;

export type TradeRecordExportColumnDefinition = TradeRecordExportColumn & {
  value: (record: ExportRecord) => string;
};

const paginationKeys = new Set(["after", "offset", "limit"]);
const operationalSourceColumnKeys = new Set([
  "transport_company",
  "transport_document_issuer",
  "transport_company_country",
  "payment_form",
  "sale_clause",
  "package_type",
  "package_count",
  "manifest_number",
  "manifest_date",
  "transport_document_number",
  "transport_document_date",
  "warehouse",
  "warehouse_date",
]);

function inputValues(
  input: TradeRecordSearchInput | TradeRecordSearchHrefParams,
  key: string,
) {
  if (input instanceof URLSearchParams) {
    return input.getAll(key);
  }

  const value = input[key];
  if (Array.isArray(value)) {
    return value;
  }

  return value ? [value] : [];
}

function normalizeSelectedColumnKeys(columnKeys: string[]) {
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const columnKey of columnKeys) {
    const keys = columnKey === "period" ? ["year", "month"] : [columnKey];

    for (const key of keys) {
      if (!seen.has(key)) {
        normalized.push(key);
        seen.add(key);
      }
    }
  }

  return normalized;
}

function normalizeSelectedColumnParam(value: string) {
  return normalizeSelectedColumnKeys(
    value
      .split(",")
      .map((key) => key.trim())
      .filter(Boolean),
  );
}

function inputValue(
  input: TradeRecordSearchInput | TradeRecordSearchHrefParams,
  key: string,
) {
  const value = inputValues(input, key).filter((item) => item.trim()).join(",");
  return value || undefined;
}

function parseSelectedColumnKeys(
  input: TradeRecordSearchInput | TradeRecordSearchHrefParams,
) {
  const value = inputValue(input, "columns");

  if (!value) {
    return null;
  }

  return normalizeSelectedColumnParam(value);
}

export function sanitizeTradeRecordExportInput(
  input: TradeRecordSearchInput,
): Record<string, string> {
  const clean: Record<string, string> = {};

  if (input instanceof URLSearchParams) {
    const keys = new Set(input.keys());
    for (const key of keys) {
      const value = inputValues(input, key).filter((item) => item.trim()).join(",");
      if (!paginationKeys.has(key) && value) {
        clean[key] =
          key === "columns"
            ? normalizeSelectedColumnParam(value).join(",")
            : value;
      }
    }

    return clean;
  }

  for (const [key, rawValue] of Object.entries(input)) {
    const value = inputValues(input, key).filter((item) => item.trim()).join(",");
    if (!paginationKeys.has(key) && value) {
      clean[key] =
        key === "columns"
          ? normalizeSelectedColumnParam(value).join(",")
          : value;
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
      filters.originCountryCodes?.length ||
      filters.destinationCountryCode ||
      filters.destinationCountryCodes?.length ||
      filters.customsOfficeCode ||
      filters.transportModeCode ||
      filters.embarkPortCode ||
      filters.disembarkPortCode ||
      filters.cargoTypeCode ||
      filters.logisticsPartyId ||
      filters.logisticsRole ||
      filters.sourceFileId ||
      filters.importBatchId ||
      hasCommercialRangeFilter(filters),
  );
}

function exactPeriod(filters: TradeRecordFilters) {
  if (filters.periodYear && filters.periodMonth) {
    return formatTradeRecordPeriodValue(filters.periodYear, filters.periodMonth);
  }

  if (filters.periodFrom && filters.periodTo && filters.periodFrom === filters.periodTo) {
    return filters.periodFrom;
  }

  return undefined;
}

export function hasTradeRecordExportExactPeriod(filters: TradeRecordFilters) {
  return Boolean(exactPeriod(filters));
}

function periodScope(filters: TradeRecordFilters) {
  const exact = exactPeriod(filters);
  if (exact) {
    return exact;
  }

  if (filters.periodFrom && filters.periodTo) {
    return `${filters.periodFrom}-a-${filters.periodTo}`;
  }

  return undefined;
}

function periodScopeLabel(filters: TradeRecordFilters) {
  const exact = exactPeriod(filters);
  if (exact) {
    return exact;
  }

  if (filters.periodFrom && filters.periodTo) {
    return `${filters.periodFrom} a ${filters.periodTo}`;
  }

  return undefined;
}

export function hasTradeRecordExportPeriodScope(filters: TradeRecordFilters) {
  return Boolean(periodScope(filters));
}

function relevantCountryLabel(filters: TradeRecordFilters) {
  const originCountryCodes = filters.originCountryCodes?.length
    ? filters.originCountryCodes
    : filters.originCountryCode
      ? [filters.originCountryCode]
      : [];
  const destinationCountryCodes = filters.destinationCountryCodes?.length
    ? filters.destinationCountryCodes
    : filters.destinationCountryCode
      ? [filters.destinationCountryCode]
      : [];

  if (filters.tradeFlow === "export" && destinationCountryCodes.length > 0) {
    return `País destino: ${destinationCountryCodes.join(", ")}`;
  }

  if (filters.tradeFlow === "import" && originCountryCodes.length > 0) {
    return `País origen: ${originCountryCodes.join(", ")}`;
  }

  return undefined;
}

export function summarizeTradeRecordExportFilters(filters: TradeRecordFilters) {
  const items: string[] = [];
  const period = periodScopeLabel(filters);

  if (filters.tradeFlow) items.push(`Operación: ${formatTradeFlowLabel(filters.tradeFlow, "plural")}`);
  if (period) items.push(`Periodo: ${period}`);
  if (filters.hsCodePrefix) items.push(`Partida arancelaria inicia con: ${filters.hsCodePrefix}`);
  if (filters.productQuery) items.push(`Producto contiene: ${filters.productQuery}`);
  if (filters.importerCorrelativeId) {
    items.push(
      `Importador ID Aduana: ${filters.importerCorrelativeId} (no identidad legal)`,
    );
  }
  if (filters.exporterCorrelativeId) {
    items.push(
      `Exportador ID Aduana: ${filters.exporterCorrelativeId} (no identidad legal)`,
    );
  }

  const country = relevantCountryLabel(filters);
  if (country) items.push(country);
  if (filters.customsOfficeCode) items.push(`Aduana: ${filters.customsOfficeCode}`);
  if (filters.transportModeCode) items.push(`Vía transporte: ${filters.transportModeCode}`);
  if (filters.embarkPortCode) items.push(`Puerto embarque: ${filters.embarkPortCode}`);
  if (filters.disembarkPortCode) {
    items.push(`Puerto desembarque: ${filters.disembarkPortCode}`);
  }
  if (filters.cargoTypeCode) items.push(`Tipo de carga: ${filters.cargoTypeCode}`);
  if (filters.sourceFileId) items.push(`Original: ${filters.sourceFileId}`);
  if (filters.importBatchId) items.push(`Lote: ${filters.importBatchId}`);
  if (filters.minItemValue || filters.maxItemValue) {
    items.push(
      `Valor: ${filters.minItemValue ?? "sin mínimo"} a ${filters.maxItemValue ?? "sin máximo"}`,
    );
  }
  if (filters.minDeclarationFob || filters.maxDeclarationFob) {
    items.push(
      `FOB total: ${filters.minDeclarationFob ?? "sin mínimo"} a ${filters.maxDeclarationFob ?? "sin máximo"}`,
    );
  }
  if (filters.minQuantity || filters.maxQuantity) {
    items.push(
      `Cantidad: ${filters.minQuantity ?? "sin mínimo"} a ${filters.maxQuantity ?? "sin máximo"}`,
    );
  }
  if (filters.minGrossWeightItem || filters.maxGrossWeightItem) {
    items.push(
      `Peso bruto: ${filters.minGrossWeightItem ?? "sin mínimo"} a ${filters.maxGrossWeightItem ?? "sin máximo"}`,
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
    ? "Importador ID Aduana (no identidad legal)"
    : "Exportador ID Aduana (no identidad legal)";
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
  return productDisplayFromRaw(record.productDescriptionRaw).description ?? "";
}

function productSourceExact(record: ExportRecord) {
  return productDisplayFromRaw(record.productDescriptionRaw).raw ?? "";
}

function operation(record: ExportRecord) {
  return record.tradeFlow === "import" ? "Importación" : "Exportación";
}

function money(value: string | null, record: ExportRecord) {
  return formatTradeMoney(value, record.decodedLabels.currency, "");
}

function quantity(record: ExportRecord) {
  return formatTradeQuantityDisplay(
    record.quantity,
    record.quantityUnitCode,
    record.decodedLabels.quantityUnit,
    "",
  );
}

function operationalSourceValue(record: ExportRecord, key: string) {
  if (!record.operationalSourceFields) {
    return "";
  }

  return findOperationalSourceField(record.operationalSourceFields, key)?.value ?? "";
}

function baseColumns(): Record<string, TradeRecordExportColumnDefinition> {
  return {
    operation: {
      key: "operation",
      label: "Operación",
      value: operation,
    },
    year: {
      key: "year",
      label: "Año",
      value: (record) => String(record.periodYear),
    },
    month: {
      key: "month",
      label: "Mes",
      value: (record) => String(record.periodMonth).padStart(2, "0"),
    },
    acceptanceDate: {
      key: "acceptance_date",
      label: "Fecha de aceptación",
      value: (record) => record.acceptanceDate ?? "",
    },
    declarationId: {
      key: "declaration_id",
      label: "Número de aceptación",
      value: (record) => record.declarationIdRaw ?? "",
    },
    itemNumber: {
      key: "item_number",
      label: "Ítem declaración",
      value: (record) => String(record.itemNumber ?? ""),
    },
    hsCode: {
      key: "hs_code",
      label: "Partida arancelaria",
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
    productSourceExact: {
      key: "product_source_exact",
      label: "Texto producto fuente exacto",
      value: productSourceExact,
    },
    participantLabel: {
      key: "participant_type",
      label: "Tipo de ID Aduana",
      value: participantLabel,
    },
    participant: {
      key: "participant_correlative",
      label: "ID Aduana (no identidad legal)",
      value: participantValue,
    },
    itemValueType: {
      key: "item_value_type",
      label: "Base de valor",
      value: (record) => (record.tradeFlow === "import" ? "US$ CIF" : "US$ FOB"),
    },
    itemValue: {
      key: "item_value",
      label: "Valor",
      value: (record) => money(itemValue(record), record),
    },
    declarationFobValue: {
      key: "declaration_fob_value",
      label: "US$ FOB declaración",
      value: (record) => money(record.declarationFobValue, record),
    },
    quantity: {
      key: "quantity",
      label: "Cantidad",
      value: quantity,
    },
    grossWeightItem: {
      key: "gross_weight_item",
      label: "Peso bruto",
      value: (record) => record.grossWeightItem ?? "",
    },
    grossWeightTotal: {
      key: "gross_weight_total",
      label: "Peso bruto total",
      value: (record) => record.grossWeightTotal ?? "",
    },
    freightValue: {
      key: "freight_value",
      label: "US$ Flete",
      value: (record) => money(record.freightValue ?? null, record),
    },
    insuranceValue: {
      key: "insurance_value",
      label: "US$ Seguro",
      value: (record) => money(record.insuranceValue ?? null, record),
    },
    totalCifValue: {
      key: "total_cif_value",
      label: "US$ CIF total",
      value: (record) => money(record.cifValue ?? null, record),
    },
    unitPriceValue: {
      key: "unit_price_value",
      label: "US$ unitario",
      value: (record) => record.unitPriceValue ?? "",
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
    transportCompany: {
      key: "transport_company",
      label: "Compañía de transporte",
      value: (record) => operationalSourceValue(record, "transportCompany"),
    },
    transportDocumentIssuer: {
      key: "transport_document_issuer",
      label: "Emisor documento transporte",
      value: (record) => operationalSourceValue(record, "transportDocumentIssuer"),
    },
    transportCompanyCountry: {
      key: "transport_company_country",
      label: "País compañía transporte",
      value: (record) => operationalSourceValue(record, "transportCompanyCountry"),
    },
    paymentForm: {
      key: "payment_form",
      label: "Forma de pago",
      value: (record) => operationalSourceValue(record, "paymentForm"),
    },
    saleClause: {
      key: "sale_clause",
      label: "Cláusula",
      value: (record) => operationalSourceValue(record, "saleClause"),
    },
    packageDetail: {
      key: "package_type",
      label: "Tipo de bulto",
      value: (record) => operationalSourceValue(record, "packageDetail"),
    },
    packageTotal: {
      key: "package_count",
      label: "Cantidad de bultos",
      value: (record) => operationalSourceValue(record, "packageTotal"),
    },
    manifestNumber: {
      key: "manifest_number",
      label: "Nro. manifiesto",
      value: (record) => operationalSourceValue(record, "manifestNumber"),
    },
    manifestDate: {
      key: "manifest_date",
      label: "Fecha manifiesto",
      value: (record) => operationalSourceValue(record, "manifestDate"),
    },
    transportDocumentNumber: {
      key: "transport_document_number",
      label: "Nro. documento transporte",
      value: (record) => operationalSourceValue(record, "transportDocumentNumber"),
    },
    transportDocumentDate: {
      key: "transport_document_date",
      label: "Fecha documento transporte",
      value: (record) => operationalSourceValue(record, "transportDocumentDate"),
    },
    warehouse: {
      key: "warehouse",
      label: "Almacén",
      value: (record) => operationalSourceValue(record, "warehouse"),
    },
    warehouseDate: {
      key: "warehouse_date",
      label: "Fecha almacén",
      value: (record) => operationalSourceValue(record, "warehouseDate"),
    },
    sourceFilename: {
      key: "source_filename",
      label: "Archivo original",
      value: sourceFilename,
    },
    sourceFileId: {
      key: "source_file_id",
      label: "ID archivo original",
      value: (record) => record.sourceFileId,
    },
    importBatchId: {
      key: "import_batch_id",
      label: "ID lote",
      value: (record) => record.importBatchId,
    },
    rawRowNumber: {
      key: "raw_row_number",
      label: "Fila original",
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
      label: "Retención del original",
      value: (record) => formatPayloadRetentionMode(record.payloadRetentionMode),
    },
    payloadRetainedReason: {
      key: "payload_retained_reason",
      label: "Razón de retención",
      value: (record) => formatPayloadRetainedReason(record.payloadRetainedReason),
    },
    payloadReconstructable: {
      key: "payload_reconstructable",
      label: "Original reconstruible",
      value: (record) => (record.payloadReconstructable ? "Sí" : "No"),
    },
  };
}

function flowAwareColumnLabel(
  column: TradeRecordExportColumnDefinition,
  filters?: Pick<TradeRecordFilters, "tradeFlow">,
) {
  if (filters?.tradeFlow === "import") {
    if (column.key === "participant_correlative") return "ID importador Aduana";
    if (column.key === "item_value") return "US$ CIF";
    if (column.key === "relevant_country") return "País origen";
    if (column.key === "relevant_port") return "Puerto desembarque";
  }

  if (filters?.tradeFlow === "export") {
    if (column.key === "participant_correlative") return "ID exportador Aduana";
    if (column.key === "item_value") return "US$ FOB";
    if (column.key === "relevant_country") return "País destino";
    if (column.key === "relevant_port") return "Puerto embarque";
  }

  if (column.key === "participant_correlative") return "ID Aduana";
  if (column.key === "item_value") return "US$ CIF/FOB";
  if (column.key === "relevant_country") return "País origen/destino";
  if (column.key === "relevant_port") return "Puerto embarque/desembarque";

  return column.label;
}

function withFlowAwareLabels(
  columns: TradeRecordExportColumnDefinition[],
  filters?: Pick<TradeRecordFilters, "tradeFlow">,
) {
  return columns.map((column) => ({
    ...column,
    label: flowAwareColumnLabel(column, filters),
  }));
}

export function tradeRecordExportColumnsForView(
  view: TradeRecordTableViewId,
  filters?: Pick<TradeRecordFilters, "tradeFlow">,
): TradeRecordExportColumnDefinition[] {
  const columns = baseColumns();
  const viewColumns = {
    commercial: [
      columns.operation,
      columns.year,
      columns.month,
      columns.acceptanceDate,
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
    values: [
      columns.operation,
      columns.year,
      columns.month,
      columns.acceptanceDate,
      columns.declarationId,
      columns.itemNumber,
      columns.hsCode,
      columns.product,
      columns.itemValueType,
      columns.itemValue,
      columns.declarationFobValue,
      columns.freightValue,
      columns.insuranceValue,
      columns.totalCifValue,
      columns.unitPriceValue,
      columns.quantity,
      columns.grossWeightItem,
      columns.grossWeightTotal,
      columns.relevantCountry,
      columns.participant,
      columns.sourceFilename,
      columns.rawRowNumber,
    ],
    logistics: [
      columns.operation,
      columns.year,
      columns.month,
      columns.acceptanceDate,
      columns.customsOffice,
      columns.relevantPort,
      columns.transportMode,
      columns.cargoType,
      columns.transportCompany,
      columns.transportDocumentIssuer,
      columns.transportCompanyCountry,
      columns.paymentForm,
      columns.saleClause,
      columns.packageDetail,
      columns.packageTotal,
      columns.manifestNumber,
      columns.manifestDate,
      columns.transportDocumentNumber,
      columns.transportDocumentDate,
      columns.warehouse,
      columns.warehouseDate,
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
      columns.year,
      columns.month,
      columns.acceptanceDate,
      columns.hsCode,
      columns.product,
      columns.productReference,
      columns.productDetails,
      columns.productSourceExact,
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
      columns.year,
      columns.month,
      columns.acceptanceDate,
      columns.declarationId,
      columns.itemNumber,
      columns.hsCode,
      columns.product,
      columns.productSourceExact,
      columns.participant,
      columns.customsOffice,
      columns.relevantPort,
    ],
  } satisfies Record<TradeRecordTableViewId, TradeRecordExportColumnDefinition[]>;

  return withFlowAwareLabels(viewColumns[view], filters);
}

function selectedExportColumnsForView(
  view: TradeRecordTableViewId,
  selectedColumnKeys: string[] | null | undefined,
  filters?: Pick<TradeRecordFilters, "tradeFlow">,
) {
  const columns = tradeRecordExportColumnsForView(view, filters);

  if (!selectedColumnKeys) {
    return columns;
  }

  const selected = new Set(normalizeSelectedColumnKeys(selectedColumnKeys));
  return columns.filter((column) => selected.has(column.key));
}

export function tradeRecordExportColumnDefinitionsForPlan(
  plan: Pick<TradeRecordExportPlan, "columns" | "view">,
) {
  const labels = new Map(plan.columns.map((column) => [column.key, column.label]));
  return tradeRecordExportColumnsForView(plan.view)
    .filter((column) => labels.has(column.key))
    .map((column) => ({
      ...column,
      label: labels.get(column.key) ?? column.label,
    }));
}

function structuralExportWarnings(filters: TradeRecordFilters) {
  const warnings: TradeRecordExportWarning[] = [];

  if (!filters.tradeFlow) {
    warnings.push({
      code: "missing_flow",
      message: "Selecciona importaciones o exportaciones antes de exportar.",
    });
  }

  if (!hasTradeRecordExportPeriodScope(filters)) {
    warnings.push({
      code: "missing_period",
      message:
        "Selecciona un mes o rango de meses antes de exportar.",
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

function columnSelectionWarnings(
  selectedColumnKeys: string[] | null | undefined,
  selectedColumns: TradeRecordExportColumn[],
) {
  const warnings: TradeRecordExportWarning[] = [];

  if (selectedColumnKeys && selectedColumns.length === 0) {
    warnings.push({
      code: "missing_columns",
      message: "Selecciona al menos una columna válida para exportar.",
    });
  }

  return warnings;
}

function columnsNeedOperationalSourceFields(columns: TradeRecordExportColumn[]) {
  return columns.some((column) => operationalSourceColumnKeys.has(column.key));
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
    periodScope(filters) ?? "periodo",
    view,
  ];

  return `${slug(parts.join("-"))}.csv`;
}

export function createTradeRecordExportPlan({
  filters,
  selectedColumnKeys,
  totalRows,
  view,
}: {
  filters: TradeRecordFilters;
  selectedColumnKeys?: string[] | null;
  totalRows: number | null;
  view: TradeRecordTableViewId;
}): TradeRecordExportPlan {
  const normalizedSelectedColumnKeys = selectedColumnKeys
    ? normalizeSelectedColumnKeys(selectedColumnKeys)
    : selectedColumnKeys;
  const availableColumns = tradeRecordExportColumnsForView(view, filters);
  const columns = selectedExportColumnsForView(
    view,
    normalizedSelectedColumnKeys,
    filters,
  );
  const warnings = [
    ...structuralExportWarnings(filters),
    ...rowCountExportWarnings(totalRows),
    ...columnSelectionWarnings(normalizedSelectedColumnKeys, columns),
  ];
  const viewMeta = tradeRecordTableViewById(view);
  const appliedSearchParams = filtersToTradeRecordSearchParams(filters);
  appliedSearchParams.view = view;
  if (normalizedSelectedColumnKeys && columns.length > 0) {
    appliedSearchParams.columns = columns.map((column) => column.key).join(",");
  }

  return {
    view,
    viewLabel: viewMeta.label,
    rowCap: tradeRecordExportRowCap,
    estimatedRows: totalRows,
    allowed: totalRows !== null && warnings.length === 0,
    fileName: exportFileName(filters, view),
    availableColumns: availableColumns.map(({ key, label }) => ({ key, label })),
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
  options: TradeRecordWhereOptions = {},
): Promise<TradeRecordExportPlan> {
  const cleanInput = sanitizeTradeRecordExportInput(input);
  const view = parseTradeRecordExportView(cleanInput);
  const filters = parseTradeRecordSearchParams(cleanInput);
  const selectedColumnKeys = parseSelectedColumnKeys(cleanInput);
  const structuralWarnings = structuralExportWarnings(filters);

  if (structuralWarnings.length > 0) {
    return createTradeRecordExportPlan({
      filters,
      selectedColumnKeys,
      totalRows: null,
      view,
    });
  }

  const result = await listTradeRecords(db, { ...filters, limit: 1, offset: 0 }, options);

  return createTradeRecordExportPlan({
    filters,
    selectedColumnKeys,
    totalRows: result.total,
    view,
  });
}

async function loadTradeRecordDetailsForExport(
  db: DbClient,
  records: TradeRecordSummary[],
  options: TradeRecordWhereOptions,
) {
  if (records.length === 0) {
    return new Map<string, TradeRecordDetail>();
  }

  const ids = records.map((record) => record.id);
  const productFacingWhere = buildTradeRecordWhere({}, options);
  const rows = await baseTradeRecordDetailQuery(db)
    .where(and(inArray(tradeRecords.id, ids), productFacingWhere))
    .limit(ids.length);

  return new Map(rows.map((row) => [row.id, row]));
}

async function enrichExportRowsWithOperationalFields(
  db: DbClient,
  rows: TradeRecordWithLabels<TradeRecordSummary>[],
  detailsById: Map<string, TradeRecordDetail>,
) {
  if (rows.length === 0) {
    return [];
  }

  const operationalCodeLabelMaps = await loadOperationalCodeLabelMaps(db);
  const sourceRecords = rows.map((record) => {
    const detail = detailsById.get(record.id);

    return detail ?? {
      ...record,
      rawText: null,
      rawValues: null,
    };
  });
  const sourceRowsByRawRowId = await reconstructTradeRecordSourceRows(db, sourceRecords);

  return rows.map((record): ExportRecord => ({
    ...record,
    operationalSourceFields: operationalSourceFieldGroups(
      record.tradeFlow,
      sourceRowsByRawRowId.get(record.rawTradeRowId)?.rawValues ?? null,
      operationalCodeLabelMaps,
    ),
  }));
}

export async function listTradeRecordsForExport(
  db: DbClient,
  input: TradeRecordSearchInput,
  options: TradeRecordWhereOptions = {},
) {
  const cleanInput = sanitizeTradeRecordExportInput(input);
  const filters = parseTradeRecordSearchParams(cleanInput);
  const plan = await planTradeRecordExport(db, cleanInput, options);

  if (!plan.allowed) {
    return { filters, plan, rows: [] };
  }

  const result = await listTradeRecords(db, {
    ...filters,
    limit: tradeRecordExportRowCap,
    offset: 0,
  }, options);
  const enrichedRows = await enrichTradeRecordsWithLabels(db, result.records);
  const rows = columnsNeedOperationalSourceFields(plan.columns)
    ? await enrichExportRowsWithOperationalFields(
        db,
        enrichedRows,
        await loadTradeRecordDetailsForExport(db, result.records, options),
      )
    : enrichedRows;

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
  const columns = tradeRecordExportColumnDefinitionsForPlan(plan);
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
    ["Columnas", plan.columns.map((column) => column.label).join(" | ")],
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
