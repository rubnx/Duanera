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
  tradeRecordRelevantPortExpression,
  tradeRecordRelevantPortLabelExpression,
} from "@/trade/trade-record-expressions";
import { buildTradeRecordWhere } from "@/trade/trade-record-where";
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

async function rankedSummary(
  db: DbClient,
  filters: TradeRecordFilters,
  codeExpression: SQL<string>,
  labelExpression?: SQL<string>,
): Promise<TradeRecordSummaryRank[]> {
  const where = buildTradeRecordWhere(filters);
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
): Promise<TradeRecordIntelligenceSummary> {
  const where = buildTradeRecordWhere(filters);
  const itemValue = tradeRecordItemValueExpression(filters);
  const [totalsRow] = await db
    .select({
      records: count(),
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

  const [countries, customsOffices, ports, hsCodes] = await Promise.all([
    rankedSummary(db, filters, tradeRecordCountryExpression(filters)),
    rankedSummary(db, filters, sql<string>`${tradeRecords.customsOfficeCode}`),
    rankedSummary(
      db,
      filters,
      tradeRecordRelevantPortExpression(filters),
      tradeRecordRelevantPortLabelExpression(filters),
    ),
    rankedSummary(db, filters, tradeRecordHsCodePrefixExpression()),
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
