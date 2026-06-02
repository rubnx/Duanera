import { countValueToNumber, type CountValue } from "@/db/count-values";
import type { DataQualityStatus } from "@/quality/coverage";
import {
  sourceDisplayFilename,
  sourceTradeRecordsHref,
} from "@/sources/source-provenance";
import type { TradeFlow } from "@/trade/trade-records";

export type DataQualityFlowSummary = {
  tradeFlow: TradeFlow;
  rawRows: number;
  parsedRows: number;
  failedRows: number;
  warningRows: number;
  tradeRecords: number;
  rawToTradeDelta: number;
  status: DataQualityStatus;
};

export type DataQualitySourceCoverage = {
  sourceFileId: string;
  importBatchId: string;
  tradeFlow: TradeFlow;
  filename: string;
  batchStatus: string;
  rawRows: number;
  parsedRows: number;
  failedRows: number;
  tradeRecords: number;
  sourceHref: string;
  tradeRecordsHref: string | null;
};

export type FlowCountRow = {
  tradeFlow: string | null;
  rawRows?: CountValue;
  parsedRows?: CountValue;
  failedRows?: CountValue;
  warningRows?: CountValue;
  tradeRecords?: CountValue;
};

export type SourceCoverageRawRow = {
  sourceFileId: string;
  importBatchId: string;
  tradeFlow: string | null;
  originalFilename: string;
  normalizedRawFilename: string | null;
  batchStatus: string;
  rawRows: CountValue;
  parsedRows: CountValue;
  failedRows: CountValue;
};

export type SourceCoverageTradeRow = {
  sourceFileId: string;
  importBatchId: string;
  tradeFlow: string | null;
  tradeRecords: CountValue;
};

function statusForFlow(
  rawRows: number,
  failedRows: number,
  rawToTradeDelta: number,
) {
  if (failedRows > 0 || rawToTradeDelta !== 0) {
    return "warning" satisfies DataQualityStatus;
  }

  if (rawRows === 0) {
    return "review" satisfies DataQualityStatus;
  }

  return "ok" satisfies DataQualityStatus;
}

export function flowSummariesFromRows({
  rawRows,
  tradeRows,
}: {
  rawRows: FlowCountRow[];
  tradeRows: FlowCountRow[];
}): DataQualityFlowSummary[] {
  const rawByFlow = new Map(rawRows.map((row) => [row.tradeFlow, row]));
  const tradeByFlow = new Map(tradeRows.map((row) => [row.tradeFlow, row]));

  return (["import", "export"] satisfies TradeFlow[]).map((tradeFlow) => {
    const raw = rawByFlow.get(tradeFlow);
    const trade = tradeByFlow.get(tradeFlow);
    const rawCount = countValueToNumber(raw?.rawRows);
    const failedRows = countValueToNumber(raw?.failedRows);
    const tradeRecordCount = countValueToNumber(trade?.tradeRecords);
    const rawToTradeDelta = rawCount - tradeRecordCount;

    return {
      tradeFlow,
      rawRows: rawCount,
      parsedRows: countValueToNumber(raw?.parsedRows),
      failedRows,
      warningRows: countValueToNumber(raw?.warningRows),
      tradeRecords: tradeRecordCount,
      rawToTradeDelta,
      status: statusForFlow(rawCount, failedRows, rawToTradeDelta),
    };
  });
}

export function sourceCoverageRows({
  rawRows,
  tradeRows,
}: {
  rawRows: SourceCoverageRawRow[];
  tradeRows: SourceCoverageTradeRow[];
}): DataQualitySourceCoverage[] {
  const tradeCountByBatch = new Map(
    tradeRows.map((row) => [
      `${row.sourceFileId}:${row.importBatchId}:${row.tradeFlow}`,
      countValueToNumber(row.tradeRecords),
    ]),
  );

  return rawRows
    .filter((row) => row.tradeFlow === "import" || row.tradeFlow === "export")
    .map((row) => {
      const tradeFlow = row.tradeFlow as TradeFlow;
      const importBatchId = row.importBatchId;
      const sourceFileId = row.sourceFileId;

      return {
        sourceFileId,
        importBatchId,
        tradeFlow,
        filename: sourceDisplayFilename({
          originalFilename: row.originalFilename,
          normalizedRawFilename: row.normalizedRawFilename,
        }),
        batchStatus: row.batchStatus,
        rawRows: countValueToNumber(row.rawRows),
        parsedRows: countValueToNumber(row.parsedRows),
        failedRows: countValueToNumber(row.failedRows),
        tradeRecords:
          tradeCountByBatch.get(`${sourceFileId}:${importBatchId}:${tradeFlow}`) ?? 0,
        sourceHref: `/sources/${sourceFileId}#batch-${importBatchId}`,
        tradeRecordsHref: sourceTradeRecordsHref({
          sourceFileId,
          importBatchId,
          tradeFlow,
        }),
      };
    });
}
