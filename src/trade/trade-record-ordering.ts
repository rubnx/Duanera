import {
  asc,
  desc,
  sql,
  type SQL,
} from "drizzle-orm";

import { rawTradeRows, tradeRecords } from "@/db/schema";
import {
  parseTradeRecordPeriod,
  tradeRecordGrossWeightExpression,
  tradeRecordItemValueExpression,
} from "@/trade/trade-record-expressions";
import type { TradeFlow, TradeRecordFilters } from "@/trade/trade-records";
import { hasTradeRecordRangeFilters } from "@/trade/trade-record-where";

function hasRawOrderedIncompatibleFilters(filters: TradeRecordFilters): boolean {
  return Boolean(
    filters.productQuery ||
      filters.importerCorrelativeId ||
      filters.exporterCorrelativeId ||
      filters.sourceFileId ||
      filters.importBatchId ||
      hasTradeRecordRangeFilters(filters) ||
      (filters.sort && filters.sort !== "source"),
  );
}

export function tradeRecordOrderBy(filters: TradeRecordFilters): SQL[] {
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
        sql`${tradeRecordItemValueExpression(filters)} desc nulls last`,
        desc(tradeRecords.periodYear),
        desc(tradeRecords.periodMonth),
        asc(rawTradeRows.rowNumber),
        asc(rawTradeRows.id),
      ];
    case "item_value_asc":
      return [
        sql`${tradeRecordItemValueExpression(filters)} asc nulls last`,
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
        sql`${tradeRecordGrossWeightExpression()} desc nulls last`,
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

export function exactMonthForRawOrderedList(
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

  const periodFrom = parseTradeRecordPeriod(filters.periodFrom);
  const periodTo = parseTradeRecordPeriod(filters.periodTo);

  if (periodFrom.value !== periodTo.value) {
    return undefined;
  }

  return {
    tradeFlow: filters.tradeFlow,
    year: periodFrom.year,
    month: periodFrom.month,
  };
}
