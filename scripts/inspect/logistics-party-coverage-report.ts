import { config } from "dotenv";
import { and, count, eq, sql } from "drizzle-orm";
import { pathToFileURL } from "node:url";

import type { DbClient } from "../../src/db/client";
import {
  tradeRecordLogisticsPartyLinks,
  tradeRecords,
} from "../../src/db/schema";
import { requiredCliValue } from "../../src/lib/cli-args";
import { buildTradeRecordWhere } from "../../src/trade/trade-record-where";
import type { TradeFlow } from "../../src/trade/trade-records";
import { parsePeriodCliValue } from "./report-cli-helpers";

type CoverageStatus = "complete" | "partial" | "missing";

export type LogisticsCoverageArgs = {
  json: boolean;
  periodFrom: string | null;
  periodTo: string | null;
};

export type LogisticsCoverageRecordRow = {
  flow: string;
  year: number;
  month: number;
  total: number;
};

export type LogisticsCoverageLinkRow = {
  flow: string;
  year: number;
  month: number;
  links: number;
  linkedRecords: number;
};

export type LogisticsCoverageRow = {
  coveragePercent: number;
  flow: TradeFlow;
  linkedRecords: number;
  links: number;
  missingRecords: number;
  period: string;
  records: number;
  status: CoverageStatus;
};

export type LogisticsCoverageReport = {
  rows: LogisticsCoverageRow[];
  totals: {
    complete: number;
    missing: number;
    partial: number;
    records: number;
    linkedRecords: number;
    links: number;
  };
};

