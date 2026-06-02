import type { DataQualityStatus } from "@/quality/coverage";
import {
  buildTradeRecordSearchHref,
  filtersToTradeRecordSearchParams,
} from "@/trade/trade-record-links";
import {
  sourceDisplayFilename,
  sourceTradeRecordsHref,
} from "@/sources/source-provenance";
import type { TradeFlow, TradeRecordFilters } from "@/trade/trade-records";

export type DataQualityIssueKind =
  | "missing_import_gross_weight_item"
  | "undecoded_customs_office"
  | "undecoded_port"
  | "undecoded_transport_mode"
  | "missing_or_zero_item_value"
  | "missing_or_zero_declaration_fob"
  | "quantity_unit_value_review";

export type DataQualityIssueSample = {
  id: string;
  tradeFlow: TradeFlow;
  periodLabel: string;
  declarationIdRaw: string | null;
  itemNumber: number | null;
  hsCodeNormalized: string | null;
  productDescriptionRaw: string | null;
  itemValue: string | null;
  itemValueLabel: string;
  declarationFobValue: string | null;
  quantity: string | null;
  quantityUnitCode: string | null;
  unitPriceValue: string | null;
  grossWeightItem: string | null;
  grossWeightTotal: string | null;
  customsOfficeCode: string | null;
  relevantPortCode: string | null;
  transportModeCode: string | null;
  sourceFileId: string;
  importBatchId: string;
  sourceFilename: string;
  rawRowNumber: number;
  evidence: string;
  recordHref: string;
  sourceHref: string;
  sourceTradeRecordsHref: string | null;
};

export type DataQualityIssueSampleSourceRow = {
  id: string;
  tradeFlow: string;
  periodYear: number;
  periodMonth: number;
  declarationIdRaw: string | null;
  itemNumber: number | null;
  hsCodeNormalized: string | null;
  productDescriptionRaw: string | null;
  quantity: string | null;
  quantityUnitCode: string | null;
  grossWeightItem: string | null;
  grossWeightTotal: string | null;
  itemCifValue: string | null;
  itemFobValue: string | null;
  declarationFobValue: string | null;
  unitPriceValue: string | null;
  customsOfficeCode: string | null;
  embarkPortCode: string | null;
  disembarkPortCode: string | null;
  transportModeCode: string | null;
  sourceFileId: string;
  importBatchId: string;
  originalFilename: string;
  normalizedRawFilename: string | null;
  rawRowNumber: number;
};

export type DataQualityIssueGroup = {
  key: DataQualityIssueKind;
  title: string;
  description: string;
  status: DataQualityStatus;
  count: number;
  sampleLimit: number;
  tradeRecordsHref: string;
  samples: DataQualityIssueSample[];
};

export function dataQualityIssueRecordHref(id: string) {
  return `/trade-records/${id}`;
}

export function dataQualitySourceBatchHref(sourceFileId: string, importBatchId: string) {
  return `/sources/${sourceFileId}#batch-${importBatchId}`;
}

export function dataQualityIssueSearchHref(filters: TradeRecordFilters) {
  return buildTradeRecordSearchHref(filtersToTradeRecordSearchParams(filters));
}

export function dataQualityIssueStatus(
  count: number,
  statusWhenPresent: DataQualityStatus = "review",
): DataQualityStatus {
  return count > 0 ? statusWhenPresent : "ok";
}

function periodLabel(
  row: Pick<DataQualityIssueSampleSourceRow, "periodMonth" | "periodYear">,
) {
  return `${row.periodYear}-${String(row.periodMonth).padStart(2, "0")}`;
}

export function dataQualityIssueSampleFromRow(
  row: DataQualityIssueSampleSourceRow,
  evidence: string,
): DataQualityIssueSample | null {
  if (row.tradeFlow !== "import" && row.tradeFlow !== "export") {
    return null;
  }

  const tradeFlow = row.tradeFlow;

  return {
    id: row.id,
    tradeFlow,
    periodLabel: periodLabel(row),
    declarationIdRaw: row.declarationIdRaw,
    itemNumber: row.itemNumber,
    hsCodeNormalized: row.hsCodeNormalized,
    productDescriptionRaw: row.productDescriptionRaw,
    itemValue: tradeFlow === "import" ? row.itemCifValue : row.itemFobValue,
    itemValueLabel: tradeFlow === "import" ? "CIF item" : "FOB item",
    declarationFobValue: row.declarationFobValue,
    quantity: row.quantity,
    quantityUnitCode: row.quantityUnitCode,
    unitPriceValue: row.unitPriceValue,
    grossWeightItem: row.grossWeightItem,
    grossWeightTotal: row.grossWeightTotal,
    customsOfficeCode: row.customsOfficeCode,
    relevantPortCode: tradeFlow === "import" ? row.disembarkPortCode : row.embarkPortCode,
    transportModeCode: row.transportModeCode,
    sourceFileId: row.sourceFileId,
    importBatchId: row.importBatchId,
    sourceFilename: sourceDisplayFilename({
      originalFilename: row.originalFilename,
      normalizedRawFilename: row.normalizedRawFilename,
    }),
    rawRowNumber: row.rawRowNumber,
    evidence,
    recordHref: dataQualityIssueRecordHref(row.id),
    sourceHref: dataQualitySourceBatchHref(row.sourceFileId, row.importBatchId),
    sourceTradeRecordsHref: sourceTradeRecordsHref({
      sourceFileId: row.sourceFileId,
      importBatchId: row.importBatchId,
      tradeFlow,
    }),
  };
}
