import {
  asc,
  count,
  eq,
  sql,
} from "drizzle-orm";

import type { DbClient } from "@/db/client";
import { type DataQualityFieldCoverage } from "@/quality/field-coverage";
import { type DataQualityLabelCoverage } from "@/quality/label-coverage";
import {
  importBatches,
  rawTradeRows,
  sourceFiles,
  tradeRecords,
} from "@/db/schema";
import {
  march2026RawTradeRowsWhere,
  march2026ReportPeriod,
  march2026TradeRecordsWhere,
} from "@/quality/march-2026";
import { type DataQualitySourceBatchRemediation } from "@/quality/source-batch-remediation";
import { type DataQualityIssueGroup } from "@/quality/data-quality-issues";
import { loadDataQualityIssueGroups } from "@/quality/data-quality-issue-groups";
import {
  flowSummariesFromRows,
  sourceCoverageRows,
  type DataQualityFlowSummary,
  type DataQualitySourceCoverage,
} from "@/quality/source-coverage";
import { countValueToNumber } from "@/db/count-values";
import {
  buildDataQualityFindings,
  type DataQualityFinding,
  type DataQualityPayloadCoverage,
} from "@/quality/data-quality-findings";
import {
  loadFieldCoverage,
} from "@/quality/data-quality-coverage-loaders";
import { loadLabelCoverage } from "@/quality/data-quality-label-coverage-loader";
import { getMarch2026SourceBatchRemediation } from "@/quality/data-quality-source-batch-remediation";

const reportPeriod = march2026ReportPeriod;

export {
  coveragePercent,
  coverageStatus,
  isActionableUndecodedCode,
  normalizeCodeForCoverage,
  type DataQualityStatus,
} from "@/quality/coverage";
export { type DataQualityFieldCoverage } from "@/quality/field-coverage";
export { type DataQualityLabelCoverage } from "@/quality/label-coverage";
export {
  getMarch2026SourceBatchRemediation,
} from "@/quality/data-quality-source-batch-remediation";
export {
  addUndecodedSourceBatchCounts,
  dataQualityRemediationNextStep,
  dataQualityRemediationStatus,
  dataQualityRemediationTotal,
  dataQualitySourceBatchKey,
  finalizeSourceBatchRemediationRows,
  sourceBatchRemediationFromRow,
  type DataQualitySourceBatchRemediation,
  type DataQualityRemediationIssueCounts,
  type SourceBatchCodeCountRow,
  type SourceBatchRemediationBaseRow,
} from "@/quality/source-batch-remediation";
export {
  dataQualityIssueRecordHref,
  dataQualityIssueSampleFromRow,
  dataQualityIssueSearchHref,
  dataQualityIssueStatus,
  dataQualitySourceBatchHref,
  type DataQualityIssueGroup,
  type DataQualityIssueKind,
  type DataQualityIssueSample,
  type DataQualityIssueSampleSourceRow,
} from "@/quality/data-quality-issues";
export {
  type DataQualityFlowSummary,
  type DataQualitySourceCoverage,
} from "@/quality/source-coverage";
export {
  buildDataQualityFindings,
  type DataQualityFinding,
  type DataQualityPayloadCoverage,
} from "@/quality/data-quality-findings";

export type DataQualityReport = {
  period: typeof reportPeriod;
  totals: {
    rawRows: number;
    parsedRows: number;
    failedRows: number;
    warningRows: number;
    tradeRecords: number;
    rawToTradeDelta: number;
  };
  flows: DataQualityFlowSummary[];
  sourceCoverage: DataQualitySourceCoverage[];
  fieldCoverage: DataQualityFieldCoverage[];
  labelCoverage: DataQualityLabelCoverage[];
  payloadCoverage: DataQualityPayloadCoverage[];
  issueGroups: DataQualityIssueGroup[];
  sourceBatchRemediation: DataQualitySourceBatchRemediation[];
  findings: DataQualityFinding[];
};

const toNumber = countValueToNumber;

const marchRawWhere = march2026RawTradeRowsWhere;
const marchTradeWhere = march2026TradeRecordsWhere;

async function loadFlowSummaries(db: DbClient): Promise<DataQualityFlowSummary[]> {
  const [rawRows, tradeRows] = await Promise.all([
    db
      .select({
        tradeFlow: rawTradeRows.tradeFlow,
        rawRows: count(),
        parsedRows: sql<number>`count(*) filter (where ${rawTradeRows.parseStatus} = 'parsed')`,
        failedRows: sql<number>`count(*) filter (where ${rawTradeRows.parseStatus} = 'failed')`,
        warningRows: sql<number>`count(*) filter (where ${rawTradeRows.parseWarnings} is not null)`,
      })
      .from(rawTradeRows)
      .where(marchRawWhere())
      .groupBy(rawTradeRows.tradeFlow),
    db
      .select({
        tradeFlow: tradeRecords.tradeFlow,
        tradeRecords: count(),
      })
      .from(tradeRecords)
      .where(marchTradeWhere())
      .groupBy(tradeRecords.tradeFlow),
  ]);

  return flowSummariesFromRows({ rawRows, tradeRows });
}

