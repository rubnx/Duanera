import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  gt,
  ilike,
  like,
  lte,
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

export type TradeRecordCursor = {
  rawRowNumber: number;
  rawTradeRowId: string;
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
};

export type TradeRecordDetail = TradeRecordSummary & {
  productAttributes: unknown;
  freightValue: string | null;
  insuranceValue: string | null;
  cifValue: string | null;
  unitPriceValue: string | null;
  rawText: string | null;
  rawValues: unknown | null;
  payloadRetentionMode: string;
  payloadStorageKind: string;
  payloadHashSha256: string | null;
  payloadRetainedReason: string | null;
  payloadPrunedAt: Date | string | null;
  payloadReconstructable: boolean;
  parserName: string;
  parserVersion: string;
};

export type TradeRecordListResult = {
  records: TradeRecordSummary[];
  total: number;
  limit: number;
  offset: number;
  nextCursor: string | null;
  paginationMode: "cursor" | "offset";
};

export type TradeRecordSummaryRank = {
  code: string;
  labelRaw: string | null;
  records: number;
  totalItemValue: string | null;
};

export type TradeRecordIntelligenceSummary = {
  totals: {
    records: number;
    itemValue: string | null;
    declarationFobValue: string | null;
    quantity: string | null;
    quantityUnitCode: string | null;
    quantityUnitIsMixed: boolean;
    grossWeightItem: string | null;
    grossWeightTotal: string | null;
    currencyCode: string | null;
    currencyIsMixed: boolean;
  };
  rankings: {
    countries: TradeRecordSummaryRank[];
    customsOffices: TradeRecordSummaryRank[];
    ports: TradeRecordSummaryRank[];
    hsCodes: TradeRecordSummaryRank[];
  };
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

const defaultLimit = 50;
const maxLimit = 200;

function clampLimit(limit: number | undefined): number {
  if (!limit) {
    return defaultLimit;
  }

  if (!Number.isFinite(limit) || limit <= 0) {
    return defaultLimit;
  }

  return Math.min(Math.trunc(limit), maxLimit);
}

function clampOffset(offset: number | undefined): number {
  if (!offset || !Number.isFinite(offset) || offset < 0) {
    return 0;
  }

  return Math.trunc(offset);
}

export function encodeTradeRecordCursor(cursor: TradeRecordCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeTradeRecordCursor(value: string): TradeRecordCursor {
  let decoded: unknown;

  try {
    decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    throw new Error("Cursor is invalid.");
  }

  if (
    typeof decoded !== "object" ||
    decoded === null ||
    !("rawRowNumber" in decoded) ||
    !("rawTradeRowId" in decoded)
  ) {
    throw new Error("Cursor is invalid.");
  }

  const rawRowNumber = Number((decoded as { rawRowNumber: unknown }).rawRowNumber);
  const rawTradeRowId = (decoded as { rawTradeRowId: unknown }).rawTradeRowId;

  if (
    !Number.isInteger(rawRowNumber) ||
    rawRowNumber < 0 ||
    typeof rawTradeRowId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      rawTradeRowId,
    )
  ) {
    throw new Error("Cursor is invalid.");
  }

  return {
    rawRowNumber,
    rawTradeRowId: rawTradeRowId.toLowerCase(),
  };
}

function periodNumber(year: number, month: number): number {
  return year * 100 + month;
}

type ParsedPeriod = {
  year: number;
  month: number;
  value: number;
};

function parsePeriod(value: string): ParsedPeriod {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) {
    throw new Error(`Period must use YYYY-MM format, got ${value}.`);
  }

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  if (month < 1 || month > 12) {
    throw new Error(`Period month must be between 01 and 12, got ${value}.`);
  }

  return {
    year,
    month,
    value: periodNumber(year, month),
  };
}

function periodTupleExpression(): SQL<number> {
  return sql<number>`(${tradeRecords.periodYear}, ${tradeRecords.periodMonth})`;
}

