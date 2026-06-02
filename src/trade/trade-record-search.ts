import type { DbClient } from "../db/client";
import { normalizeUuid } from "../lib/ids";
import {
  enrichTradeRecordsWithLabels,
  type TradeRecordWithLabels,
} from "./trade-record-labels";
import {
  compareTradeRecordGroups,
  decodeTradeRecordCursor,
  emptyTradeRecordComparison,
  listTradeRecords,
  summarizeTradeRecords,
  type TradeRecordComparison,
  type TradeRecordIntelligenceSummary,
  type TradeFlow,
  type TradeRecordFilters,
  type TradeRecordListResult,
  type TradeRecordSort,
} from "./trade-records";

export type TradeRecordSearchInput =
  | URLSearchParams
  | Record<string, string | string[] | undefined>;

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

export class TradeRecordSearchError extends Error {
  readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = "TradeRecordSearchError";
  }
}

function valueFor(input: TradeRecordSearchInput, key: string): string | undefined {
  if (input instanceof URLSearchParams) {
    return input.get(key) ?? undefined;
  }

  const value = input[key];
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function text(input: TradeRecordSearchInput, key: string): string | undefined {
  const value = valueFor(input, key)?.trim();
  return value ? value : undefined;
}

function codeLookup(input: TradeRecordSearchInput, key: string): string | undefined {
  const value = text(input, key);
  if (!value) {
    return undefined;
  }

  const displayValueMatch = /^([A-Za-z0-9_-]+)\s*[·-]\s+/.exec(value);
  return displayValueMatch?.[1] ?? value;
}

function positiveInteger(input: TradeRecordSearchInput, key: string): number | undefined {
  const value = text(input, key);
  if (!value) {
    return undefined;
  }

  if (!/^\d+$/.test(value)) {
    throw new TradeRecordSearchError(`${key} must be a positive integer.`);
  }

  const parsed = Number.parseInt(value, 10);
  if (parsed < 1) {
    throw new TradeRecordSearchError(`${key} must be a positive integer.`);
  }

  return parsed;
}

function nonNegativeInteger(input: TradeRecordSearchInput, key: string): number | undefined {
  const value = text(input, key);
  if (!value) {
    return undefined;
  }

  if (!/^\d+$/.test(value)) {
    throw new TradeRecordSearchError(`${key} must be a non-negative integer.`);
  }

  return Number.parseInt(value, 10);
}

function decimal(input: TradeRecordSearchInput, key: string): string | undefined {
  const value = text(input, key);
  if (!value) {
    return undefined;
  }

  const normalized = value.replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new TradeRecordSearchError(`${key} must be a positive decimal number.`);
  }

  return normalized;
}

function uuid(input: TradeRecordSearchInput, key: string): string | undefined {
  const value = text(input, key);
  if (!value) {
    return undefined;
  }

  const normalized = normalizeUuid(value);
  if (!normalized) {
    throw new TradeRecordSearchError(`${key} must be a valid UUID.`);
  }

  return normalized;
}

function tradeFlow(input: TradeRecordSearchInput): TradeFlow | undefined {
  const value = text(input, "tradeFlow");
  if (!value) {
    return undefined;
  }

  if (value !== "import" && value !== "export") {
    throw new TradeRecordSearchError("tradeFlow must be import or export.");
  }

  return value;
}

function tradeRecordSort(input: TradeRecordSearchInput): TradeRecordSort | undefined {
  const value = text(input, "sort");
  if (!value) {
    return undefined;
  }

  const validSorts = [
    "source",
    "item_value_desc",
    "item_value_asc",
    "declaration_fob_desc",
    "quantity_desc",
    "gross_weight_desc",
  ] satisfies TradeRecordSort[];

  if (!validSorts.includes(value as TradeRecordSort)) {
    throw new TradeRecordSearchError("sort is not supported.");
  }

  return value as TradeRecordSort;
}

function period(input: TradeRecordSearchInput, key: "periodFrom" | "periodTo") {
  const value = text(input, key);
  if (!value) {
    return undefined;
  }

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    throw new TradeRecordSearchError(`${key} must use YYYY-MM format.`);
  }

  return value;
}

