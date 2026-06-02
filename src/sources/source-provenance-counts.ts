import { asc, count, eq, sql } from "drizzle-orm";

import type { DbClient } from "@/db/client";
import { countValueToNumber } from "@/db/count-values";
import {
  importBatches,
  rawTradeRows,
  tradeRecords,
} from "@/db/schema";

type SourceCountRow = {
  sourceFileId: string;
  importBatchId?: string | null;
  total: number | string | null;
  parsed?: number | string | null;
  failed?: number | string | null;
};

export type SourceCount = {
  total: number;
  parsed: number;
  failed: number;
};

export type SourceFlowCoverage = {
  tradeFlow: string;
  periodYear: number;
  periodMonth: number;
  rawRowCount: number;
  tradeRecordCount: number;
};

export const emptySourceCount: SourceCount = {
  total: 0,
  parsed: 0,
  failed: 0,
};

const toNumber = countValueToNumber;

function countFromRow(row?: SourceCountRow): SourceCount {
  if (!row) {
    return emptySourceCount;
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

export async function rawCountsBySource(db: DbClient) {
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

export async function rawCountForSource(db: DbClient, sourceFileId: string) {
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

export async function rawCountsByBatch(db: DbClient, sourceFileId: string) {
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

export async function tradeCountsBySource(db: DbClient) {
  const rows = await db
    .select({
      sourceFileId: tradeRecords.sourceFileId,
      total: count(),
    })
    .from(tradeRecords)
    .groupBy(tradeRecords.sourceFileId);

  return tradeRecordCountsBySource(rows);
}

export async function tradeCountForSource(db: DbClient, sourceFileId: string) {
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

export async function tradeCountsByBatch(db: DbClient, sourceFileId: string) {
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

export async function batchCountsBySource(db: DbClient) {
  const rows = await db
    .select({
      sourceFileId: importBatches.sourceFileId,
      total: count(),
    })
    .from(importBatches)
    .groupBy(importBatches.sourceFileId);

  return new Map(rows.map((row) => [row.sourceFileId, toNumber(row.total)]));
}

export async function flowCoverageForSource(
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
