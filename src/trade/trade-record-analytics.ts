import {
  and,
  count,
  desc,
  sql,
  type SQL,
} from "drizzle-orm";

import type { DbClient } from "@/db/client";
import { tradeRecords } from "@/db/schema";
import {
  tradeRecordCountryExpression,
  tradeRecordDecimalSumExpression,
  tradeRecordHsCodePrefixExpression,
  tradeRecordItemValueExpression,
  tradeRecordParticipantCorrelativeExpression,
  tradeRecordRelevantPortExpression,
  tradeRecordRelevantPortLabelExpression,
} from "@/trade/trade-record-expressions";
import {
  buildTradeRecordWhere,
  type TradeRecordWhereOptions,
} from "@/trade/trade-record-where";
import type { TradeRecordFilters } from "@/trade/trade-records";

export {
  compareTradeRecordGroups,
  emptyTradeRecordComparison,
  type TradeRecordComparison,
  type TradeRecordComparisonRow,
} from "@/trade/trade-record-comparison";

export type TradeRecordSummaryRank = {
  code: string;
  labelRaw: string | null;
  records: number;
  totalItemValue: string | null;
};

export type TradeRecordIntelligenceSummary = {
  status?: "complete" | "bounded";
  skippedReason?: "broad_multi_month_result_set" | null;
  totals: {
    records: number;
    operations: number;
    anonymousParticipants: number;
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
    transportModes: TradeRecordSummaryRank[];
    participants: TradeRecordSummaryRank[];
  };
};

export function emptyTradeRecordSummary(
  totalRecords = 0,
  skippedReason: NonNullable<TradeRecordIntelligenceSummary["skippedReason"]> | null = null,
): TradeRecordIntelligenceSummary {
  return {
    status: skippedReason ? "bounded" : "complete",
    skippedReason,
    totals: {
      records: totalRecords,
      operations: 0,
      anonymousParticipants: 0,
      itemValue: null,
      declarationFobValue: null,
      quantity: null,
      quantityUnitCode: null,
      quantityUnitIsMixed: false,
      grossWeightItem: null,
      grossWeightTotal: null,
      currencyCode: null,
      currencyIsMixed: false,
    },
    rankings: {
      countries: [],
      customsOffices: [],
      ports: [],
      hsCodes: [],
      transportModes: [],
      participants: [],
    },
  };
}

async function rankedSummary(
  db: DbClient,
  filters: TradeRecordFilters,
  codeExpression: SQL<string>,
  labelExpression?: SQL<string>,
  options: TradeRecordWhereOptions = {},
): Promise<TradeRecordSummaryRank[]> {
  const where = buildTradeRecordWhere(filters, options);
  const codeNotEmpty = and(
    sql`${codeExpression} is not null`,
    sql`${codeExpression} <> ''`,
  );
  const itemValue = tradeRecordItemValueExpression(filters);
  const rows = await db
    .select({
      code: codeExpression,
      labelRaw: labelExpression ? sql<string | null>`min(${labelExpression})` : sql<null>`null`,
      records: count(),
      totalItemValue: tradeRecordDecimalSumExpression(itemValue),
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
  options: TradeRecordWhereOptions = {},
): Promise<TradeRecordIntelligenceSummary> {
  const where = buildTradeRecordWhere(filters, options);
  const itemValue = tradeRecordItemValueExpression(filters);
  const participant = tradeRecordParticipantCorrelativeExpression(filters);
  const [totalsRow] = await db
    .select({
      records: count(),
      operations: sql<number>`count(distinct coalesce(${tradeRecords.declarationIdRaw}, ${tradeRecords.id}::text))`,
      anonymousParticipants: sql<number>`count(distinct ${participant})`,
      itemValue: tradeRecordDecimalSumExpression(itemValue),
      declarationFobValue: tradeRecordDecimalSumExpression(sql`${tradeRecords.declarationFobValue}`),
      quantity: tradeRecordDecimalSumExpression(sql`${tradeRecords.quantity}`),
      quantityUnitCode: sql<string | null>`case when count(distinct ${tradeRecords.quantityUnitCode}) = 1 then min(${tradeRecords.quantityUnitCode}) else null end`,
      quantityUnitIsMixed: sql<boolean>`count(distinct ${tradeRecords.quantityUnitCode}) > 1`,
      grossWeightItem: tradeRecordDecimalSumExpression(sql`${tradeRecords.grossWeightItem}`),
      grossWeightTotal: tradeRecordDecimalSumExpression(sql`${tradeRecords.grossWeightTotal}`),
      currencyCode: sql<string | null>`case when count(distinct ${tradeRecords.currencyCodeRaw}) = 1 then min(${tradeRecords.currencyCodeRaw}) else null end`,
      currencyIsMixed: sql<boolean>`count(distinct ${tradeRecords.currencyCodeRaw}) > 1`,
    })
    .from(tradeRecords)
    .where(where);

  const [
    countries,
    customsOffices,
    ports,
    hsCodes,
    transportModes,
    participants,
  ] = await Promise.all([
    rankedSummary(db, filters, tradeRecordCountryExpression(filters), undefined, options),
    rankedSummary(
      db,
      filters,
      sql<string>`${tradeRecords.customsOfficeCode}`,
      undefined,
      options,
    ),
    rankedSummary(
      db,
      filters,
      tradeRecordRelevantPortExpression(filters),
      tradeRecordRelevantPortLabelExpression(filters),
      options,
    ),
    rankedSummary(db, filters, tradeRecordHsCodePrefixExpression(), undefined, options),
    rankedSummary(
      db,
      filters,
      sql<string>`${tradeRecords.transportModeCode}`,
      undefined,
      options,
    ),
    rankedSummary(db, filters, participant, undefined, options),
  ]);

  return {
    status: "complete",
    skippedReason: null,
    totals: {
      records: totalsRow?.records ?? 0,
      operations: totalsRow?.operations ?? 0,
      anonymousParticipants: totalsRow?.anonymousParticipants ?? 0,
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
      transportModes,
      participants,
    },
  };
}
