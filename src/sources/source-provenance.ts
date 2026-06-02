import { asc, desc, eq, ne, sql } from "drizzle-orm";

import type { DbClient } from "../db/client";
import {
  importBatches,
  sourceFiles,
} from "../db/schema";
import { isSourceProvenanceId } from "@/sources/source-provenance-helpers";
import {
  batchCountsBySource,
  emptySourceCount,
  flowCoverageForSource,
  rawCountForSource,
  rawCountsByBatch,
  rawCountsBySource,
  tradeCountForSource,
  tradeCountsByBatch,
  tradeCountsBySource,
  type SourceCount,
  type SourceFlowCoverage,
} from "@/sources/source-provenance-counts";

export {
  type SourceFlowCoverage,
} from "@/sources/source-provenance-counts";
export {
  isSourceProvenanceId,
  safeSourcePageUrl,
  sourceDisplayFilename,
  sourceFileRoleLabel,
  sourceFilenameLabel,
  sourcePeriodLabel,
  sourceProcessingStatusLabel,
  sourceTradeFlow,
  sourceTradeFlowLabel,
  sourceTradeRecordsHref,
} from "@/sources/source-provenance-helpers";

type SourceFileRow = typeof sourceFiles.$inferSelect;
type ImportBatchRow = typeof importBatches.$inferSelect;

export type SourceProvenanceSummary = {
  id: string;
  countryCode: string;
  sourceSystem: string;
  sourceDomain: string;
  sourceName: string | null;
  sourcePageUrl: string | null;
  acquisitionMethod: string | null;
  originalFilename: string;
  normalizedRawFilename: string | null;
  normalizedWorkingFilename: string | null;
  fileHashSha256: string | null;
  fileSizeBytes: number | null;
  fileFormat: string | null;
  compressionFormat: string | null;
  fileRole: string;
  tradeFlow: string | null;
  sourceCategory: string | null;
  periodYear: number | null;
  periodMonth: number | null;
  periodStart: string | null;
  periodEnd: string | null;
  licenseNotes: string | null;
  processingStatus: string;
  hasRawStoragePointer: boolean;
  hasWorkingStoragePointer: boolean;
  createdAt: Date;
  updatedAt: Date;
  importBatchCount: number;
  rawRowCount: number;
  parsedRawRowCount: number;
  failedRawRowCount: number;
  tradeRecordCount: number;
};

export type ImportBatchProvenance = {
  id: string;
  parserName: string;
  parserVersion: string;
  status: string;
  startedAt: Date | null;
  completedAt: Date | null;
  rowsTotal: number | null;
  rowsParsed: number | null;
  rowsFailed: number | null;
  warningSummary: string | null;
  errorSummary: string | null;
  createdAt: Date;
  updatedAt: Date;
  rawRowCount: number;
  parsedRawRowCount: number;
  failedRawRowCount: number;
  tradeRecordCount: number;
};

export type SourceProvenanceDetail = SourceProvenanceSummary & {
  importBatches: ImportBatchProvenance[];
  flowCoverage: SourceFlowCoverage[];
};

function sourceSummaryFromRow({
  batchCount = 0,
  rawCount = emptySourceCount,
  row,
  tradeRecordCount = 0,
}: {
  row: SourceFileRow;
  batchCount?: number;
  rawCount?: SourceCount;
  tradeRecordCount?: number;
}): SourceProvenanceSummary {
  return {
    id: row.id,
    countryCode: row.countryCode,
    sourceSystem: row.sourceSystem,
    sourceDomain: row.sourceDomain,
    sourceName: row.sourceName,
    sourcePageUrl: row.sourcePageUrl,
    acquisitionMethod: row.acquisitionMethod,
    originalFilename: row.originalFilename,
    normalizedRawFilename: row.normalizedRawFilename,
    normalizedWorkingFilename: row.normalizedWorkingFilename,
    fileHashSha256: row.fileHashSha256,
    fileSizeBytes: row.fileSizeBytes,
    fileFormat: row.fileFormat,
    compressionFormat: row.compressionFormat,
    fileRole: row.fileRole,
    tradeFlow: row.tradeFlow,
    sourceCategory: row.sourceCategory,
    periodYear: row.periodYear,
    periodMonth: row.periodMonth,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    licenseNotes: row.licenseNotes,
    processingStatus: row.processingStatus,
    hasRawStoragePointer: Boolean(row.storageBucket || row.storageKey),
    hasWorkingStoragePointer: Boolean(row.workingStorageKey),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    importBatchCount: batchCount,
    rawRowCount: rawCount.total,
    parsedRawRowCount: rawCount.parsed,
    failedRawRowCount: rawCount.failed,
    tradeRecordCount,
  };
}