function itemValueExpression(filters: TradeRecordFilters): SQL<string> {
  if (filters.tradeFlow === "import") {
    return sql<string>`${tradeRecords.itemCifValue}`;
  }

  if (filters.tradeFlow === "export") {
    return sql<string>`${tradeRecords.itemFobValue}`;
  }

  return sql<string>`case when ${tradeRecords.tradeFlow} = 'import' then ${tradeRecords.itemCifValue} else ${tradeRecords.itemFobValue} end`;
}

function grossWeightExpression(): SQL<string> {
  return sql<string>`coalesce(${tradeRecords.grossWeightItem}, ${tradeRecords.grossWeightTotal})`;
}

function originOrDestinationCountryExpression(filters: TradeRecordFilters): SQL<string> {
  if (filters.tradeFlow === "import") {
    return sql<string>`${tradeRecords.originCountryCode}`;
  }

  if (filters.tradeFlow === "export") {
    return sql<string>`${tradeRecords.destinationCountryCode}`;
  }

  return sql<string>`case when ${tradeRecords.tradeFlow} = 'import' then ${tradeRecords.originCountryCode} else ${tradeRecords.destinationCountryCode} end`;
}

function relevantPortExpression(filters: TradeRecordFilters): SQL<string> {
  if (filters.tradeFlow === "import") {
    return sql<string>`${tradeRecords.disembarkPortCode}`;
  }

  if (filters.tradeFlow === "export") {
    return sql<string>`${tradeRecords.embarkPortCode}`;
  }

  return sql<string>`case when ${tradeRecords.tradeFlow} = 'import' then ${tradeRecords.disembarkPortCode} else ${tradeRecords.embarkPortCode} end`;
}

function relevantPortLabelExpression(filters: TradeRecordFilters): SQL<string> {
  if (filters.tradeFlow === "import") {
    return sql<string>`${tradeRecords.disembarkPortLabelRaw}`;
  }

  if (filters.tradeFlow === "export") {
    return sql<string>`${tradeRecords.embarkPortLabelRaw}`;
  }

  return sql<string>`case when ${tradeRecords.tradeFlow} = 'import' then ${tradeRecords.disembarkPortLabelRaw} else ${tradeRecords.embarkPortLabelRaw} end`;
}

function hsCodePrefixExpression(): SQL<string> {
  return sql<string>`substring(${tradeRecords.hsCodeNormalized} from 1 for 6)`;
}

function gteDecimal(expression: SQL<string>, value: string): SQL {
  return sql`${expression} >= ${value}`;
}

function lteDecimal(expression: SQL<string>, value: string): SQL {
  return sql`${expression} <= ${value}`;
}

