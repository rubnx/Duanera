import { countValueToNumber, type CountValue } from "@/db/count-values";
import {
  coveragePercent,
  coverageStatus,
  normalizeCodeForCoverage,
  type DataQualityStatus,
} from "@/quality/coverage";
import type { TradeFlow } from "@/trade/trade-records";

export type DataQualityLabelDimensionKey =
  | "countries"
  | "customsOffices"
  | "ports"
  | "transportModes";

export type CodeCountRow = {
  code: string | null;
  records: CountValue;
};

export type DataQualityLabelCoverage = {
  tradeFlow: TradeFlow;
  key: DataQualityLabelDimensionKey;
  label: string;
  distinctCodes: number;
  decodedCodes: number;
  undecodedCodes: string[];
  recordsWithCode: number;
  recordsWithDecodedCode: number;
  percent: number;
  status: DataQualityStatus;
  caveat: string;
};

export function labelCoverageFromRows({
  caveat,
  codeSet,
  ignoredSourceCodes = new Set<string>(),
  key,
  label,
  rows,
  tradeFlow,
}: {
  caveat: string;
  codeSet: Set<string>;
  ignoredSourceCodes?: Set<string>;
  key: DataQualityLabelDimensionKey;
  label: string;
  rows: CodeCountRow[];
  tradeFlow: TradeFlow;
}): DataQualityLabelCoverage {
  const distinctCodes = new Set<string>();
  const decodedCodes = new Set<string>();
  const undecodedCodes = new Set<string>();
  let recordsWithCode = 0;
  let recordsWithDecodedCode = 0;

  for (const row of rows) {
    const normalizedCode = normalizeCodeForCoverage(row.code);
    if (!normalizedCode) {
      continue;
    }

    const records = countValueToNumber(row.records);
    if (ignoredSourceCodes.has(normalizedCode)) {
      continue;
    }

    distinctCodes.add(normalizedCode);
    recordsWithCode += records;

    if (codeSet.has(normalizedCode)) {
      decodedCodes.add(normalizedCode);
      recordsWithDecodedCode += records;
    } else {
      undecodedCodes.add(normalizedCode);
    }
  }

  return {
    tradeFlow,
    key,
    label,
    distinctCodes: distinctCodes.size,
    decodedCodes: decodedCodes.size,
    undecodedCodes: Array.from(undecodedCodes).sort().slice(0, 12),
    recordsWithCode,
    recordsWithDecodedCode,
    percent: coveragePercent(recordsWithDecodedCode, recordsWithCode),
    status: coverageStatus({
      covered: recordsWithDecodedCode,
      total: recordsWithCode,
      okAt: 99,
      warningBelow: 95,
    }),
    caveat,
  };
}