async function loadSourceCoverage(db: DbClient): Promise<DataQualitySourceCoverage[]> {
  const [rawRows, tradeRows] = await Promise.all([
    db
      .select({
        sourceFileId: rawTradeRows.sourceFileId,
        importBatchId: rawTradeRows.importBatchId,
        tradeFlow: rawTradeRows.tradeFlow,
        originalFilename: sourceFiles.originalFilename,
        normalizedRawFilename: sourceFiles.normalizedRawFilename,
        batchStatus: importBatches.status,
        rawRows: count(),
        parsedRows: sql<number>`count(*) filter (where ${rawTradeRows.parseStatus} = 'parsed')`,
        failedRows: sql<number>`count(*) filter (where ${rawTradeRows.parseStatus} = 'failed')`,
      })
      .from(rawTradeRows)
      .innerJoin(sourceFiles, eq(rawTradeRows.sourceFileId, sourceFiles.id))
      .innerJoin(importBatches, eq(rawTradeRows.importBatchId, importBatches.id))
      .where(marchRawWhere())
      .groupBy(
        rawTradeRows.sourceFileId,
        rawTradeRows.importBatchId,
        rawTradeRows.tradeFlow,
        sourceFiles.originalFilename,
        sourceFiles.normalizedRawFilename,
        importBatches.status,
      )
      .orderBy(asc(rawTradeRows.tradeFlow), asc(sourceFiles.originalFilename)),
    db
      .select({
        sourceFileId: tradeRecords.sourceFileId,
        importBatchId: tradeRecords.importBatchId,
        tradeFlow: tradeRecords.tradeFlow,
        tradeRecords: count(),
      })
      .from(tradeRecords)
      .where(marchTradeWhere())
      .groupBy(
        tradeRecords.sourceFileId,
        tradeRecords.importBatchId,
        tradeRecords.tradeFlow,
      ),
  ]);

  return sourceCoverageRows({ rawRows, tradeRows });
}

async function loadPayloadCoverage(db: DbClient): Promise<DataQualityPayloadCoverage[]> {
  const rows = await db
    .select({
      tradeFlow: rawTradeRows.tradeFlow,
      retentionMode: rawTradeRows.payloadRetentionMode,
      storageKind: rawTradeRows.payloadStorageKind,
      reconstructable: rawTradeRows.payloadReconstructable,
      rows: count(),
    })
    .from(rawTradeRows)
    .where(marchRawWhere())
    .groupBy(
      rawTradeRows.tradeFlow,
      rawTradeRows.payloadRetentionMode,
      rawTradeRows.payloadStorageKind,
      rawTradeRows.payloadReconstructable,
    )
    .orderBy(
      asc(rawTradeRows.tradeFlow),
      asc(rawTradeRows.payloadRetentionMode),
      asc(rawTradeRows.payloadStorageKind),
    );

  return rows.map((row) => ({
    tradeFlow:
      row.tradeFlow === "import" || row.tradeFlow === "export" ? row.tradeFlow : "unknown",
    retentionMode: row.retentionMode,
    storageKind: row.storageKind,
    reconstructable: Boolean(row.reconstructable),
    rows: toNumber(row.rows),
  }));
}

export async function getMarch2026DataQualityReport(
  db: DbClient,
): Promise<DataQualityReport> {
  const [flows, sourceCoverage, fieldCoverage, labelCoverage, payloadCoverage] =
    await Promise.all([
      loadFlowSummaries(db),
      loadSourceCoverage(db),
      loadFieldCoverage(db),
      loadLabelCoverage(db),
      loadPayloadCoverage(db),
    ]);
  const [issueGroups, sourceBatchRemediation] = await Promise.all([
    loadDataQualityIssueGroups(db),
    getMarch2026SourceBatchRemediation(db),
  ]);

  const totals = flows.reduce(
    (summary, flow) => ({
      rawRows: summary.rawRows + flow.rawRows,
      parsedRows: summary.parsedRows + flow.parsedRows,
      failedRows: summary.failedRows + flow.failedRows,
      warningRows: summary.warningRows + flow.warningRows,
      tradeRecords: summary.tradeRecords + flow.tradeRecords,
      rawToTradeDelta: summary.rawToTradeDelta + flow.rawToTradeDelta,
    }),
    {
      rawRows: 0,
      parsedRows: 0,
      failedRows: 0,
      warningRows: 0,
      tradeRecords: 0,
      rawToTradeDelta: 0,
    },
  );

  return {
    period: reportPeriod,
    totals,
    flows,
    sourceCoverage,
    fieldCoverage,
    labelCoverage,
    payloadCoverage,
    issueGroups,
    sourceBatchRemediation,
    findings: buildDataQualityFindings({
      fieldCoverage,
      flows,
      labelCoverage,
      payloadCoverage,
    }),
  };
}
