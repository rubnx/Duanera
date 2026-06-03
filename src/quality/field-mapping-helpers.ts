import { coveragePercent, type DataQualityStatus } from "@/quality/coverage";
import {
  type FieldMappingConfidence,
} from "@/quality/field-mapping-definitions";
import {
  march2026ReportPeriod,
  qualityPeriodSearchParams,
  type QualityReportPeriod,
} from "@/quality/march-2026";
import { sourceTradeRecordsHref } from "@/sources/source-provenance";
import { buildTradeRecordSearchHref } from "@/trade/trade-record-links";
import type { TradeFlow } from "@/trade/trade-records";

export function rawSampleValueRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return Object.fromEntries(Object.entries(value));
}

export function fieldMappingSearchHref(
  tradeFlow: TradeFlow,
  period: QualityReportPeriod = march2026ReportPeriod,
) {
  return buildTradeRecordSearchHref({
    tradeFlow,
    ...qualityPeriodSearchParams(period),
    limit: "25",
  });
}

export function fieldMappingCoverageStatus({
  confidence,
  normalizedTotalRows,
  normalizedPresentRows,
  rawFields,
  rawSampleRows,
  rawPresentRows,
}: {
  confidence: FieldMappingConfidence;
  normalizedTotalRows: number;
  normalizedPresentRows: number;
  rawFields: readonly string[];
  rawSampleRows: number;
  rawPresentRows: number;
}): DataQualityStatus {
  if (confidence === "needs_review" || rawFields.length === 0) {
    return "warning";
  }

  if (normalizedTotalRows <= 0) {
    return "review";
  }

  const normalizedCoverage = coveragePercent(normalizedPresentRows, normalizedTotalRows);
  const rawCoverage =
    rawSampleRows > 0
      ? coveragePercent(rawPresentRows, rawSampleRows)
      : normalizedCoverage;
  const conservativeCoverage = Math.min(rawCoverage, normalizedCoverage);

  if (conservativeCoverage >= 99) {
    return "ok";
  }

  return conservativeCoverage < 90 ? "warning" : "review";
}

export function fieldMappingSourceTradeHref({
  importBatchId,
  sourceFileId,
  tradeFlow,
}: {
  sourceFileId: string;
  importBatchId?: string;
  tradeFlow: TradeFlow;
}) {
  return sourceTradeRecordsHref({ sourceFileId, importBatchId, tradeFlow });
}
