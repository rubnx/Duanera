import type { DbClient } from "../db/client";
import {
  enrichTradeRecordsWithLabels,
  type TradeRecordWithLabels,
} from "./trade-record-labels";
import {
  parseTradeRecordSearchParams,
  type TradeRecordSearchInput,
} from "./trade-record-search-params";
import {
  compareTradeRecordGroups,
  emptyTradeRecordComparison,
  listTradeRecords,
  summarizeTradeRecords,
  type TradeRecordComparison,
  type TradeRecordIntelligenceSummary,
  type TradeRecordFilters,
  type TradeRecordListResult,
} from "./trade-records";

export {
  parseTradeRecordSearchParams,
  TradeRecordSearchError,
  type TradeRecordSearchInput,
} from "./trade-record-search-params";

export type TradeRecordSearchResponse = {
  data: Array<TradeRecordWithLabels<TradeRecordListResult["records"][number]>>;
  pagination: {
    total: number;
    limit: number;
    offset: number;
    nextCursor: string | null;
    paginationMode: "cursor" | "offset";
  };
  filters: TradeRecordFilters;
  summary: TradeRecordIntelligenceSummary;
  comparison: TradeRecordComparison;
  meta: {
    timingMs: TradeRecordSearchTiming;
    performanceWarnings: TradeRecordPerformanceWarning[];
  };
};

export type TradeRecordSearchTiming = {
  total: number;
  list: number;
  summary: number;
  comparison: number;
  labels: number;
};

export type TradeRecordPerformanceWarningCode =
  | "offset_pagination"
  | "broad_result_set"
  | "slow_summary";

export type TradeRecordPerformanceWarning = {
  code: TradeRecordPerformanceWarningCode;
  message: string;
};

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

function hasNarrowingFilter(filters: TradeRecordFilters) {
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

export function shouldSkipTradeRecordComparison(filters: TradeRecordFilters) {
  return !hasNarrowingFilter(filters);
}

function roundMilliseconds(value: number) {
  return Math.max(0, Math.round(value));
}

async function timed<T>(work: () => Promise<T>): Promise<{ durationMs: number; value: T }> {
  const startedAt = performance.now();
  const value = await work();

  return {
    durationMs: roundMilliseconds(performance.now() - startedAt),
    value,
  };
}

export function classifyTradeRecordPerformanceWarnings({
  filters,
  pagination,
  summaryMs,
}: {
  filters: TradeRecordFilters;
  pagination: Pick<TradeRecordListResult, "paginationMode" | "total">;
  summaryMs: number;
}): TradeRecordPerformanceWarning[] {
  const warnings: TradeRecordPerformanceWarning[] = [];

  if (pagination.paginationMode === "offset") {
    warnings.push({
      code: "offset_pagination",
      message:
        "Esta búsqueda usa paginación por posición; puede ser más lenta en resultados grandes.",
    });
  }

  if (pagination.total >= 50000 && !hasNarrowingFilter(filters)) {
    warnings.push({
      code: "broad_result_set",
      message:
        "La búsqueda cubre un conjunto amplio de registros; agrega filtros comerciales, geográficos o logísticos para acotarla.",
    });
  }

  if (summaryMs >= 1500) {
    warnings.push({
      code: "slow_summary",
      message:
        "El resumen agregado tardó más de lo esperado en Postgres MVP; úsalo como orientación operativa para esta demo.",
    });
  }

  return warnings;
}

export async function searchTradeRecords(
  db: DbClient,
  input: TradeRecordSearchInput,
): Promise<TradeRecordSearchResponse> {
  const totalStartedAt = performance.now();
  const filters = parseTradeRecordSearchParams(input);
  const skipComparison = shouldSkipTradeRecordComparison(filters);
  const [listResult, summaryResult, comparisonResult] = await Promise.all([
    timed(() => listTradeRecords(db, filters)),
    timed(() => summarizeTradeRecords(db, filters)),
    skipComparison
      ? Promise.resolve({
          durationMs: 0,
          value: emptyTradeRecordComparison("broad_result_set"),
        })
      : timed(() => compareTradeRecordGroups(db, filters)),
  ]);
  const result = listResult.value;
  const summary = summaryResult.value;
  const comparison = comparisonResult.value;
  const labelsResult = await timed(() => enrichTradeRecordsWithLabels(db, result.records));
  const records = labelsResult.value;
  const timingMs = {
    total: roundMilliseconds(performance.now() - totalStartedAt),
    list: listResult.durationMs,
    summary: summaryResult.durationMs,
    comparison: comparisonResult.durationMs,
    labels: labelsResult.durationMs,
  };

  return {
    data: records,
    pagination: {
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      nextCursor: result.nextCursor,
      paginationMode: result.paginationMode,
    },
    filters,
    summary,
    comparison,
    meta: {
      timingMs,
      performanceWarnings: classifyTradeRecordPerformanceWarnings({
        filters,
        pagination: result,
        summaryMs: timingMs.summary + timingMs.comparison,
      }),
    },
  };
}
