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
  march2026ReportPeriod,
  qualityRawTradeRowsWhere,
  qualityTradeRecordsWhere,
  type QualityReportPeriod,
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
import {
  getMarch2026SourceBatchRemediation,
  getSourceBatchRemediation,
} from "@/quality/data-quality-source-batch-remediation";

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
  getSourceBatchRemediation,
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
  period: QualityReportPeriod;
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

async function loadFlowSummaries(
  db: DbClient,
  period: QualityReportPeriod,
): Promise<DataQualityFlowSummary[]> {
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
      .where(qualityRawTradeRowsWhere(period))
      .groupBy(rawTradeRows.tradeFlow),
    db
      .select({
        tradeFlow: tradeRecords.tradeFlow,
        tradeRecords: count(),
      })
      .from(tradeRecords)
      .where(qualityTradeRecordsWhere(period))
      .groupBy(tradeRecords.tradeFlow),
  ]);

  return flowSummariesFromRows({ rawRows, tradeRows });
}

async function loadSourceCoverage(
  db: DbClient,
  period: QualityReportPeriod,
): Promise<DataQualitySourceCoverage[]> {
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
      .where(qualityRawTradeRowsWhere(period))
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
      .where(qualityTradeRecordsWhere(period))
      .groupBy(
        tradeRecords.sourceFileId,
        tradeRecords.importBatchId,
        tradeRecords.tradeFlow,
      ),
  ]);

  return sourceCoverageRows({ rawRows, tradeRows });
}

async function loadPayloadCoverage(
  db: DbClient,
  period: QualityReportPeriod,
): Promise<DataQualityPayloadCoverage[]> {
  const rows = await db
    .select({
      tradeFlow: rawTradeRows.tradeFlow,
      retentionMode: rawTradeRows.payloadRetentionMode,
      storageKind: rawTradeRows.payloadStorageKind,
      retainedReason: rawTradeRows.payloadRetainedReason,
      reconstructable: rawTradeRows.payloadReconstructable,
      rows: count(),
      retainedPayloadRows: sql<number>`count(*) filter (where ${rawTradeRows.rawText} is not null or ${rawTradeRows.rawValues} is not null)`,
      prunedPayloadRows: sql<number>`count(*) filter (where ${rawTradeRows.rawText} is null and ${rawTradeRows.rawValues} is null)`,
    })
    .from(rawTradeRows)
    .where(qualityRawTradeRowsWhere(period))
    .groupBy(
      rawTradeRows.tradeFlow,
      rawTradeRows.payloadRetentionMode,
      rawTradeRows.payloadStorageKind,
      rawTradeRows.payloadRetainedReason,
      rawTradeRows.payloadReconstructable,
    )
    .orderBy(
      asc(rawTradeRows.tradeFlow),
      asc(rawTradeRows.payloadRetentionMode),
      asc(rawTradeRows.payloadStorageKind),
      asc(rawTradeRows.payloadRetainedReason),
    );

  return rows.map((row) => ({
    tradeFlow:
      row.tradeFlow === "import" || row.tradeFlow === "export" ? row.tradeFlow : "unknown",
    retentionMode: row.retentionMode,
    storageKind: row.storageKind,
    retainedReason: row.retainedReason,
    reconstructable: Boolean(row.reconstructable),
    rows: toNumber(row.rows),
    retainedPayloadRows: toNumber(row.retainedPayloadRows),
    prunedPayloadRows: toNumber(row.prunedPayloadRows),
  }));
}

export async function getDataQualityReport(
  db: DbClient,
  period: QualityReportPeriod = march2026ReportPeriod,
): Promise<DataQualityReport> {
  const [flows, sourceCoverage, fieldCoverage, labelCoverage, payloadCoverage] =
    await Promise.all([
      loadFlowSummaries(db, period),
      loadSourceCoverage(db, period),
      loadFieldCoverage(db, period),
      loadLabelCoverage(db, period),
      loadPayloadCoverage(db, period),
    ]);
  const [issueGroups, sourceBatchRemediation] = await Promise.all([
    loadDataQualityIssueGroups(db, period),
    getSourceBatchRemediation(db, { period }),
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
    period,
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

export async function getMarch2026DataQualityReport(
  db: DbClient,
): Promise<DataQualityReport> {
  return getDataQualityReport(db, march2026ReportPeriod);
}