function cursor(input: TradeRecordSearchInput) {
  const value = text(input, "after");
  if (!value) {
    return undefined;
  }

  try {
    return decodeTradeRecordCursor(value);
  } catch (error) {
    if (error instanceof Error) {
      throw new TradeRecordSearchError(error.message);
    }

    throw new TradeRecordSearchError("Cursor is invalid.");
  }
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

export function parseTradeRecordSearchParams(
  input: TradeRecordSearchInput,
): TradeRecordFilters {
  const afterCursor = cursor(input);
  const hasOffsetParam = text(input, "offset") !== undefined;
  const offset = nonNegativeInteger(input, "offset");

  if (afterCursor && hasOffsetParam) {
    throw new TradeRecordSearchError("Use either after or offset, not both.");
  }

  const filters: TradeRecordFilters = {
    tradeFlow: tradeFlow(input),
    periodYear: positiveInteger(input, "periodYear"),
    periodMonth: positiveInteger(input, "periodMonth"),
    periodFrom: period(input, "periodFrom"),
    periodTo: period(input, "periodTo"),
    hsCodePrefix: text(input, "hsCodePrefix"),
    productQuery: text(input, "q"),
    importerCorrelativeId: text(input, "importer"),
    exporterCorrelativeId: text(input, "exporter"),
    originCountryCode: codeLookup(input, "originCountry"),
    destinationCountryCode: codeLookup(input, "destinationCountry"),
    customsOfficeCode: codeLookup(input, "customsOffice"),
    transportModeCode: codeLookup(input, "transportMode"),
    portCode: codeLookup(input, "port"),
    minItemValue: decimal(input, "minItemValue"),
    maxItemValue: decimal(input, "maxItemValue"),
    minDeclarationFob: decimal(input, "minDeclarationFob"),
    maxDeclarationFob: decimal(input, "maxDeclarationFob"),
    minQuantity: decimal(input, "minQuantity"),
    maxQuantity: decimal(input, "maxQuantity"),
    minGrossWeightItem: decimal(input, "minGrossWeightItem"),
    maxGrossWeightItem: decimal(input, "maxGrossWeightItem"),
    minGrossWeightTotal: decimal(input, "minGrossWeightTotal"),
    maxGrossWeightTotal: decimal(input, "maxGrossWeightTotal"),
    sort: tradeRecordSort(input),
    sourceFileId: uuid(input, "sourceFileId"),
    importBatchId: uuid(input, "importBatchId"),
    limit: positiveInteger(input, "limit"),
    offset,
    afterCursor,
  };

  if (filters.periodMonth && (filters.periodMonth < 1 || filters.periodMonth > 12)) {
    throw new TradeRecordSearchError("periodMonth must be between 1 and 12.");
  }

  const numericPairs = [
    ["minItemValue", "maxItemValue"],
    ["minDeclarationFob", "maxDeclarationFob"],
    ["minQuantity", "maxQuantity"],
    ["minGrossWeightItem", "maxGrossWeightItem"],
    ["minGrossWeightTotal", "maxGrossWeightTotal"],
  ] as const;

  for (const [minKey, maxKey] of numericPairs) {
    const minValue = filters[minKey];
    const maxValue = filters[maxKey];
    if (minValue && maxValue && Number(minValue) > Number(maxValue)) {
      throw new TradeRecordSearchError(`${minKey} must be less than or equal to ${maxKey}.`);
    }
  }

  const hasRangeFilter = numericPairs.some(
    ([minKey, maxKey]) => Boolean(filters[minKey]) || Boolean(filters[maxKey]),
  );

  const hasExactPeriod =
    Boolean(filters.periodYear && filters.periodMonth) ||
    Boolean(filters.periodFrom && filters.periodTo && filters.periodFrom === filters.periodTo);

  if (
    afterCursor &&
    (!filters.tradeFlow ||
      !hasExactPeriod ||
      filters.productQuery ||
      filters.importerCorrelativeId ||
      filters.exporterCorrelativeId ||
      filters.sourceFileId ||
      filters.importBatchId ||
      hasRangeFilter ||
      (filters.sort && filters.sort !== "source"))
  ) {
    throw new TradeRecordSearchError(
      "Cursor pagination requires tradeFlow, one exact period, and supported structured filters.",
    );
  }

  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined),
  ) as TradeRecordFilters;
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
