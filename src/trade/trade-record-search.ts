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
  emptyTradeRecordSummary,
  listTradeRecords,
  summarizeTradeRecords,
  type TradeRecordComparison,
  type TradeRecordIntelligenceSummary,
  type TradeRecordFilters,
  type TradeRecordListResult,
} from "./trade-records";
import type { TradeRecordWhereOptions } from "./trade-record-where";
import { parseTradeRecordPeriod } from "./trade-record-expressions";

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
  | "summary_bounded"
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

export function hasTradeRecordNarrowingFilter(filters: TradeRecordFilters) {
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

export function shouldSkipTradeRecordComparison(filters: TradeRecordFilters) {
  return !hasTradeRecordNarrowingFilter(filters);
}

function isExactSinglePeriod(filters: TradeRecordFilters) {
  if (filters.periodYear && filters.periodMonth) {
    return true;
  }

  if (!filters.periodFrom || !filters.periodTo) {
    return false;
  }

  return parseTradeRecordPeriod(filters.periodFrom).value === parseTradeRecordPeriod(filters.periodTo).value;
}

export function shouldSkipTradeRecordSummary(filters: TradeRecordFilters) {
  return !isExactSinglePeriod(filters) && !hasTradeRecordNarrowingFilter(filters);
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
  summaryBounded = false,
}: {
  filters: TradeRecordFilters;
  pagination: Pick<TradeRecordListResult, "paginationMode" | "total">;
  summaryMs: number;
  summaryBounded?: boolean;
}): TradeRecordPerformanceWarning[] {
  const warnings: TradeRecordPerformanceWarning[] = [];

  if (pagination.paginationMode === "offset") {
    warnings.push({
      code: "offset_pagination",
      message:
        "Esta búsqueda usa paginación por posición; puede ser más lenta en resultados grandes.",
    });
  }

  if (pagination.total >= 50000 && !hasTradeRecordNarrowingFilter(filters)) {
    warnings.push({
      code: "broad_result_set",
      message:
        "La búsqueda cubre un conjunto amplio de registros; agrega filtros comerciales, geográficos o logísticos para acotarla.",
    });
  }

  if (summaryBounded) {
    warnings.push({
      code: "summary_bounded",
      message:
        "El resumen detallado se acotó para esta búsqueda amplia; agrega filtros o usa un solo período para ver rankings y totales completos.",
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
  options: TradeRecordWhereOptions = {},
): Promise<TradeRecordSearchResponse> {
  const totalStartedAt = performance.now();
  const filters = parseTradeRecordSearchParams(input);
  const skipSummary = shouldSkipTradeRecordSummary(filters);
  const skipComparison = shouldSkipTradeRecordComparison(filters);

  if (skipSummary) {
    const listResult = await timed(() => listTradeRecords(db, filters, options));
    const result = listResult.value;
    const labelsResult = await timed(() => enrichTradeRecordsWithLabels(db, result.records));
    const records = labelsResult.value;
    const summary = emptyTradeRecordSummary(result.total, "broad_multi_month_result_set");
    const timingMs = {
      total: roundMilliseconds(performance.now() - totalStartedAt),
      list: listResult.durationMs,
      summary: 0,
      comparison: 0,
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
      comparison: emptyTradeRecordComparison("broad_result_set"),
      meta: {
        timingMs,
        performanceWarnings: classifyTradeRecordPerformanceWarnings({
          filters,
          pagination: result,
          summaryMs: 0,
          summaryBounded: true,
        }),
      },
    };
  }

  const [listResult, summaryResult, comparisonResult] = await Promise.all([
    timed(() => listTradeRecords(db, filters, options)),
    timed(() => summarizeTradeRecords(db, filters, options)),
    skipComparison
      ? Promise.resolve({
          durationMs: 0,
          value: emptyTradeRecordComparison("broad_result_set"),
        })
      : timed(() => compareTradeRecordGroups(db, filters, 6, options)),
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
