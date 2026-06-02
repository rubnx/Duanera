import {
  and,
  asc,
  count,
  eq,
  sql,
  type SQL,
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
import type { TradeFlow } from "@/trade/trade-records";
import {
  march2026RawTradeRowsWhere,
  march2026ReportPeriod,
  march2026TradeRecordsWhere,
} from "@/quality/march-2026";
import {
  addUndecodedSourceBatchCounts,
  dataQualitySourceBatchKey,
  finalizeSourceBatchRemediationRows,
  sourceBatchRemediationFromRow,
  type DataQualitySourceBatchRemediation,
  type SourceBatchCodeCountRow,
  type SourceBatchRemediationBaseRow,
} from "@/quality/source-batch-remediation";
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
import { loadCodeValueSets } from "@/quality/code-value-sets";
import {
  loadFieldCoverage,
  loadLabelCoverage,
} from "@/quality/data-quality-coverage-loaders";
import { dusExportSpecialLogisticsCodes } from "@/quality/source-special-codes";

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

function sourceBatchRemediationWhere(sourceFileId?: string): SQL {
  const conditions = [marchTradeWhere()];

  if (sourceFileId) {
    conditions.push(eq(tradeRecords.sourceFileId, sourceFileId));
  }

  return and(...conditions) ?? sql`true`;
}

async function loadSourceBatchRemediationBaseRows({
  db,
  sourceFileId,
}: {
  db: DbClient;
  sourceFileId?: string;
}): Promise<SourceBatchRemediationBaseRow[]> {
  const where = sourceBatchRemediationWhere(sourceFileId);
  const itemValueMissingOrZero = sql`
    (
      (${tradeRecords.tradeFlow} = 'import' and (${tradeRecords.itemCifValue} is null or ${tradeRecords.itemCifValue} <= 0))
      or (${tradeRecords.tradeFlow} = 'export' and (${tradeRecords.itemFobValue} is null or ${tradeRecords.itemFobValue} <= 0))
    )
  `;
  const positiveItemValue = sql`
    (
      (${tradeRecords.tradeFlow} = 'import' and ${tradeRecords.itemCifValue} > 0)
      or (${tradeRecords.tradeFlow} = 'export' and ${tradeRecords.itemFobValue} > 0)
    )
  `;

  return db
    .select({
      sourceFileId: tradeRecords.sourceFileId,
      importBatchId: tradeRecords.importBatchId,
      tradeFlow: tradeRecords.tradeFlow,
      originalFilename: sourceFiles.originalFilename,
      normalizedRawFilename: sourceFiles.normalizedRawFilename,
      parserName: importBatches.parserName,
      parserVersion: importBatches.parserVersion,
      batchStatus: importBatches.status,
      tradeRecords: count(),
      missingImportGrossWeightItem: sql<number>`count(*) filter (where ${tradeRecords.tradeFlow} = 'import' and ${tradeRecords.grossWeightItem} is null)`,
      missingOrZeroItemValue: sql<number>`count(*) filter (where ${itemValueMissingOrZero})`,
      missingOrZeroDeclarationFob: sql<number>`count(*) filter (where ${tradeRecords.declarationFobValue} is null or ${tradeRecords.declarationFobValue} <= 0)`,
      quantityUnitValueReview: sql<number>`count(*) filter (where (
        (${tradeRecords.quantity} is not null and ${tradeRecords.quantityUnitCode} is null)
        or (${tradeRecords.quantity} is null and ${tradeRecords.quantityUnitCode} is not null)
        or (${tradeRecords.quantity} <= 0 and ${positiveItemValue})
        or (${tradeRecords.unitPriceValue} is null and ${tradeRecords.quantity} > 0 and ${positiveItemValue})
        or (${tradeRecords.unitPriceValue} <= 0 and ${positiveItemValue})
      ))`,
    })
    .from(tradeRecords)
    .innerJoin(sourceFiles, eq(tradeRecords.sourceFileId, sourceFiles.id))
    .innerJoin(importBatches, eq(tradeRecords.importBatchId, importBatches.id))
    .where(where)
    .groupBy(
      tradeRecords.sourceFileId,
      tradeRecords.importBatchId,
      tradeRecords.tradeFlow,
      sourceFiles.originalFilename,
      sourceFiles.normalizedRawFilename,
      importBatches.parserName,
      importBatches.parserVersion,
      importBatches.status,
    );
}

async function sourceBatchCodeCounts({
  db,
  expression,
  sourceFileId,
  tradeFlow,
}: {
  db: DbClient;
  expression: SQL<string>;
  sourceFileId?: string;
  tradeFlow: TradeFlow;
}): Promise<SourceBatchCodeCountRow[]> {
  const conditions = [
    marchTradeWhere(tradeFlow),
    sql`${expression} is not null`,
    sql`${expression} <> ''`,
  ];

  if (sourceFileId) {
    conditions.push(eq(tradeRecords.sourceFileId, sourceFileId));
  }

  return db
    .select({
      sourceFileId: tradeRecords.sourceFileId,
      importBatchId: tradeRecords.importBatchId,
      tradeFlow: tradeRecords.tradeFlow,
      code: expression,
      records: count(),
    })
    .from(tradeRecords)
    .where(and(...conditions))
    .groupBy(
      tradeRecords.sourceFileId,
      tradeRecords.importBatchId,
      tradeRecords.tradeFlow,
      expression,
    );
}

export async function getMarch2026SourceBatchRemediation(
  db: DbClient,
  options: {
    limit?: number;
    sourceFileId?: string;
  } = {},
): Promise<DataQualitySourceBatchRemediation[]> {
  const [baseRows, codeSets] = await Promise.all([
    loadSourceBatchRemediationBaseRows({
      db,
      sourceFileId: options.sourceFileId,
    }),
    loadCodeValueSets(db),
  ]);

  const remediationRows = baseRows
    .map(sourceBatchRemediationFromRow)
    .filter((row): row is DataQualitySourceBatchRemediation => Boolean(row));
  const remediationByKey = new Map(
    remediationRows.map((row) => [dataQualitySourceBatchKey(row), row]),
  );

  const [
    importCustoms,
    exportCustoms,
    importPorts,
    exportPorts,
    importTransport,
    exportTransport,
  ] = await Promise.all([
    sourceBatchCodeCounts({
      db,
      expression: sql<string>`${tradeRecords.customsOfficeCode}`,
      sourceFileId: options.sourceFileId,
      tradeFlow: "import",
    }),
    sourceBatchCodeCounts({
      db,
      expression: sql<string>`${tradeRecords.customsOfficeCode}`,
      sourceFileId: options.sourceFileId,
      tradeFlow: "export",
    }),
    sourceBatchCodeCounts({
      db,
      expression: sql<string>`${tradeRecords.disembarkPortCode}`,
      sourceFileId: options.sourceFileId,
      tradeFlow: "import",
    }),
    sourceBatchCodeCounts({
      db,
      expression: sql<string>`${tradeRecords.embarkPortCode}`,
      sourceFileId: options.sourceFileId,
      tradeFlow: "export",
    }),
    sourceBatchCodeCounts({
      db,
      expression: sql<string>`${tradeRecords.transportModeCode}`,
      sourceFileId: options.sourceFileId,
      tradeFlow: "import",
    }),
    sourceBatchCodeCounts({
      db,
      expression: sql<string>`${tradeRecords.transportModeCode}`,
      sourceFileId: options.sourceFileId,
      tradeFlow: "export",
    }),
  ]);

  addUndecodedSourceBatchCounts({
    codeSet: codeSets.customsOffices,
    field: "undecodedCustomsOffice",
    remediationByKey,
    rows: [...importCustoms, ...exportCustoms],
  });
  addUndecodedSourceBatchCounts({
    codeSet: codeSets.ports,
    field: "undecodedPort",
    remediationByKey,
    rows: importPorts,
  });
  addUndecodedSourceBatchCounts({
    codeSet: codeSets.ports,
    field: "undecodedPort",
    ignoredSourceCodes: dusExportSpecialLogisticsCodes,
    remediationByKey,
    rows: exportPorts,
  });
  addUndecodedSourceBatchCounts({
    codeSet: codeSets.transportModes,
    field: "undecodedTransportMode",
    remediationByKey,
    rows: importTransport,
  });
  addUndecodedSourceBatchCounts({
    codeSet: codeSets.transportModes,
    field: "undecodedTransportMode",
    ignoredSourceCodes: dusExportSpecialLogisticsCodes,
    remediationByKey,
    rows: exportTransport,
  });

  return finalizeSourceBatchRemediationRows(remediationRows).slice(0, options.limit ?? 8);
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
