import { asc, count, desc, eq, ne, sql } from "drizzle-orm";

import type { DbClient } from "../db/client";
import {
  importBatches,
  rawTradeRows,
  sourceFiles,
  tradeRecords,
} from "../db/schema";

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

export type SourceFlowCoverage = {
  tradeFlow: string;
  periodYear: number;
  periodMonth: number;
  rawRowCount: number;
  tradeRecordCount: number;
};

export type SourceProvenanceDetail = SourceProvenanceSummary & {
  importBatches: ImportBatchProvenance[];
  flowCoverage: SourceFlowCoverage[];
};

type SourceCountRow = {
  sourceFileId: string;
  importBatchId?: string | null;
  total: number | string | null;
  parsed?: number | string | null;
  failed?: number | string | null;
};

type SourceCount = {
  total: number;
  parsed: number;
  failed: number;
};

const emptyCount: SourceCount = {
  total: 0,
  parsed: 0,
  failed: 0,
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) {
    return 0;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

export function sourceFilenameLabel(filename: string | null | undefined) {
  if (!filename) {
    return null;
  }

  return filename.split(/[\\/]/).filter(Boolean).at(-1) ?? filename;
}

export function isSourceProvenanceId(value: string) {
  return uuidPattern.test(value);
}

function countFromRow(row?: SourceCountRow): SourceCount {
  if (!row) {
    return emptyCount;
  }

  return {
    total: toNumber(row.total),
    parsed: toNumber(row.parsed),
    failed: toNumber(row.failed),
  };
}

function countsBySource(rows: SourceCountRow[]) {
  return new Map(rows.map((row) => [row.sourceFileId, countFromRow(row)]));
}

function countsByBatch(rows: SourceCountRow[]) {
  return new Map(
    rows
      .filter((row) => row.importBatchId)
      .map((row) => [row.importBatchId as string, countFromRow(row)]),
  );
}

function tradeRecordCountsBySource(
  rows: Array<{ sourceFileId: string; total: number | string | null }>,
) {
  return new Map(rows.map((row) => [row.sourceFileId, toNumber(row.total)]));
}

function tradeRecordCountsByBatch(
  rows: Array<{
    importBatchId: string | null;
    total: number | string | null;
  }>,
) {
  return new Map(
    rows
      .filter((row) => row.importBatchId)
      .map((row) => [row.importBatchId as string, toNumber(row.total)]),
  );
}

function sourceSummaryFromRow({
  batchCount = 0,
  rawCount = emptyCount,
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
  rawCount = emptyCount,
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

export function sourceDisplayFilename(source: Pick<
  SourceProvenanceSummary,
  "normalizedRawFilename" | "originalFilename"
>) {
  return sourceFilenameLabel(source.normalizedRawFilename ?? source.originalFilename)
    ?? source.originalFilename;
}

export function sourcePeriodLabel(
  source: Pick<
    SourceProvenanceSummary,
    "periodYear" | "periodMonth" | "periodStart" | "periodEnd"
  >,
) {
  if (source.periodYear && source.periodMonth) {
    return `${source.periodYear}-${String(source.periodMonth).padStart(2, "0")}`;
  }

  if (source.periodStart && source.periodEnd) {
    return `${source.periodStart} a ${source.periodEnd}`;
  }

  return "No informado";
}

export function sourceTradeRecordsHref({
  importBatchId,
  sourceFileId,
  tradeFlow,
}: {
  sourceFileId: string;
  importBatchId?: string;
  tradeFlow?: "import" | "export";
}) {
  const query = new URLSearchParams({
    sourceFileId,
    limit: "25",
  });

  if (tradeFlow) {
    query.set("tradeFlow", tradeFlow);
  }

  if (importBatchId) {
    query.set("importBatchId", importBatchId);
  }

  return `/trade-records?${query.toString()}`;
}

async function rawCountsBySource(db: DbClient) {
  const rows = await db
    .select({
      sourceFileId: rawTradeRows.sourceFileId,
      total: count(),
      parsed: sql<number>`count(*) filter (where ${rawTradeRows.parseStatus} = 'parsed')`,
      failed: sql<number>`count(*) filter (where ${rawTradeRows.parseStatus} = 'failed')`,
    })
    .from(rawTradeRows)
    .groupBy(rawTradeRows.sourceFileId);

  return countsBySource(rows);
}

async function rawCountForSource(db: DbClient, sourceFileId: string) {
  const rows = await db
    .select({
      sourceFileId: rawTradeRows.sourceFileId,
      total: count(),
      parsed: sql<number>`count(*) filter (where ${rawTradeRows.parseStatus} = 'parsed')`,
      failed: sql<number>`count(*) filter (where ${rawTradeRows.parseStatus} = 'failed')`,
    })
    .from(rawTradeRows)
    .where(eq(rawTradeRows.sourceFileId, sourceFileId))
    .groupBy(rawTradeRows.sourceFileId);

  return countFromRow(rows[0]);
}

async function rawCountsByBatch(db: DbClient, sourceFileId: string) {
  const rows = await db
    .select({
      sourceFileId: rawTradeRows.sourceFileId,
      importBatchId: rawTradeRows.importBatchId,
      total: count(),
      parsed: sql<number>`count(*) filter (where ${rawTradeRows.parseStatus} = 'parsed')`,
      failed: sql<number>`count(*) filter (where ${rawTradeRows.parseStatus} = 'failed')`,
    })
    .from(rawTradeRows)
    .where(eq(rawTradeRows.sourceFileId, sourceFileId))
    .groupBy(rawTradeRows.sourceFileId, rawTradeRows.importBatchId);

  return countsByBatch(rows);
}

async function tradeCountsBySource(db: DbClient) {
  const rows = await db
    .select({
      sourceFileId: tradeRecords.sourceFileId,
      total: count(),
    })
    .from(tradeRecords)
    .groupBy(tradeRecords.sourceFileId);

  return tradeRecordCountsBySource(rows);
}

async function tradeCountForSource(db: DbClient, sourceFileId: string) {
  const rows = await db
    .select({
      sourceFileId: tradeRecords.sourceFileId,
      total: count(),
    })
    .from(tradeRecords)
    .where(eq(tradeRecords.sourceFileId, sourceFileId))
    .groupBy(tradeRecords.sourceFileId);

  return toNumber(rows[0]?.total);
}

async function tradeCountsByBatch(db: DbClient, sourceFileId: string) {
  const rows = await db
    .select({
      importBatchId: tradeRecords.importBatchId,
      total: count(),
    })
    .from(tradeRecords)
    .where(eq(tradeRecords.sourceFileId, sourceFileId))
    .groupBy(tradeRecords.importBatchId);

  return tradeRecordCountsByBatch(rows);
}

async function batchCountsBySource(db: DbClient) {
  const rows = await db
    .select({
      sourceFileId: importBatches.sourceFileId,
      total: count(),
    })
    .from(importBatches)
    .groupBy(importBatches.sourceFileId);

  return new Map(rows.map((row) => [row.sourceFileId, toNumber(row.total)]));
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
      rawCount: rawCounts.get(row.id) ?? emptyCount,
      tradeRecordCount: tradeCounts.get(row.id) ?? 0,
    }),
  );
}

