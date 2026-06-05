import { count, eq, sql } from "drizzle-orm";

import type { DbClient } from "@/db/client";
import { rawTradeRows, sourceFiles, tradeRecords } from "@/db/schema";
import { formatTradeRecordPeriodValue } from "@/trade/trade-record-periods";
import { productFacingTradeRecordWhere } from "@/trade/trade-record-where";

export type SourceCoverageMonth = {
  year: number;
  month: number;
  period: string;
  importRecords: number;
  exportRecords: number;
  importSources: number;
  exportSources: number;
  parseIssues: number;
  status: "complete" | "partial" | "missing";
};

export type SourceCoverageSummary = {
  startPeriod: string;
  endPeriod: string;
  loadedMonths: number;
  completeMonths: number;
  partialMonths: number;
  missingMonths: number;
  months: SourceCoverageMonth[];
};

const coverageStart = { year: 2021, month: 1 };

function monthIndex(year: number, month: number) {
  return year * 12 + month - 1;
}

function monthsBetween(
  start: { year: number; month: number },
  end: { year: number; month: number },
) {
  const months: Array<{ year: number; month: number }> = [];
  const startIndex = monthIndex(start.year, start.month);
  const endIndex = monthIndex(end.year, end.month);

  for (let index = startIndex; index <= endIndex; index += 1) {
    const year = Math.floor(index / 12);
    const month = (index % 12) + 1;
    months.push({ year, month });
  }

  return months;
}

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

export async function loadSourceCoverage(
  db: DbClient,
): Promise<SourceCoverageSummary> {
  const [tradeRows, rawIssueRows] = await Promise.all([
    db
      .select({
        year: tradeRecords.periodYear,
        month: tradeRecords.periodMonth,
        tradeFlow: tradeRecords.tradeFlow,
        records: count(),
        sources: sql<number>`count(distinct ${tradeRecords.sourceFileId})::int`,
      })
      .from(tradeRecords)
      .where(productFacingTradeRecordWhere())
      .groupBy(
        tradeRecords.periodYear,
        tradeRecords.periodMonth,
        tradeRecords.tradeFlow,
      ),
    db
      .select({
        year: rawTradeRows.periodYear,
        month: rawTradeRows.periodMonth,
        issues: count(),
      })
      .from(rawTradeRows)
      .innerJoin(sourceFiles, eq(rawTradeRows.sourceFileId, sourceFiles.id))
      .where(sql`${rawTradeRows.parseStatus} <> 'parsed' and ${sourceFiles.sourceSystem} <> 'duanera_test'`)
      .groupBy(rawTradeRows.periodYear, rawTradeRows.periodMonth),
  ]);

  const loadedPeriods = tradeRows
    .filter((row) => row.year !== null && row.month !== null)
    .map((row) => ({ year: row.year, month: row.month }));
  const latest = loadedPeriods.sort(
    (a, b) => b.year - a.year || b.month - a.month,
  )[0] ?? coverageStart;
  const byPeriod = new Map<string, SourceCoverageMonth>();
  const issuesByPeriod = new Map<string, number>();

  for (const row of rawIssueRows) {
    if (row.year === null || row.month === null) {
      continue;
    }

    issuesByPeriod.set(
      formatTradeRecordPeriodValue(row.year, row.month),
      toNumber(row.issues),
    );
  }

  for (const period of monthsBetween(coverageStart, latest)) {
    const key = formatTradeRecordPeriodValue(period.year, period.month);
    byPeriod.set(key, {
      ...period,
      period: key,
      importRecords: 0,
      exportRecords: 0,
      importSources: 0,
      exportSources: 0,
      parseIssues: issuesByPeriod.get(key) ?? 0,
      status: "missing",
    });
  }

  for (const row of tradeRows) {
    const key = formatTradeRecordPeriodValue(row.year, row.month);
    const current =
      byPeriod.get(key) ??
      ({
        year: row.year,
        month: row.month,
        period: key,
        importRecords: 0,
        exportRecords: 0,
        importSources: 0,
        exportSources: 0,
        parseIssues: issuesByPeriod.get(key) ?? 0,
        status: "missing",
      } satisfies SourceCoverageMonth);

    if (row.tradeFlow === "import") {
      current.importRecords = toNumber(row.records);
      current.importSources = toNumber(row.sources);
    }

    if (row.tradeFlow === "export") {
      current.exportRecords = toNumber(row.records);
      current.exportSources = toNumber(row.sources);
    }

    current.status =
      current.importRecords > 0 && current.exportRecords > 0
        ? "complete"
        : current.importRecords > 0 || current.exportRecords > 0
          ? "partial"
          : "missing";
    byPeriod.set(key, current);
  }

  const months = [...byPeriod.values()].sort(
    (a, b) => b.year - a.year || b.month - a.month,
  );

  return {
    startPeriod: formatTradeRecordPeriodValue(coverageStart.year, coverageStart.month),
    endPeriod: formatTradeRecordPeriodValue(latest.year, latest.month),
    loadedMonths: months.filter((month) => month.status !== "missing").length,
    completeMonths: months.filter((month) => month.status === "complete").length,
    partialMonths: months.filter((month) => month.status === "partial").length,
    missingMonths: months.filter((month) => month.status === "missing").length,
    months,
  };
}
