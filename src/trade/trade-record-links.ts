import { normalizeUuid } from "../lib/ids";
import type { TradeFlow, TradeRecordFilters } from "./trade-records";

export type TradeRecordSearchHrefParams =
  | URLSearchParams
  | Record<string, string | string[] | undefined>;

export type TradeRecordDrilldownTarget =
  | { type: "country"; code: string; tradeFlow?: TradeFlow }
  | { type: "customsOffice"; code: string }
  | { type: "port"; code: string }
  | { type: "hsCodePrefix"; code: string }
  | { type: "importer"; code: string }
  | { type: "exporter"; code: string };

const knownSearchKeys = [
  "tradeFlow",
  "periodFrom",
  "periodTo",
  "periodYear",
  "periodMonth",
  "sourceFileId",
  "importBatchId",
  "hsCodePrefix",
  "q",
  "importer",
  "exporter",
  "originCountry",
  "destinationCountry",
  "customsOffice",
  "transportMode",
  "port",
  "minItemValue",
  "maxItemValue",
  "minDeclarationFob",
  "maxDeclarationFob",
  "minQuantity",
  "maxQuantity",
  "minGrossWeightItem",
  "maxGrossWeightItem",
  "minGrossWeightTotal",
  "maxGrossWeightTotal",
  "sort",
  "limit",
] as const;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function readParam(
  params: TradeRecordSearchHrefParams,
  key: string,
): string | undefined {
  if (params instanceof URLSearchParams) {
    return params.get(key) ?? undefined;
  }

  return firstValue(params[key]);
}

function normalizedFlow(value: string | undefined): TradeFlow | undefined {
  return value === "import" || value === "export" ? value : undefined;
}

function setIfPresent(query: URLSearchParams, key: string, value: string | undefined) {
  const trimmed = value?.trim();
  if (trimmed) {
    query.set(key, trimmed);
  }
}

function safeSearchParam(key: string, value: string | undefined) {
  if (key === "sourceFileId" || key === "importBatchId") {
    return value ? normalizeUuid(value) ?? undefined : undefined;
  }

  return value;
}

function applyTarget(
  query: URLSearchParams,
  baseFlow: TradeFlow | undefined,
  target: TradeRecordDrilldownTarget,
) {
  switch (target.type) {
    case "country": {
      const targetFlow = target.tradeFlow ?? baseFlow;
      if (targetFlow === "export") {
        query.delete("originCountry");
        query.set("destinationCountry", target.code);
      } else {
        query.delete("destinationCountry");
        query.set("originCountry", target.code);
      }
      break;
    }
    case "customsOffice":
      query.set("customsOffice", target.code);
      break;
    case "port":
      query.set("port", target.code);
      break;
    case "hsCodePrefix":
      query.set("hsCodePrefix", target.code);
      break;
    case "importer":
      query.delete("exporter");
      query.set("importer", target.code);
      break;
    case "exporter":
      query.delete("importer");
      query.set("exporter", target.code);
      break;
  }
}

export function buildTradeRecordSearchHref(
  params: TradeRecordSearchHrefParams,
  target?: TradeRecordDrilldownTarget,
) {
  const query = new URLSearchParams();

  for (const key of knownSearchKeys) {
    setIfPresent(query, key, safeSearchParam(key, readParam(params, key)));
  }

  if (target) {
    applyTarget(query, normalizedFlow(readParam(params, "tradeFlow")), target);
  }

  const text = query.toString();
  return text ? `/trade-records?${text}` : "/trade-records";
}

export function filtersToTradeRecordSearchParams(filters: TradeRecordFilters) {
  const params: Record<string, string> = {};

  if (filters.tradeFlow) params.tradeFlow = filters.tradeFlow;
  if (filters.periodFrom) params.periodFrom = filters.periodFrom;
  if (filters.periodTo) params.periodTo = filters.periodTo;
  if (filters.periodYear) params.periodYear = String(filters.periodYear);
  if (filters.periodMonth) params.periodMonth = String(filters.periodMonth);
  if (filters.sourceFileId) params.sourceFileId = filters.sourceFileId;
  if (filters.importBatchId) params.importBatchId = filters.importBatchId;
  if (filters.hsCodePrefix) params.hsCodePrefix = filters.hsCodePrefix;
  if (filters.productQuery) params.q = filters.productQuery;
  if (filters.importerCorrelativeId) params.importer = filters.importerCorrelativeId;
  if (filters.exporterCorrelativeId) params.exporter = filters.exporterCorrelativeId;
  if (filters.originCountryCode) params.originCountry = filters.originCountryCode;
  if (filters.destinationCountryCode) params.destinationCountry = filters.destinationCountryCode;
  if (filters.customsOfficeCode) params.customsOffice = filters.customsOfficeCode;
  if (filters.transportModeCode) params.transportMode = filters.transportModeCode;
  if (filters.portCode) params.port = filters.portCode;
  if (filters.minItemValue) params.minItemValue = filters.minItemValue;
  if (filters.maxItemValue) params.maxItemValue = filters.maxItemValue;
  if (filters.minDeclarationFob) params.minDeclarationFob = filters.minDeclarationFob;
  if (filters.maxDeclarationFob) params.maxDeclarationFob = filters.maxDeclarationFob;
  if (filters.minQuantity) params.minQuantity = filters.minQuantity;
  if (filters.maxQuantity) params.maxQuantity = filters.maxQuantity;
  if (filters.minGrossWeightItem) params.minGrossWeightItem = filters.minGrossWeightItem;
  if (filters.maxGrossWeightItem) params.maxGrossWeightItem = filters.maxGrossWeightItem;
  if (filters.minGrossWeightTotal) params.minGrossWeightTotal = filters.minGrossWeightTotal;
  if (filters.maxGrossWeightTotal) params.maxGrossWeightTotal = filters.maxGrossWeightTotal;
  if (filters.sort) params.sort = filters.sort;
  if (filters.limit) params.limit = String(filters.limit);

  return params;
}
