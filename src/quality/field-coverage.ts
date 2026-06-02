import { countValueToNumber, type CountValue } from "@/db/count-values";
import { coveragePercent, coverageStatus, type DataQualityStatus } from "@/quality/coverage";
import type { TradeFlow } from "@/trade/trade-records";

export type DataQualityFieldCoverage = {
  tradeFlow: TradeFlow;
  key: string;
  label: string;
  covered: number;
  total: number;
  percent: number;
  status: DataQualityStatus;
  caveat: string;
};

export type FieldCoverageDefinition = {
  key: string;
  label: string;
  covered: CountValue;
  caveat: string;
  okAt?: number;
  warningBelow?: number;
};

export function fieldCoverageRows({
  fields,
  total,
  tradeFlow,
}: {
  fields: FieldCoverageDefinition[];
  total: number;
  tradeFlow: TradeFlow;
}): DataQualityFieldCoverage[] {
  return fields.map((field) => {
    const covered = countValueToNumber(field.covered);

    return {
      tradeFlow,
      key: field.key,
      label: field.label,
      covered,
      total,
      percent: coveragePercent(covered, total),
      status: coverageStatus({
        covered,
        total,
        okAt: field.okAt ?? 99,
        warningBelow: field.warningBelow ?? 90,
      }),
      caveat: field.caveat,
    };
  });
}
