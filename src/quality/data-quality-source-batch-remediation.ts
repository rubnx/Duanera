import {
  and,
  count,
  eq,
  sql,
  type SQL,
} from "drizzle-orm";

import type { DbClient } from "@/db/client";
import {
  importBatches,
  sourceFiles,
  tradeRecords,
} from "@/db/schema";
import { loadCodeValueSets } from "@/quality/code-value-sets";
import {
  march2026ReportPeriod,
  qualityTradeRecordsWhere,
  type QualityReportPeriod,
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
import { dusExportSpecialLogisticsCodes } from "@/quality/source-special-codes";
import type { TradeFlow } from "@/trade/trade-records";

function sourceBatchRemediationWhere(
  period: QualityReportPeriod,
  sourceFileId?: string,
): SQL {
  const conditions = [qualityTradeRecordsWhere(period)];

  if (sourceFileId) {
    conditions.push(eq(tradeRecords.sourceFileId, sourceFileId));
  }

  return and(...conditions) ?? sql`true`;
}

async function loadSourceBatchRemediationBaseRows({
  db,
  period,
  sourceFileId,
}: {
  db: DbClient;
  period: QualityReportPeriod;
  sourceFileId?: string;
}): Promise<SourceBatchRemediationBaseRow[]> {
  const where = sourceBatchRemediationWhere(period, sourceFileId);
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
  period,
  sourceFileId,
  tradeFlow,
}: {
  db: DbClient;
  expression: SQL<string>;
  period: QualityReportPeriod;
  sourceFileId?: string;
  tradeFlow: TradeFlow;
}): Promise<SourceBatchCodeCountRow[]> {
  const conditions = [
    qualityTradeRecordsWhere(period, tradeFlow),
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

export async function getSourceBatchRemediation(
  db: DbClient,
  options: {
    limit?: number;
    period?: QualityReportPeriod;
    sourceFileId?: string;
  } = {},
): Promise<DataQualitySourceBatchRemediation[]> {
  const period = options.period ?? march2026ReportPeriod;
  const [baseRows, codeSets] = await Promise.all([
    loadSourceBatchRemediationBaseRows({
      db,
      period,
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
      period,
      sourceFileId: options.sourceFileId,
      tradeFlow: "import",
    }),
    sourceBatchCodeCounts({
      db,
      expression: sql<string>`${tradeRecords.customsOfficeCode}`,
      period,
      sourceFileId: options.sourceFileId,
      tradeFlow: "export",
    }),
    sourceBatchCodeCounts({
      db,
      expression: sql<string>`${tradeRecords.disembarkPortCode}`,
      period,
      sourceFileId: options.sourceFileId,
      tradeFlow: "import",
    }),
    sourceBatchCodeCounts({
      db,
      expression: sql<string>`${tradeRecords.embarkPortCode}`,
      period,
      sourceFileId: options.sourceFileId,
      tradeFlow: "export",
    }),
    sourceBatchCodeCounts({
      db,
      expression: sql<string>`${tradeRecords.transportModeCode}`,
      period,
      sourceFileId: options.sourceFileId,
      tradeFlow: "import",
    }),
    sourceBatchCodeCounts({
      db,
      expression: sql<string>`${tradeRecords.transportModeCode}`,
      period,
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

export async function getMarch2026SourceBatchRemediation(
  db: DbClient,
  options: {
    limit?: number;
    sourceFileId?: string;
  } = {},
): Promise<DataQualitySourceBatchRemediation[]> {
  return getSourceBatchRemediation(db, {
    ...options,
    period: march2026ReportPeriod,
  });
}