function buildWhere(filters: TradeRecordFilters): SQL | undefined {
  const conditions: SQL[] = [];

  if (filters.tradeFlow) {
    conditions.push(eq(tradeRecords.tradeFlow, filters.tradeFlow));
  }

  if (filters.periodYear) {
    conditions.push(eq(tradeRecords.periodYear, filters.periodYear));
  }

  if (filters.periodMonth) {
    conditions.push(eq(tradeRecords.periodMonth, filters.periodMonth));
  }

  const periodFrom = filters.periodFrom ? parsePeriod(filters.periodFrom) : undefined;
  const periodTo = filters.periodTo ? parsePeriod(filters.periodTo) : undefined;

  if (filters.periodFrom) {
    if (periodFrom && periodTo && periodFrom.value === periodTo.value) {
      conditions.push(eq(tradeRecords.periodYear, periodFrom.year));
      conditions.push(eq(tradeRecords.periodMonth, periodFrom.month));
    } else if (periodFrom) {
      conditions.push(
        sql`${periodTupleExpression()} >= (${periodFrom.year}, ${periodFrom.month})`,
      );
    }
  }

  if (filters.periodTo && (!periodFrom || !periodTo || periodFrom.value !== periodTo.value)) {
    if (periodTo) {
      conditions.push(
        sql`${periodTupleExpression()} <= (${periodTo.year}, ${periodTo.month})`,
      );
    }
  }

  if (filters.hsCodePrefix) {
    conditions.push(like(tradeRecords.hsCodeNormalized, `${filters.hsCodePrefix}%`));
  }

  if (filters.productQuery) {
    conditions.push(ilike(tradeRecords.productSearchText, `%${filters.productQuery}%`));
  }

  if (filters.importerCorrelativeId) {
    conditions.push(eq(tradeRecords.importerCorrelativeId, filters.importerCorrelativeId));
  }

  if (filters.exporterCorrelativeId) {
    conditions.push(
      or(
        eq(tradeRecords.exporterPrimaryCorrelativeId, filters.exporterCorrelativeId),
        eq(tradeRecords.exporterSecondaryCorrelativeId, filters.exporterCorrelativeId),
      )!,
    );
  }

  if (filters.originCountryCode) {
    conditions.push(eq(tradeRecords.originCountryCode, filters.originCountryCode));
  }

  if (filters.destinationCountryCode) {
    conditions.push(eq(tradeRecords.destinationCountryCode, filters.destinationCountryCode));
  }

  if (filters.customsOfficeCode) {
    conditions.push(eq(tradeRecords.customsOfficeCode, filters.customsOfficeCode));
  }

  if (filters.transportModeCode) {
    conditions.push(eq(tradeRecords.transportModeCode, filters.transportModeCode));
  }

  if (filters.portCode) {
    if (filters.tradeFlow === "import") {
      conditions.push(eq(tradeRecords.disembarkPortCode, filters.portCode));
    } else if (filters.tradeFlow === "export") {
      conditions.push(eq(tradeRecords.embarkPortCode, filters.portCode));
    } else {
      conditions.push(
        or(
          eq(tradeRecords.embarkPortCode, filters.portCode),
          eq(tradeRecords.disembarkPortCode, filters.portCode),
        )!,
      );
    }
  }

  const itemValue = itemValueExpression(filters);
  if (filters.minItemValue) {
    conditions.push(gteDecimal(itemValue, filters.minItemValue));
  }
  if (filters.maxItemValue) {
    conditions.push(lteDecimal(itemValue, filters.maxItemValue));
  }

  if (filters.minDeclarationFob) {
    conditions.push(gte(tradeRecords.declarationFobValue, filters.minDeclarationFob));
  }
  if (filters.maxDeclarationFob) {
    conditions.push(lte(tradeRecords.declarationFobValue, filters.maxDeclarationFob));
  }

  if (filters.minQuantity) {
    conditions.push(gte(tradeRecords.quantity, filters.minQuantity));
  }
  if (filters.maxQuantity) {
    conditions.push(lte(tradeRecords.quantity, filters.maxQuantity));
  }

  if (filters.minGrossWeightItem) {
    conditions.push(gte(tradeRecords.grossWeightItem, filters.minGrossWeightItem));
  }
  if (filters.maxGrossWeightItem) {
    conditions.push(lte(tradeRecords.grossWeightItem, filters.maxGrossWeightItem));
  }

  if (filters.minGrossWeightTotal) {
    conditions.push(gte(tradeRecords.grossWeightTotal, filters.minGrossWeightTotal));
  }
  if (filters.maxGrossWeightTotal) {
    conditions.push(lte(tradeRecords.grossWeightTotal, filters.maxGrossWeightTotal));
  }

  if (filters.sourceFileId) {
    conditions.push(eq(tradeRecords.sourceFileId, filters.sourceFileId));
  }

  if (filters.importBatchId) {
    conditions.push(eq(tradeRecords.importBatchId, filters.importBatchId));
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

function hasRangeFilters(filters: TradeRecordFilters): boolean {
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

function hasRawOrderedIncompatibleFilters(filters: TradeRecordFilters): boolean {
  return Boolean(
    filters.productQuery ||
      filters.importerCorrelativeId ||
      filters.exporterCorrelativeId ||
      filters.sourceFileId ||
      filters.importBatchId ||
      hasRangeFilters(filters) ||
      (filters.sort && filters.sort !== "source"),
  );
}

function genericOrderBy(filters: TradeRecordFilters): SQL[] {
  const sourceOrder = [
    desc(tradeRecords.periodYear),
    desc(tradeRecords.periodMonth),
    asc(tradeRecords.tradeFlow),
    asc(rawTradeRows.rowNumber),
    asc(rawTradeRows.id),
  ];

  switch (filters.sort) {
    case "item_value_desc":
      return [
        sql`${itemValueExpression(filters)} desc nulls last`,
        desc(tradeRecords.periodYear),
        desc(tradeRecords.periodMonth),
        asc(rawTradeRows.rowNumber),
        asc(rawTradeRows.id),
      ];
    case "item_value_asc":
      return [
        sql`${itemValueExpression(filters)} asc nulls last`,
        desc(tradeRecords.periodYear),
        desc(tradeRecords.periodMonth),
        asc(rawTradeRows.rowNumber),
        asc(rawTradeRows.id),
      ];
    case "declaration_fob_desc":
      return [
        sql`${tradeRecords.declarationFobValue} desc nulls last`,
        desc(tradeRecords.periodYear),
        desc(tradeRecords.periodMonth),
        asc(rawTradeRows.rowNumber),
        asc(rawTradeRows.id),
      ];
    case "quantity_desc":
      return [
        sql`${tradeRecords.quantity} desc nulls last`,
        desc(tradeRecords.periodYear),
        desc(tradeRecords.periodMonth),
        asc(rawTradeRows.rowNumber),
        asc(rawTradeRows.id),
      ];
    case "gross_weight_desc":
      return [
        sql`${grossWeightExpression()} desc nulls last`,
        desc(tradeRecords.periodYear),
        desc(tradeRecords.periodMonth),
        asc(rawTradeRows.rowNumber),
        asc(rawTradeRows.id),
      ];
    case "source":
    case undefined:
      return sourceOrder;
  }
}

function decimalSumExpression(expression: SQL<string>): SQL<string | null> {
  return sql<string | null>`sum(${expression})::text`;
}

async function rankedSummary(
  db: DbClient,
  filters: TradeRecordFilters,
  codeExpression: SQL<string>,
  labelExpression?: SQL<string>,
): Promise<TradeRecordSummaryRank[]> {
  const where = buildWhere(filters);
  const codeNotEmpty = and(
    sql`${codeExpression} is not null`,
    sql`${codeExpression} <> ''`,
  );
  const itemValue = itemValueExpression(filters);
  const rows = await db
    .select({
      code: codeExpression,
      labelRaw: labelExpression ? sql<string | null>`min(${labelExpression})` : sql<null>`null`,
      records: count(),
      totalItemValue: decimalSumExpression(itemValue),
    })
    .from(tradeRecords)
    .where(and(where, codeNotEmpty))
    .groupBy(codeExpression)
    .orderBy(desc(sql<number>`count(*)`), desc(sql<number>`sum(${itemValue})`))
    .limit(5);

  return rows.map((row) => ({
    code: row.code,
    labelRaw: row.labelRaw,
    records: row.records,
    totalItemValue: row.totalItemValue,
  }));
}

export async function summarizeTradeRecords(
  db: DbClient,
  filters: TradeRecordFilters = {},
): Promise<TradeRecordIntelligenceSummary> {
  const where = buildWhere(filters);
  const itemValue = itemValueExpression(filters);
  const [totalsRow] = await db
    .select({
      records: count(),
      itemValue: decimalSumExpression(itemValue),
      declarationFobValue: decimalSumExpression(sql`${tradeRecords.declarationFobValue}`),
      quantity: decimalSumExpression(sql`${tradeRecords.quantity}`),
      quantityUnitCode: sql<string | null>`case when count(distinct ${tradeRecords.quantityUnitCode}) = 1 then min(${tradeRecords.quantityUnitCode}) else null end`,
      quantityUnitIsMixed: sql<boolean>`count(distinct ${tradeRecords.quantityUnitCode}) > 1`,
      grossWeightItem: decimalSumExpression(sql`${tradeRecords.grossWeightItem}`),
      grossWeightTotal: decimalSumExpression(sql`${tradeRecords.grossWeightTotal}`),
      currencyCode: sql<string | null>`case when count(distinct ${tradeRecords.currencyCodeRaw}) = 1 then min(${tradeRecords.currencyCodeRaw}) else null end`,
      currencyIsMixed: sql<boolean>`count(distinct ${tradeRecords.currencyCodeRaw}) > 1`,
    })
    .from(tradeRecords)
    .where(where);

  const [countries, customsOffices, ports, hsCodes] = await Promise.all([
    rankedSummary(db, filters, originOrDestinationCountryExpression(filters)),
    rankedSummary(db, filters, sql<string>`${tradeRecords.customsOfficeCode}`),
    rankedSummary(
      db,
      filters,
      relevantPortExpression(filters),
      relevantPortLabelExpression(filters),
    ),
    rankedSummary(db, filters, hsCodePrefixExpression()),
  ]);

  return {
    totals: {
      records: totalsRow?.records ?? 0,
      itemValue: totalsRow?.itemValue ?? null,
      declarationFobValue: totalsRow?.declarationFobValue ?? null,
      quantity: totalsRow?.quantity ?? null,
      quantityUnitCode: totalsRow?.quantityUnitCode ?? null,
      quantityUnitIsMixed: totalsRow?.quantityUnitIsMixed ?? false,
      grossWeightItem: totalsRow?.grossWeightItem ?? null,
      grossWeightTotal: totalsRow?.grossWeightTotal ?? null,
      currencyCode: totalsRow?.currencyCode ?? null,
      currencyIsMixed: totalsRow?.currencyIsMixed ?? false,
    },
    rankings: {
      countries,
      customsOffices,
      ports,
      hsCodes,
    },
  };
}

function exactMonthForRawOrderedList(
  filters: TradeRecordFilters,
): { tradeFlow: TradeFlow; year: number; month: number } | undefined {
  if (!filters.tradeFlow || hasRawOrderedIncompatibleFilters(filters)) {
    return undefined;
  }

  if (filters.periodYear && filters.periodMonth) {
    return {
      tradeFlow: filters.tradeFlow,
      year: filters.periodYear,
      month: filters.periodMonth,
    };
  }

  if (!filters.periodFrom || !filters.periodTo) {
    return undefined;
  }

  const periodFrom = parsePeriod(filters.periodFrom);
  const periodTo = parsePeriod(filters.periodTo);

  if (periodFrom.value !== periodTo.value) {
    return undefined;
  }

  return {
    tradeFlow: filters.tradeFlow,
    year: periodFrom.year,
    month: periodFrom.month,
  };
}

export async function listTradeRecords(
  db: DbClient,
  filters: TradeRecordFilters = {},
): Promise<TradeRecordListResult> {
  const limit = clampLimit(filters.limit);
  const offset = clampOffset(filters.offset);
  const where = buildWhere(filters);
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
        .orderBy(...genericOrderBy(filters))
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
      payloadRetentionMode: rawTradeRows.payloadRetentionMode,
      payloadStorageKind: rawTradeRows.payloadStorageKind,
      payloadHashSha256: rawTradeRows.payloadHashSha256,
      payloadRetainedReason: rawTradeRows.payloadRetainedReason,
      payloadPrunedAt: rawTradeRows.payloadPrunedAt,
      payloadReconstructable: rawTradeRows.payloadReconstructable,
      parserName: tradeRecords.parserName,
      parserVersion: tradeRecords.parserVersion,
    })
    .from(tradeRecords)
    .innerJoin(sourceFiles, eq(tradeRecords.sourceFileId, sourceFiles.id))
    .innerJoin(importBatches, eq(tradeRecords.importBatchId, importBatches.id))
    .innerJoin(rawTradeRows, eq(tradeRecords.rawTradeRowId, rawTradeRows.id))
    .where(eq(tradeRecords.id, id))
    .limit(1);

  return rows[0] ?? null;
}

function exactPeriodFilters(record: TradeRecordSummary): Pick<
  TradeRecordFilters,
  "periodFrom" | "periodTo"
> {
  const period = `${record.periodYear}-${String(record.periodMonth).padStart(2, "0")}`;
  return {
    periodFrom: period,
    periodTo: period,
  };
}

function countryFilterForRecord(record: TradeRecordSummary): Pick<
  TradeRecordFilters,
  "originCountryCode" | "destinationCountryCode"
> {
  if (record.tradeFlow === "export") {
    return {
      destinationCountryCode: record.destinationCountryCode ?? undefined,
    };
  }

  return {
    originCountryCode: record.originCountryCode ?? undefined,
  };
}

function relevantPortFilterForRecord(record: TradeRecordSummary): Pick<
  TradeRecordFilters,
  "portCode"
> {
  return {
    portCode:
      record.tradeFlow === "export"
        ? record.embarkPortCode ?? undefined
        : record.disembarkPortCode ?? undefined,
  };
}

function participantFilterForRecord(record: TradeRecordSummary): Pick<
  TradeRecordFilters,
  "importerCorrelativeId" | "exporterCorrelativeId"
> {
  if (record.tradeFlow === "import") {
    return {
      importerCorrelativeId: record.importerCorrelativeId ?? undefined,
    };
  }

  return {
    exporterCorrelativeId:
      record.exporterPrimaryCorrelativeId ??
      record.exporterSecondaryCorrelativeId ??
      undefined,
  };
}

function compactFilters(filters: TradeRecordFilters): TradeRecordFilters {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== ""),
  ) as TradeRecordFilters;
}