export function parseLogisticsCoverageArgs(argv: string[]): LogisticsCoverageArgs {
  const args: LogisticsCoverageArgs = {
    json: false,
    periodFrom: null,
    periodTo: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--json") {
      args.json = true;
      continue;
    }

    if (arg === "--period-from") {
      args.periodFrom = parsePeriodCliValue(requiredCliValue(argv, index, arg), arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--period-from=")) {
      args.periodFrom = parsePeriodCliValue(arg.slice("--period-from=".length), "--period-from");
      continue;
    }

    if (arg === "--period-to") {
      args.periodTo = parsePeriodCliValue(requiredCliValue(argv, index, arg), arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--period-to=")) {
      args.periodTo = parsePeriodCliValue(arg.slice("--period-to=".length), "--period-to");
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function periodText(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function periodIndex(period: string) {
  const [year, month] = period.split("-").map((part) => Number.parseInt(part, 10));
  return year * 12 + month;
}

function isTradeFlow(value: string): value is TradeFlow {
  return value === "import" || value === "export";
}

function statusForCoverage(records: number, linkedRecords: number): CoverageStatus {
  if (linkedRecords <= 0) {
    return "missing";
  }

  if (linkedRecords >= records) {
    return "complete";
  }

  return "partial";
}

export function buildLogisticsCoverageReport({
  linkRows,
  periodFrom,
  periodTo,
  recordRows,
}: {
  linkRows: LogisticsCoverageLinkRow[];
  periodFrom?: string | null;
  periodTo?: string | null;
  recordRows: LogisticsCoverageRecordRow[];
}): LogisticsCoverageReport {
  const linksByPeriodFlow = new Map<string, LogisticsCoverageLinkRow>();
  for (const row of linkRows) {
    linksByPeriodFlow.set(`${periodText(row.year, row.month)}:${row.flow}`, row);
  }

  const rows = recordRows
    .flatMap((row) => {
      if (!isTradeFlow(row.flow)) {
        return [];
      }

      const period = periodText(row.year, row.month);
      const flow: TradeFlow = row.flow;
      return [{ ...row, flow, period }];
    })
    .filter((row) => {
      const index = periodIndex(row.period);
      return (
        (!periodFrom || index >= periodIndex(periodFrom)) &&
        (!periodTo || index <= periodIndex(periodTo))
      );
    })
    .map((row): LogisticsCoverageRow => {
      const links = linksByPeriodFlow.get(`${row.period}:${row.flow}`);
      const linkedRecords = links?.linkedRecords ?? 0;
      const linkCount = links?.links ?? 0;
      const coveragePercent =
        row.total > 0 ? Number(((linkedRecords / row.total) * 100).toFixed(1)) : 0;

      return {
        coveragePercent,
        flow: row.flow,
        linkedRecords,
        links: linkCount,
        missingRecords: Math.max(row.total - linkedRecords, 0),
        period: row.period,
        records: row.total,
        status: statusForCoverage(row.total, linkedRecords),
      };
    })
    .sort((a, b) => {
      const periodSort = periodIndex(b.period) - periodIndex(a.period);
      return periodSort || a.flow.localeCompare(b.flow);
    });

  return {
    rows,
    totals: {
      complete: rows.filter((row) => row.status === "complete").length,
      missing: rows.filter((row) => row.status === "missing").length,
      partial: rows.filter((row) => row.status === "partial").length,
      records: rows.reduce((sum, row) => sum + row.records, 0),
      linkedRecords: rows.reduce((sum, row) => sum + row.linkedRecords, 0),
      links: rows.reduce((sum, row) => sum + row.links, 0),
    },
  };
}

async function loadCoverageRecordRows(db: DbClient): Promise<LogisticsCoverageRecordRow[]> {
  const where = buildTradeRecordWhere({}, { productFacing: true });
  return db
    .select({
      flow: tradeRecords.tradeFlow,
      year: tradeRecords.periodYear,
      month: tradeRecords.periodMonth,
      total: count(),
    })
    .from(tradeRecords)
    .where(where)
    .groupBy(tradeRecords.tradeFlow, tradeRecords.periodYear, tradeRecords.periodMonth);
}

async function loadCoverageLinkRows(db: DbClient): Promise<LogisticsCoverageLinkRow[]> {
  const where = buildTradeRecordWhere({}, { productFacing: true });
  return db
    .select({
      flow: tradeRecordLogisticsPartyLinks.tradeFlow,
      year: tradeRecordLogisticsPartyLinks.periodYear,
      month: tradeRecordLogisticsPartyLinks.periodMonth,
      links: count(),
      linkedRecords: sql<number>`count(distinct ${tradeRecordLogisticsPartyLinks.tradeRecordId})::int`,
    })
    .from(tradeRecordLogisticsPartyLinks)
    .innerJoin(
      tradeRecords,
      eq(tradeRecordLogisticsPartyLinks.tradeRecordId, tradeRecords.id),
    )
    .where(and(where, eq(tradeRecordLogisticsPartyLinks.tradeFlow, tradeRecords.tradeFlow)))
    .groupBy(
      tradeRecordLogisticsPartyLinks.tradeFlow,
      tradeRecordLogisticsPartyLinks.periodYear,
      tradeRecordLogisticsPartyLinks.periodMonth,
    );
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("es-CL").format(value);
}

function formatReport(report: LogisticsCoverageReport) {
  const lines = [
    "Logistics party coverage",
    `Rows: ${report.rows.length} · complete ${report.totals.complete} · partial ${report.totals.partial} · missing ${report.totals.missing}`,
    "",
    "Period   Flow    Records     Linked      Links       Coverage  Status",
    "-------  ------  ----------  ----------  ----------  --------  -------",
  ];

  for (const row of report.rows) {
    lines.push(
      [
        row.period.padEnd(7),
        row.flow.padEnd(6),
        formatInteger(row.records).padStart(10),
        formatInteger(row.linkedRecords).padStart(10),
        formatInteger(row.links).padStart(10),
        `${row.coveragePercent.toFixed(1)}%`.padStart(8),
        row.status,
      ].join("  "),
    );
  }

  return lines.join("\n");
}

export async function runLogisticsCoverageReport(
  db: DbClient,
  args: LogisticsCoverageArgs,
): Promise<LogisticsCoverageReport> {
  const [recordRows, linkRows] = await Promise.all([
    loadCoverageRecordRows(db),
    loadCoverageLinkRows(db),
  ]);

  return buildLogisticsCoverageReport({
    linkRows,
    periodFrom: args.periodFrom,
    periodTo: args.periodTo,
    recordRows,
  });
}

async function main() {
  config({ path: ".env.local" });
  config();
  const args = parseLogisticsCoverageArgs(process.argv.slice(2));
  const { db } = await import("../../src/db/client");
  const report = await runLogisticsCoverageReport(db, args);

  if (args.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(`${formatReport(report)}\n`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Logistics party coverage report failed: ${message}\n`);
    process.exitCode = 1;
  });
}
