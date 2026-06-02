import {
  and,
  asc,
  count,
  eq,
  gt,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import type { DbClient } from "../db/client";
import {
  importBatches,
  rawTradeRows,
  sourceFiles,
  tradeRecords,
} from "../db/schema";
import { isUuid } from "../lib/ids";
import {
  clampTradeRecordLimit,
  clampTradeRecordOffset,
  encodeTradeRecordCursor,
  type TradeRecordCursor,
} from "./trade-record-pagination";
import { buildTradeRecordRelatedGroupDefinitions } from "./trade-record-related-groups";
import {
  exactMonthForRawOrderedList,
  tradeRecordOrderBy,
} from "./trade-record-ordering";
import { buildTradeRecordWhere } from "./trade-record-where";

export {
  decodeTradeRecordCursor,
  encodeTradeRecordCursor,
  type TradeRecordCursor,
} from "./trade-record-pagination";
export {
  compareTradeRecordGroups,
  emptyTradeRecordComparison,
  summarizeTradeRecords,
  type TradeRecordComparison,
  type TradeRecordComparisonRow,
  type TradeRecordIntelligenceSummary,
  type TradeRecordSummaryRank,
} from "./trade-record-analytics";
export { buildTradeRecordRelatedGroupDefinitions } from "./trade-record-related-groups";

export type TradeFlow = "import" | "export";
export type TradeRecordSort =
  | "source"
  | "item_value_desc"
  | "item_value_asc"
  | "declaration_fob_desc"
  | "quantity_desc"
  | "gross_weight_desc";

export type TradeRecordFilters = {
  tradeFlow?: TradeFlow;
  periodYear?: number;
  periodMonth?: number;
  periodFrom?: string;
  periodTo?: string;
  hsCodePrefix?: string;
  productQuery?: string;
  importerCorrelativeId?: string;
  exporterCorrelativeId?: string;
  originCountryCode?: string;
  destinationCountryCode?: string;
  customsOfficeCode?: string;
  transportModeCode?: string;
  portCode?: string;
  minItemValue?: string;
  maxItemValue?: string;
  minDeclarationFob?: string;
  maxDeclarationFob?: string;
  minQuantity?: string;
  maxQuantity?: string;
  minGrossWeightItem?: string;
  maxGrossWeightItem?: string;
  minGrossWeightTotal?: string;
  maxGrossWeightTotal?: string;
  sort?: TradeRecordSort;
  sourceFileId?: string;
  importBatchId?: string;
  limit?: number;
  offset?: number;
  afterCursor?: TradeRecordCursor;
};

export type TradeRecordSummary = {
  id: string;
  tradeFlow: string;
  periodYear: number;
  periodMonth: number;
  declarationIdRaw: string | null;
  itemNumber: number | null;
  acceptanceDate: string | null;
  importerCorrelativeId: string | null;
  exporterPrimaryCorrelativeId: string | null;
  exporterSecondaryCorrelativeId: string | null;
  hsCodeRaw: string | null;
  hsCodeNormalized: string | null;
  productDescriptionRaw: string | null;
  quantity: string | null;
  quantityUnitCode: string | null;
  grossWeightTotal: string | null;
  grossWeightItem: string | null;
  itemCifValue: string | null;
  itemFobValue: string | null;
  declarationFobValue: string | null;
  currencyCodeRaw: string | null;
  originCountryCode: string | null;
  acquisitionCountryCode: string | null;
  consignmentCountryCode: string | null;
  destinationCountryCode: string | null;
  destinationCountryLabelRaw: string | null;
  customsOfficeCode: string | null;
  embarkPortCode: string | null;
  embarkPortLabelRaw: string | null;
  disembarkPortCode: string | null;
  disembarkPortLabelRaw: string | null;
  transportModeCode: string | null;
  cargoTypeCode: string | null;
  sourceFileId: string;
  sourceFilename: string;
  importBatchId: string;
  importBatchStatus: string;
  rawTradeRowId: string;
  rawRowNumber: number;
  payloadRetentionMode: string;
  payloadRetainedReason: string | null;
  payloadReconstructable: boolean;
  parserName: string;
  parserVersion: string;
};

export type TradeRecordDetail = TradeRecordSummary & {
  productAttributes: unknown;
  freightValue: string | null;
  insuranceValue: string | null;
  cifValue: string | null;
  unitPriceValue: string | null;
  rawText: string | null;
  rawValues: unknown | null;
  payloadStorageKind: string;
  payloadHashSha256: string | null;
  payloadPrunedAt: Date | string | null;
};

export type TradeRecordListResult = {
  records: TradeRecordSummary[];
  total: number;
  limit: number;
  offset: number;
  nextCursor: string | null;
  paginationMode: "cursor" | "offset";
};

export type TradeRecordRelatedGroupKey =
  | "same_hs_flow"
  | "same_country_hs"
  | "same_participant"
  | "same_customs_office"
  | "same_relevant_port";

export type TradeRecordRelatedGroup = {
  key: TradeRecordRelatedGroupKey;
  title: string;
  description: string;
  filters: TradeRecordFilters;
  records: TradeRecordSummary[];
};
export type TradeRecordRelatedGroupDefinition = Omit<TradeRecordRelatedGroup, "records">;

const summaryColumns = {
  id: tradeRecords.id,
  tradeFlow: tradeRecords.tradeFlow,
  periodYear: tradeRecords.periodYear,
  periodMonth: tradeRecords.periodMonth,
  declarationIdRaw: tradeRecords.declarationIdRaw,
  itemNumber: tradeRecords.itemNumber,
  acceptanceDate: tradeRecords.acceptanceDate,
  importerCorrelativeId: tradeRecords.importerCorrelativeId,
  exporterPrimaryCorrelativeId: tradeRecords.exporterPrimaryCorrelativeId,
  exporterSecondaryCorrelativeId: tradeRecords.exporterSecondaryCorrelativeId,
  hsCodeRaw: tradeRecords.hsCodeRaw,
  hsCodeNormalized: tradeRecords.hsCodeNormalized,
  productDescriptionRaw: tradeRecords.productDescriptionRaw,
  quantity: tradeRecords.quantity,
  quantityUnitCode: tradeRecords.quantityUnitCode,
  grossWeightTotal: tradeRecords.grossWeightTotal,
  grossWeightItem: tradeRecords.grossWeightItem,
  itemCifValue: tradeRecords.itemCifValue,
  itemFobValue: tradeRecords.itemFobValue,
  declarationFobValue: tradeRecords.declarationFobValue,
  currencyCodeRaw: tradeRecords.currencyCodeRaw,
  originCountryCode: tradeRecords.originCountryCode,
  acquisitionCountryCode: tradeRecords.acquisitionCountryCode,
  consignmentCountryCode: tradeRecords.consignmentCountryCode,
  destinationCountryCode: tradeRecords.destinationCountryCode,
  destinationCountryLabelRaw: tradeRecords.destinationCountryLabelRaw,
  customsOfficeCode: tradeRecords.customsOfficeCode,
  embarkPortCode: tradeRecords.embarkPortCode,
  embarkPortLabelRaw: tradeRecords.embarkPortLabelRaw,
  disembarkPortCode: tradeRecords.disembarkPortCode,
  disembarkPortLabelRaw: tradeRecords.disembarkPortLabelRaw,
  transportModeCode: tradeRecords.transportModeCode,
  cargoTypeCode: tradeRecords.cargoTypeCode,
  sourceFileId: tradeRecords.sourceFileId,
  sourceFilename: sql<string>`coalesce(${sourceFiles.normalizedRawFilename}, ${sourceFiles.originalFilename})`,
  importBatchId: tradeRecords.importBatchId,
  importBatchStatus: importBatches.status,
  rawTradeRowId: tradeRecords.rawTradeRowId,
  rawRowNumber: rawTradeRows.rowNumber,
  payloadRetentionMode: rawTradeRows.payloadRetentionMode,
  payloadRetainedReason: rawTradeRows.payloadRetainedReason,
  payloadReconstructable: rawTradeRows.payloadReconstructable,
  parserName: tradeRecords.parserName,
  parserVersion: tradeRecords.parserVersion,
};

function baseSummaryQuery(db: DbClient) {
  return db
    .select(summaryColumns)
    .from(tradeRecords)
    .innerJoin(sourceFiles, eq(tradeRecords.sourceFileId, sourceFiles.id))
    .innerJoin(importBatches, eq(tradeRecords.importBatchId, importBatches.id))
    .innerJoin(rawTradeRows, eq(tradeRecords.rawTradeRowId, rawTradeRows.id));
}

function baseRawOrderedSummaryQuery(db: DbClient) {
  return db
    .select(summaryColumns)
    .from(rawTradeRows)
    .innerJoin(tradeRecords, eq(tradeRecords.rawTradeRowId, rawTradeRows.id))
    .innerJoin(sourceFiles, eq(tradeRecords.sourceFileId, sourceFiles.id))
    .innerJoin(importBatches, eq(tradeRecords.importBatchId, importBatches.id));
}

function rawCursorWhere(cursor: TradeRecordCursor): SQL {
  return or(
    gt(rawTradeRows.rowNumber, cursor.rawRowNumber),
    and(
      eq(rawTradeRows.rowNumber, cursor.rawRowNumber),
      gt(rawTradeRows.id, cursor.rawTradeRowId),
    ),
  )!;
}

export async function listTradeRecords(
  db: DbClient,
  filters: TradeRecordFilters = {},
): Promise<TradeRecordListResult> {
  const limit = clampTradeRecordLimit(filters.limit);
  const offset = clampTradeRecordOffset(filters.offset);
  const where = buildTradeRecordWhere(filters);
  const exactRawMonth = exactMonthForRawOrderedList(filters);
  const usesCursor = Boolean(filters.afterCursor);
  const paginationMode = exactRawMonth && offset === 0 ? "cursor" : "offset";

  const totalRows = await db
    .select({ total: count() })
    .from(tradeRecords)
    .where(where);
  const total = totalRows[0]?.total ?? 0;

  if (total === 0) {
    return {
      records: [],
      total,
      limit,
      offset,
      nextCursor: null,
      paginationMode,
    };
  }

  if (usesCursor && !exactRawMonth) {
    throw new Error("Cursor pagination requires a raw-row ordered exact-month query.");
  }

  const queryLimit = exactRawMonth ? limit + 1 : limit;

  const rawCursorCondition = filters.afterCursor
    ? rawCursorWhere(filters.afterCursor)
    : undefined;

  const rows = exactRawMonth
    ? await baseRawOrderedSummaryQuery(db)
        .where(
          and(
            eq(rawTradeRows.tradeFlow, exactRawMonth.tradeFlow),
            eq(rawTradeRows.periodYear, exactRawMonth.year),
            eq(rawTradeRows.periodMonth, exactRawMonth.month),
            where,
            rawCursorCondition,
          ),
        )
        .orderBy(asc(rawTradeRows.rowNumber), asc(rawTradeRows.id))
        .limit(queryLimit)
        .offset(usesCursor ? 0 : offset)
    : await baseSummaryQuery(db)
        .where(where)
        .orderBy(...tradeRecordOrderBy(filters))
        .limit(queryLimit)
        .offset(offset);

  const records = rows.slice(0, limit);
  const hasNextPage = rows.length > limit;
  const lastRecord = records.at(-1);
  const nextCursor =
    exactRawMonth && hasNextPage && lastRecord
      ? encodeTradeRecordCursor({
          rawRowNumber: lastRecord.rawRowNumber,
          rawTradeRowId: lastRecord.rawTradeRowId,
        })
      : null;

  return {
    records,
    total,
    limit,
    offset,
    nextCursor,
    paginationMode,
  };
}

export async function getTradeRecordById(
  db: DbClient,
  id: string,
): Promise<TradeRecordDetail | null> {
  if (!isUuid(id)) {
    return null;
  }

  const rows = await db
    .select({
      ...summaryColumns,
      productAttributes: tradeRecords.productAttributes,
      freightValue: tradeRecords.freightValue,
      insuranceValue: tradeRecords.insuranceValue,
      cifValue: tradeRecords.cifValue,
      unitPriceValue: tradeRecords.unitPriceValue,
      rawText: rawTradeRows.rawText,
      rawValues: rawTradeRows.rawValues,
      payloadStorageKind: rawTradeRows.payloadStorageKind,
      payloadHashSha256: rawTradeRows.payloadHashSha256,
      payloadPrunedAt: rawTradeRows.payloadPrunedAt,
    })
    .from(tradeRecords)
    .innerJoin(sourceFiles, eq(tradeRecords.sourceFileId, sourceFiles.id))
    .innerJoin(importBatches, eq(tradeRecords.importBatchId, importBatches.id))
    .innerJoin(rawTradeRows, eq(tradeRecords.rawTradeRowId, rawTradeRows.id))
    .where(eq(tradeRecords.id, id))
    .limit(1);

  return rows[0] ?? null;
}

async function listRelatedRecords(
  db: DbClient,
  currentRecordId: string,
  filters: TradeRecordFilters,
  limit: number,
): Promise<TradeRecordSummary[]> {
  const where = buildTradeRecordWhere(filters);

  return baseSummaryQuery(db)
    .where(and(where, ne(tradeRecords.id, currentRecordId)))
    .orderBy(...tradeRecordOrderBy({ ...filters, sort: "source" }))
    .limit(limit);
}

export async function listRelatedTradeRecords(
  db: DbClient,
  record: TradeRecordSummary,
  limit = 5,
): Promise<TradeRecordRelatedGroup[]> {
  const candidates = buildTradeRecordRelatedGroupDefinitions(record, limit);

  const groups = await Promise.all(
    candidates.map(async (group) => ({
      ...group,
      records: await listRelatedRecords(db, record.id, group.filters, limit),
    })),
  );

  return groups.filter((group) => group.records.length > 0);
}
