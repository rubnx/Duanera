import type { DataQualityStatus } from "@/quality/coverage";
import {
  buildTradeRecordSearchHref,
  filtersToTradeRecordSearchParams,
} from "@/trade/trade-record-links";
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

export function dataQualityIssueSearchHref(filters: TradeRecordFilters) {
  return buildTradeRecordSearchHref(filtersToTradeRecordSearchParams(filters));
}

export function dataQualityIssueStatus(
  count: number,
  statusWhenPresent: DataQualityStatus = "review",
): DataQualityStatus {
  return count > 0 ? statusWhenPresent : "ok";
}
