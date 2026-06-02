import { and, eq, sql, type SQL } from "drizzle-orm";

import { rawTradeRows, tradeRecords } from "@/db/schema";
import type { TradeFlow } from "@/trade/trade-records";

export const march2026ReportPeriod = {
  year: 2026,
  month: 3,
  label: "2026-03",
};

export function march2026RawTradeRowsWhere(flow?: TradeFlow): SQL {
  const conditions: SQL[] = [
    eq(rawTradeRows.periodYear, march2026ReportPeriod.year),
    eq(rawTradeRows.periodMonth, march2026ReportPeriod.month),
  ];

  if (flow) {
    conditions.push(eq(rawTradeRows.tradeFlow, flow));
  }

  return and(...conditions) ?? sql`true`;
}

export function march2026TradeRecordsWhere(flow?: TradeFlow): SQL {
  const conditions: SQL[] = [
    eq(tradeRecords.periodYear, march2026ReportPeriod.year),
    eq(tradeRecords.periodMonth, march2026ReportPeriod.month),
  ];

  if (flow) {
    conditions.push(eq(tradeRecords.tradeFlow, flow));
  }

  return and(...conditions) ?? sql`true`;
}

export function presentTrimmedTextCondition(expression: SQL<unknown>) {
  return sql`(${expression} is not null and btrim(${expression}::text) <> '')`;
}