async function listRelatedRecords(
  db: DbClient,
  currentRecordId: string,
  filters: TradeRecordFilters,
  limit: number,
): Promise<TradeRecordSummary[]> {
  const where = buildWhere(filters);

  return baseSummaryQuery(db)
    .where(and(where, ne(tradeRecords.id, currentRecordId)))
    .orderBy(...genericOrderBy({ ...filters, sort: "source" }))
    .limit(limit);
}

export function buildTradeRecordRelatedGroupDefinitions(
  record: TradeRecordSummary,
  limit = 5,
): TradeRecordRelatedGroupDefinition[] {
  const period = exactPeriodFilters(record);
  const baseFilters: TradeRecordFilters = compactFilters({
    tradeFlow: record.tradeFlow as TradeFlow,
    ...period,
    limit,
  });
  const hsCode = record.hsCodeNormalized ?? undefined;
  const relevantCountry = countryFilterForRecord(record);
  const participant = participantFilterForRecord(record);
  const relevantPort = relevantPortFilterForRecord(record);

  return [
    ...(hsCode
      ? [
          {
            key: "same_hs_flow" as const,
            title: "Misma partida HS y flujo",
            description:
              "Otros registros del mismo mes, flujo y código HS normalizado.",
            filters: compactFilters({
              ...baseFilters,
              hsCodePrefix: hsCode,
            }),
          },
        ]
      : []),
    ...(hsCode && (relevantCountry.originCountryCode || relevantCountry.destinationCountryCode)
      ? [
          {
            key: "same_country_hs" as const,
            title:
              record.tradeFlow === "export"
                ? "Mismo destino y HS"
                : "Mismo origen y HS",
            description:
              "Registros del mismo mes que combinan país comercial relevante y código HS.",
            filters: compactFilters({
              ...baseFilters,
              hsCodePrefix: hsCode,
              ...relevantCountry,
            }),
          },
        ]
      : []),
    ...(participant.importerCorrelativeId || participant.exporterCorrelativeId
      ? [
          {
            key: "same_participant" as const,
            title:
              record.tradeFlow === "export"
                ? "Mismo correlativo exportador Aduana"
                : "Mismo correlativo importador Aduana",
            description:
              "Correlativo anónimo de la fuente Aduana; no es identidad legal verificada.",
            filters: compactFilters({
              ...baseFilters,
              ...participant,
            }),
          },
        ]
      : []),
    ...(record.customsOfficeCode
      ? [
          {
            key: "same_customs_office" as const,
            title: "Misma aduana",
            description: "Registros del mismo mes, flujo y oficina Aduana.",
            filters: compactFilters({
              ...baseFilters,
              customsOfficeCode: record.customsOfficeCode,
            }),
          },
        ]
      : []),
    ...(relevantPort.portCode
      ? [
          {
            key: "same_relevant_port" as const,
            title:
              record.tradeFlow === "export"
                ? "Mismo puerto de embarque"
                : "Mismo puerto de desembarque",
            description:
              "Registros del mismo mes, flujo y puerto relevante para el flujo.",
            filters: compactFilters({
              ...baseFilters,
              ...relevantPort,
            }),
          },
        ]
      : []),
  ];
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
