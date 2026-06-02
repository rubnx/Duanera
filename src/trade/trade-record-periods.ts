import { count, desc } from "drizzle-orm";

import type { DbClient } from "@/db/client";
import { tradeRecords } from "@/db/schema";

export type TradeRecordPeriodOption = {
  year: number;
  month: number;
  value: string;
  records: number;
};

export const fallbackTradeRecordPeriod = "2026-04";

export function formatTradeRecordPeriodValue(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function formatTradeRecordPeriodScope(periods: TradeRecordPeriodOption[]) {
  if (periods.length === 0) {
    return "Sin períodos cargados";
  }

  const ordered = [...periods].sort((a, b) => a.value.localeCompare(b.value));
  const first = ordered[0]?.value ?? fallbackTradeRecordPeriod;
  const last = ordered.at(-1)?.value ?? first;

  return first === last ? first : `${first} a ${last}`;
}

export async function listTradeRecordPeriods(
  db: DbClient,
): Promise<TradeRecordPeriodOption[]> {
  const rows = await db
    .select({
      year: tradeRecords.periodYear,
      month: tradeRecords.periodMonth,
      records: count(),
    })
    .from(tradeRecords)
    .groupBy(tradeRecords.periodYear, tradeRecords.periodMonth)
    .orderBy(desc(tradeRecords.periodYear), desc(tradeRecords.periodMonth));

  return rows.map((row) => ({
    year: row.year,
    month: row.month,
    value: formatTradeRecordPeriodValue(row.year, row.month),
    records: row.records,
  }));
}
