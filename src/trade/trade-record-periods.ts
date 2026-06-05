import { count, desc, eq } from "drizzle-orm";

import type { DbClient } from "@/db/client";
import { sourceFiles, tradeRecords } from "@/db/schema";
import {
  internalSourceCategories,
  productFacingTradeRecordWhere,
  type ProductFacingTradeRecordWhereOptions,
} from "@/trade/trade-record-where";

export type TradeRecordPeriodOption = {
  year: number;
  month: number;
  value: string;
  records: number;
};

export type TradeRecordPeriodCandidate = TradeRecordPeriodOption & {
  sourceCategory?: string | null;
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

function isFuturePeriod(
  period: Pick<TradeRecordPeriodOption, "year" | "month">,
  referenceDate: Date,
) {
  const referenceYear = referenceDate.getUTCFullYear();
  const referenceMonth = referenceDate.getUTCMonth() + 1;

  return (
    period.year > referenceYear ||
    (period.year === referenceYear && period.month > referenceMonth)
  );
}

export function isProductFacingTradeRecordPeriod(
  period: TradeRecordPeriodCandidate,
  options: ProductFacingTradeRecordWhereOptions = {},
) {
  const sourceCategory = period.sourceCategory?.toLowerCase();

  if (
    sourceCategory &&
    internalSourceCategories.some((category) => category === sourceCategory)
  ) {
    return false;
  }

  return !isFuturePeriod(period, options.referenceDate ?? new Date());
}

export function latestProductTradeRecordPeriod(
  periods: TradeRecordPeriodCandidate[],
  options: ProductFacingTradeRecordWhereOptions = {},
): TradeRecordPeriodOption | undefined {
  return periods
    .filter((period) => isProductFacingTradeRecordPeriod(period, options))
    .sort((a, b) => b.year - a.year || b.month - a.month)[0];
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

export async function listProductTradeRecordPeriods(
  db: DbClient,
  options: ProductFacingTradeRecordWhereOptions = {},
): Promise<TradeRecordPeriodOption[]> {
  const rows = await db
    .select({
      year: tradeRecords.periodYear,
      month: tradeRecords.periodMonth,
      records: count(),
    })
    .from(tradeRecords)
    .innerJoin(sourceFiles, eq(tradeRecords.sourceFileId, sourceFiles.id))
    .where(productFacingTradeRecordWhere(options))
    .groupBy(tradeRecords.periodYear, tradeRecords.periodMonth)
    .orderBy(desc(tradeRecords.periodYear), desc(tradeRecords.periodMonth));

  return rows.map((row) => ({
    year: row.year,
    month: row.month,
    value: formatTradeRecordPeriodValue(row.year, row.month),
    records: row.records,
  }));
}
