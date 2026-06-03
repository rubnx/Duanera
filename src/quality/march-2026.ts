import { and, eq, sql, type SQL } from "drizzle-orm";

import { rawTradeRows, tradeRecords } from "@/db/schema";
import {
  formatTradeRecordPeriodValue,
  type TradeRecordPeriodOption,
} from "@/trade/trade-record-periods";
import type { TradeFlow } from "@/trade/trade-records";

export const march2026ReportPeriod = {
  year: 2026,
  month: 3,
  label: "2026-03",
};

export type QualityReportExactPeriod = {
  year: number;
  month: number;
  label: string;
};

export type QualityReportRangePeriod = {
  periodFrom: string;
  periodTo: string;
  label: string;
};

export type QualityReportPeriod = QualityReportExactPeriod | QualityReportRangePeriod;

export function qualityPeriodFromExactMonth(
  year: number,
  month: number,
): QualityReportExactPeriod {
  return {
    year,
    month,
    label: formatTradeRecordPeriodValue(year, month),
  };
}

export function qualityPeriodFromRange(
  periodFrom: string,
  periodTo: string,
): QualityReportPeriod {
  if (periodFrom === periodTo) {
    const [year, month] = periodFrom.split("-").map((part) => Number.parseInt(part, 10));
    return qualityPeriodFromExactMonth(year, month);
  }

  return {
    periodFrom,
    periodTo,
    label: `${periodFrom} a ${periodTo}`,
  };
}

export function latestQualityReportPeriod(
  periods: TradeRecordPeriodOption[],
): QualityReportExactPeriod {
  const latest = periods[0];
  return latest
    ? qualityPeriodFromExactMonth(latest.year, latest.month)
    : march2026ReportPeriod;
}

function periodTuple(value: string) {
  const [year, month] = value.split("-").map((part) => Number.parseInt(part, 10));
  return { month, year };
}

function rawPeriodConditions(period: QualityReportPeriod): SQL[] {
  if ("periodFrom" in period) {
    const from = periodTuple(period.periodFrom);
    const to = periodTuple(period.periodTo);
    return [
      sql`(${rawTradeRows.periodYear}, ${rawTradeRows.periodMonth}) >= (${from.year}, ${from.month})`,
      sql`(${rawTradeRows.periodYear}, ${rawTradeRows.periodMonth}) <= (${to.year}, ${to.month})`,
    ];
  }

  return [
    eq(rawTradeRows.periodYear, period.year),
    eq(rawTradeRows.periodMonth, period.month),
  ];
}

function tradePeriodConditions(period: QualityReportPeriod): SQL[] {
  if ("periodFrom" in period) {
    const from = periodTuple(period.periodFrom);
    const to = periodTuple(period.periodTo);
    return [
      sql`(${tradeRecords.periodYear}, ${tradeRecords.periodMonth}) >= (${from.year}, ${from.month})`,
      sql`(${tradeRecords.periodYear}, ${tradeRecords.periodMonth}) <= (${to.year}, ${to.month})`,
    ];
  }

  return [
    eq(tradeRecords.periodYear, period.year),
    eq(tradeRecords.periodMonth, period.month),
  ];
}

export function qualityRawTradeRowsWhere(
  period: QualityReportPeriod,
  flow?: TradeFlow,
): SQL {
  const conditions: SQL[] = rawPeriodConditions(period);

  if (flow) {
    conditions.push(eq(rawTradeRows.tradeFlow, flow));
  }

  return and(...conditions) ?? sql`true`;
}

export function qualityTradeRecordsWhere(
  period: QualityReportPeriod,
  flow?: TradeFlow,
): SQL {
  const conditions: SQL[] = tradePeriodConditions(period);

  if (flow) {
    conditions.push(eq(tradeRecords.tradeFlow, flow));
  }

  return and(...conditions) ?? sql`true`;
}

export function qualityPeriodSearchParams(period: QualityReportPeriod) {
  if ("periodFrom" in period) {
    return {
      periodFrom: period.periodFrom,
      periodTo: period.periodTo,
    };
  }

  return {
    periodFrom: period.label,
    periodTo: period.label,
  };
}

export function march2026RawTradeRowsWhere(flow?: TradeFlow): SQL {
  return qualityRawTradeRowsWhere(march2026ReportPeriod, flow);
}

export function march2026TradeRecordsWhere(flow?: TradeFlow): SQL {
  return qualityTradeRecordsWhere(march2026ReportPeriod, flow);
}

export function presentTrimmedTextCondition(expression: SQL<unknown>) {
  return sql`(${expression} is not null and btrim(${expression}::text) <> '')`;
}
