import {
  latestQualityReportPeriod,
  qualityPeriodFromRange,
  qualityPeriodSearchParams,
  type QualityReportPeriod,
} from "@/quality/march-2026";
import type { TradeRecordPeriodOption } from "@/trade/trade-record-periods";

export type QualityPeriodSearchParams = Record<
  string,
  string | string[] | undefined
>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isKnownPeriod(value: string | undefined, periods: TradeRecordPeriodOption[]) {
  return Boolean(value && periods.some((period) => period.value === value));
}

function orderedPeriodPair(periodFrom: string, periodTo: string) {
  return periodFrom <= periodTo
    ? { periodFrom, periodTo }
    : { periodFrom: periodTo, periodTo: periodFrom };
}

export function qualityPeriodFromSearchParams({
  params,
  periods,
}: {
  params: QualityPeriodSearchParams;
  periods: TradeRecordPeriodOption[];
}): QualityReportPeriod {
  const latest = latestQualityReportPeriod(periods);
  const periodFrom = firstValue(params.periodFrom);
  const periodTo = firstValue(params.periodTo);

  if (isKnownPeriod(periodFrom, periods) && isKnownPeriod(periodTo, periods)) {
    const ordered = orderedPeriodPair(periodFrom as string, periodTo as string);
    return qualityPeriodFromRange(ordered.periodFrom, ordered.periodTo);
  }

  return latest;
}

export function qualityPeriodHref(pathname: string, period: QualityReportPeriod) {
  const query = new URLSearchParams(qualityPeriodSearchParams(period));
  return `${pathname}?${query.toString()}`;
}
