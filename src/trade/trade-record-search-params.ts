import { normalizeUuid } from "@/lib/ids";
import { normalizePublicSearchText } from "@/text/public-text";
import {
  decodeTradeRecordCursor,
  type TradeFlow,
  type TradeRecordFilters,
  type TradeRecordLogisticsRole,
} from "@/trade/trade-records";
import {
  isTradeRecordSort,
  type TradeRecordSort,
} from "@/trade/trade-record-sort";

export type TradeRecordSearchInput =
  | URLSearchParams
  | Record<string, string | string[] | undefined>;

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

function valuesFor(input: TradeRecordSearchInput, key: string): string[] {
  if (input instanceof URLSearchParams) {
    return input.getAll(key);
  }

  const value = input[key];
  if (Array.isArray(value)) {
    return value;
  }

  return value ? [value] : [];
}

function text(input: TradeRecordSearchInput, key: string): string | undefined {
  const value = valueFor(input, key)?.trim();
  return value ? value : undefined;
}

function productSearchQuery(input: TradeRecordSearchInput): string | undefined {
  const value = text(input, "q");
  if (!value) {
    return undefined;
  }

  const normalized = normalizePublicSearchText(value);

  return normalized || undefined;
}

function codeLookup(input: TradeRecordSearchInput, key: string): string | undefined {
  const value = text(input, key);
  if (!value) {
    return undefined;
  }

  return codeFromLookupValue(value);
}

function codeFromLookupValue(value: string): string {
  const displayValueMatch = /^([A-Za-z0-9_-]+)\s*[·-]\s+/.exec(value);
  return displayValueMatch?.[1] ?? value;
}

function codeListLookup(input: TradeRecordSearchInput, key: string): string[] | undefined {
  const codes: string[] = [];
  const seen = new Set<string>();

  for (const value of valuesFor(input, key)) {
    for (const fragment of value.split(",")) {
      const trimmed = fragment.trim();
      if (!trimmed) {
        continue;
      }

      const code = codeFromLookupValue(trimmed);
      if (!seen.has(code)) {
        codes.push(code);
        seen.add(code);
      }
    }
  }

  return codes.length > 0 ? codes : undefined;
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

function nonNegativeInteger(
  input: TradeRecordSearchInput,
  key: string,
): number | undefined {
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

  if (!isTradeRecordSort(value)) {
    throw new TradeRecordSearchError("sort is not supported.");
  }

  return value;
}

function logisticsRole(input: TradeRecordSearchInput): TradeRecordLogisticsRole | undefined {
  const value = text(input, "logisticsRole");
  if (!value) {
    return undefined;
  }

  if (value !== "issuer" && value !== "carrier") {
    throw new TradeRecordSearchError("logisticsRole must be issuer or carrier.");
  }

  return value;
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

export function parseTradeRecordSearchParams(
  input: TradeRecordSearchInput,
): TradeRecordFilters {
  const afterCursor = cursor(input);
  const hasOffsetParam = text(input, "offset") !== undefined;
  const offset = nonNegativeInteger(input, "offset");
  const originCountryCodes = codeListLookup(input, "originCountry");
  const destinationCountryCodes = codeListLookup(input, "destinationCountry");

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
    productQuery: productSearchQuery(input),
    importerCorrelativeId: text(input, "importer"),
    exporterCorrelativeId: text(input, "exporter"),
    originCountryCode: originCountryCodes?.[0],
    originCountryCodes,
    destinationCountryCode: destinationCountryCodes?.[0],
    destinationCountryCodes,
    customsOfficeCode: codeLookup(input, "customsOffice"),
    transportModeCode: codeLookup(input, "transportMode"),
    embarkPortCode: codeLookup(input, "embarkPort"),
    disembarkPortCode: codeLookup(input, "disembarkPort"),
    cargoTypeCode: codeLookup(input, "cargoType"),
    logisticsPartyId: uuid(input, "logisticsParty"),
    logisticsRole: logisticsRole(input),
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
      throw new TradeRecordSearchError(
        `${minKey} must be less than or equal to ${maxKey}.`,
      );
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
      filters.logisticsPartyId ||
      filters.logisticsRole ||
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