async function flowCoverageForSource(
  db: DbClient,
  sourceFileId: string,
): Promise<SourceFlowCoverage[]> {
  const [rawRows, tradeRows] = await Promise.all([
    db
      .select({
        tradeFlow: rawTradeRows.tradeFlow,
        periodYear: rawTradeRows.periodYear,
        periodMonth: rawTradeRows.periodMonth,
        rawRowCount: count(),
      })
      .from(rawTradeRows)
      .where(eq(rawTradeRows.sourceFileId, sourceFileId))
      .groupBy(rawTradeRows.tradeFlow, rawTradeRows.periodYear, rawTradeRows.periodMonth),
    db
      .select({
        tradeFlow: tradeRecords.tradeFlow,
        periodYear: tradeRecords.periodYear,
        periodMonth: tradeRecords.periodMonth,
        tradeRecordCount: count(),
      })
      .from(tradeRecords)
      .where(eq(tradeRecords.sourceFileId, sourceFileId))
      .groupBy(tradeRecords.tradeFlow, tradeRecords.periodYear, tradeRecords.periodMonth),
  ]);

  const coverage = new Map<string, SourceFlowCoverage>();

  for (const row of rawRows) {
    if (!row.tradeFlow || !row.periodYear || !row.periodMonth) {
      continue;
    }

    const key = `${row.tradeFlow}:${row.periodYear}:${row.periodMonth}`;
    coverage.set(key, {
      tradeFlow: row.tradeFlow,
      periodYear: row.periodYear,
      periodMonth: row.periodMonth,
      rawRowCount: toNumber(row.rawRowCount),
      tradeRecordCount: 0,
    });
  }

  for (const row of tradeRows) {
    const key = `${row.tradeFlow}:${row.periodYear}:${row.periodMonth}`;
    const existing = coverage.get(key);
    coverage.set(key, {
      tradeFlow: row.tradeFlow,
      periodYear: row.periodYear,
      periodMonth: row.periodMonth,
      rawRowCount: existing?.rawRowCount ?? 0,
      tradeRecordCount: toNumber(row.tradeRecordCount),
    });
  }

  return Array.from(coverage.values()).sort((a, b) => {
    if (a.periodYear !== b.periodYear) {
      return b.periodYear - a.periodYear;
    }

    if (a.periodMonth !== b.periodMonth) {
      return b.periodMonth - a.periodMonth;
    }

    return a.tradeFlow.localeCompare(b.tradeFlow);
  });
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
        rawCount: batchRawCounts.get(batch.id) ?? emptyCount,
        tradeRecordCount: batchTradeCounts.get(batch.id) ?? 0,
      }),
    ),
    flowCoverage: coverage,
  };
}