function batchSummaryFromRow({
  rawCount = emptySourceCount,
  row,
  tradeRecordCount = 0,
}: {
  row: ImportBatchRow;
  rawCount?: SourceCount;
  tradeRecordCount?: number;
}): ImportBatchProvenance {
  return {
    id: row.id,
    parserName: row.parserName,
    parserVersion: row.parserVersion,
    status: row.status,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    rowsTotal: row.rowsTotal,
    rowsParsed: row.rowsParsed,
    rowsFailed: row.rowsFailed,
    warningSummary: row.warningSummary,
    errorSummary: row.errorSummary,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    rawRowCount: rawCount.total,
    parsedRawRowCount: rawCount.parsed,
    failedRawRowCount: rawCount.failed,
    tradeRecordCount,
  };
}

export async function listSourceProvenance(
  db: DbClient,
): Promise<SourceProvenanceSummary[]> {
  const [sources, batchCounts, rawCounts, tradeCounts] = await Promise.all([
    db
      .select()
      .from(sourceFiles)
      .where(ne(sourceFiles.sourceSystem, "duanera_test"))
      .orderBy(
        desc(sql<number>`case when ${sourceFiles.sourceCategory} = 'dataset_resource' then 1 else 0 end`),
        asc(sql<boolean>`${sourceFiles.periodYear} is null`),
        desc(sourceFiles.periodYear),
        desc(sourceFiles.periodMonth),
        asc(sourceFiles.sourceDomain),
        asc(sourceFiles.originalFilename),
      ),
    batchCountsBySource(db),
    rawCountsBySource(db),
    tradeCountsBySource(db),
  ]);

  return sources.map((row) =>
    sourceSummaryFromRow({
      row,
      batchCount: batchCounts.get(row.id) ?? 0,
      rawCount: rawCounts.get(row.id) ?? emptySourceCount,
      tradeRecordCount: tradeCounts.get(row.id) ?? 0,
    }),
  );
}

export async function getSourceProvenanceById(
  db: DbClient,
  id: string,
): Promise<SourceProvenanceDetail | null> {
  if (!isSourceProvenanceId(id)) {
    return null;
  }

  const rows = await db.select().from(sourceFiles).where(eq(sourceFiles.id, id)).limit(1);
  const source = rows[0];

  if (!source) {
    return null;
  }

  const [
    rawCount,
    tradeRecordCount,
    batchRows,
    batchRawCounts,
    batchTradeCounts,
    coverage,
  ] = await Promise.all([
    rawCountForSource(db, id),
    tradeCountForSource(db, id),
    db
      .select()
      .from(importBatches)
      .where(eq(importBatches.sourceFileId, id))
      .orderBy(asc(importBatches.startedAt), asc(importBatches.createdAt)),
    rawCountsByBatch(db, id),
    tradeCountsByBatch(db, id),
    flowCoverageForSource(db, id),
  ]);

  const summary = sourceSummaryFromRow({
    row: source,
    batchCount: batchRows.length,
    rawCount,
    tradeRecordCount,
  });

  return {
    ...summary,
    importBatches: batchRows.map((batch) =>
      batchSummaryFromRow({
        row: batch,
        rawCount: batchRawCounts.get(batch.id) ?? emptySourceCount,
        tradeRecordCount: batchTradeCounts.get(batch.id) ?? 0,
      }),
    ),
    flowCoverage: coverage,
  };
}
