import { config } from "dotenv";
import { and, asc, eq, sql, type SQL } from "drizzle-orm";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { pathToFileURL } from "node:url";

import type { DbClient } from "../../src/db/client";
import { rawTradeRows, sourceFiles, tradeRecords } from "../../src/db/schema";
import {
  exportFieldNames,
  importFieldNames,
} from "../../src/ingest/aduana-source-layouts";
import {
  parseAduanaRow,
  rowHashSha256,
} from "../../src/ingest/aduana-main-file";
import {
  parsePositiveSafeIntegerCliValue,
  requiredCliValue,
} from "../../src/lib/cli-args";
import {
  resolveLocalWorkingStoragePath,
  workingFileR2Key,
} from "../../src/sources/source-row-reconstruction";
import {
  operationalSourceFieldCatalog,
  operationalSourceFieldGroups,
  type OperationalSourceFieldCatalogItem,
} from "../../src/trade/trade-record-operational-fields";
import {
  loadOperationalCodeLabelMaps,
  type OperationalCodeLabelMaps,
} from "../../src/trade/trade-record-operational-code-labels";
import {
  formatTradeRecordPeriodValue,
  listProductTradeRecordPeriods,
} from "../../src/trade/trade-record-periods";
import type { TradeFlow } from "../../src/trade/trade-records";
import {
  parsePeriodCliValue,
  parseTradeFlowCliValue,
  tradeRecordPeriodRangeWhere,
} from "./report-cli-helpers";

type ReconstructionStatus =
  | "postgres"
  | "local"
  | "r2"
  | "unavailable"
  | "hash_mismatch";

export type OperationalFieldsCoverageArgs = {
  json: boolean;
  periodFrom: string | null;
  periodTo: string | null;
  sampleSize: number;
  tradeFlow: TradeFlow | null;
};

export type OperationalFieldRecommendation =
  | "show_now"
  | "detail_only"
  | "needs_cleanup"
  | "do_not_use_yet";

export type OperationalFieldsCoverageSample = {
  id: string;
  rawValues: Record<string, string> | null;
  reconstructionStatus: ReconstructionStatus;
  tradeFlow: TradeFlow;
};

export type OperationalFieldCoverageRow = {
  coveragePercent: number;
  exampleLinks: string[];
  examples: string[];
  fieldKey: string;
  groupKey: string;
  groupTitle: string;
  label: string;
  recommendation: OperationalFieldRecommendation;
  rowsWithValue: number;
  sampledRows: number;
  sourceField: string;
  sourceFields: string[];
  tradeFlow: TradeFlow;
};

export type OperationalFieldsCoverageReport = {
  fields: OperationalFieldCoverageRow[];
  filters: {
    periodFrom: string;
    periodTo: string;
    sampleSize: number;
    tradeFlow: TradeFlow | null;
  };
  totals: {
    recordsSampled: number;
    rowsReviewed: number;
    reconstructionStatusCounts: Record<ReconstructionStatus, number>;
  };
};

type SampledRecord = {
  id: string;
  periodMonth: number;
  periodYear: number;
  rawText: string | null;
  rawTradeRowId: string;
  rawValues: unknown | null;
  rowHashSha256: string;
  rowNumber: number;
  sourceDomain: string;
  sourceFileId: string;
  sourceTradeFlow: string | null;
  sourcePeriodMonth: number | null;
  sourcePeriodYear: number | null;
  tradeFlow: TradeFlow;
  workingStorageKey: string | null;
};

type R2Env = {
  bucket: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
};

const defaultSampleSize = 500;
const maxSampleSize = 2_000;
const coveragePrecision = 1;

const reconstructionStatuses: ReconstructionStatus[] = [
  "postgres",
  "local",
  "r2",
  "unavailable",
  "hash_mismatch",
];

function parseSampleSize(value: string, flag: string) {
  return Math.min(parsePositiveSafeIntegerCliValue(value, flag), maxSampleSize);
}

export function parseOperationalFieldsCoverageArgs(
  argv: string[],
): OperationalFieldsCoverageArgs {
  const args: OperationalFieldsCoverageArgs = {
    json: false,
    periodFrom: null,
    periodTo: null,
    sampleSize: defaultSampleSize,
    tradeFlow: null,
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

    if (arg === "--sample-size") {
      args.sampleSize = parseSampleSize(requiredCliValue(argv, index, arg), arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--sample-size=")) {
      args.sampleSize = parseSampleSize(arg.slice("--sample-size=".length), "--sample-size");
      continue;
    }

    if (arg === "--trade-flow") {
      args.tradeFlow = parseTradeFlowCliValue(requiredCliValue(argv, index, arg));
      index += 1;
      continue;
    }

    if (arg.startsWith("--trade-flow=")) {
      args.tradeFlow = parseTradeFlowCliValue(arg.slice("--trade-flow=".length));
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function objectRecord(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const entries = Object.entries(value);
  if (entries.some(([, entryValue]) => typeof entryValue !== "string")) {
    return null;
  }

  return Object.fromEntries(entries) as Record<string, string>;
}

function fieldNamesForFlow(tradeFlow: TradeFlow) {
  return tradeFlow === "import" ? importFieldNames : exportFieldNames;
}

function parseVerifiedLine(record: SampledRecord, rawText: string) {
  if (rowHashSha256(rawText) !== record.rowHashSha256) {
    return null;
  }

  const parsed = parseAduanaRow(
    rawText,
    record.rowNumber,
    fieldNamesForFlow(record.tradeFlow),
  );

  return parsed.rawValues;
}

function objectBodyStream(body: unknown): NodeJS.ReadableStream {
  if (body instanceof Readable) {
    return body;
  }

  if (body && typeof body === "object" && Symbol.asyncIterator in body) {
    return body as NodeJS.ReadableStream;
  }

  if (
    body &&
    typeof body === "object" &&
    "transformToWebStream" in body &&
    typeof (body as { transformToWebStream?: unknown }).transformToWebStream === "function"
  ) {
    const webStream = (body as { transformToWebStream: () => unknown }).transformToWebStream();
    return Readable.fromWeb(webStream as never);
  }

  throw new Error("R2 object body is not a readable stream.");
}

async function readSelectedLinesFromDecodedStream(
  stream: NodeJS.ReadableStream,
  rowNumbers: Set<number>,
): Promise<Map<number, string>> {
  const lines = new Map<number, string>();
  const reader = createInterface({
    input: stream,
    crlfDelay: Infinity,
  });

  let currentRow = 0;
  const maxRow = Math.max(...rowNumbers);

  try {
    for await (const line of reader) {
      currentRow += 1;
      if (rowNumbers.has(currentRow)) {
        lines.set(currentRow, line);
      }
      if (currentRow >= maxRow || lines.size === rowNumbers.size) {
        reader.close();
        break;
      }
    }
  } finally {
    reader.close();
  }

  return lines;
}

async function readLocalSelectedLines(
  workingStorageKey: string | null,
  rowNumbers: Set<number>,
) {
  const localPath = resolveLocalWorkingStoragePath(workingStorageKey);
  const iconv = await import("iconv-lite");
  return readSelectedLinesFromDecodedStream(
    createReadStream(localPath).pipe(iconv.decodeStream("win1252")),
    rowNumbers,
  );
}

function r2Env(): R2Env | null {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const endpoint = process.env.R2_ENDPOINT;
  const env = {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    bucket: process.env.R2_BUCKET,
    endpoint,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  };

  if (!accountId || !env.accessKeyId || !env.bucket || !env.endpoint || !env.secretAccessKey) {
    return null;
  }

  const endpointHost = new URL(env.endpoint).host;
  const expectedHost = `${accountId}.r2.cloudflarestorage.com`;
  if (endpointHost !== expectedHost) {
    throw new Error(`R2 endpoint host does not match Cloudflare account ${accountId}.`);
  }

  return env as R2Env;
}

function r2Client(env: R2Env) {
  return new S3Client({
    credentials: {
      accessKeyId: env.accessKeyId,
      secretAccessKey: env.secretAccessKey,
    },
    endpoint: env.endpoint,
    region: "auto",
  });
}

async function readR2SelectedLines(
  key: string,
  rowNumbers: Set<number>,
): Promise<Map<number, string> | null> {
  const env = r2Env();
  if (!env) {
    return null;
  }

  const response = await r2Client(env).send(
    new GetObjectCommand({
      Bucket: env.bucket,
      Key: key,
    }),
  );
  const iconv = await import("iconv-lite");

  return readSelectedLinesFromDecodedStream(
    objectBodyStream(response.Body).pipe(iconv.decodeStream("win1252")),
    rowNumbers,
  );
}

function sourceGroupKey(record: SampledRecord) {
  return [
    record.sourceFileId,
    record.workingStorageKey ?? "",
    record.sourceDomain,
    record.sourceTradeFlow ?? "",
    record.sourcePeriodYear ?? "",
    record.sourcePeriodMonth ?? "",
  ].join("|");
}

function sourceMetadata(record: SampledRecord) {
  return {
    rowNumber: record.rowNumber,
    rowHashSha256: record.rowHashSha256,
    workingStorageKey: record.workingStorageKey,
    sourceDomain: record.sourceDomain,
    tradeFlow: record.sourceTradeFlow,
    periodYear: record.sourcePeriodYear,
    periodMonth: record.sourcePeriodMonth,
  };
}

function buildReconstructionResult(
  record: SampledRecord,
  status: ReconstructionStatus,
  rawText: string | null,
): OperationalFieldsCoverageSample {
  if (rawText && (status === "local" || status === "r2")) {
    const rawValues = parseVerifiedLine(record, rawText);
    return {
      id: record.id,
      rawValues,
      reconstructionStatus: rawValues ? status : "hash_mismatch",
      tradeFlow: record.tradeFlow,
    };
  }

  return {
    id: record.id,
    rawValues: null,
    reconstructionStatus: status,
    tradeFlow: record.tradeFlow,
  };
}

async function reconstructSampledRecords(
  records: SampledRecord[],
): Promise<OperationalFieldsCoverageSample[]> {
  const results = new Map<string, OperationalFieldsCoverageSample>();
  const prunedRecords: SampledRecord[] = [];

  for (const record of records) {
    const rawValues = objectRecord(record.rawValues);
    if (rawValues) {
      results.set(record.id, {
        id: record.id,
        rawValues,
        reconstructionStatus: "postgres",
        tradeFlow: record.tradeFlow,
      });
      continue;
    }

    prunedRecords.push(record);
  }

  const groups = new Map<string, SampledRecord[]>();
  for (const record of prunedRecords) {
    const existing = groups.get(sourceGroupKey(record)) ?? [];
    existing.push(record);
    groups.set(sourceGroupKey(record), existing);
  }

  for (const groupRecords of groups.values()) {
    const firstRecord = groupRecords[0];
    if (!firstRecord) continue;

    const rowNumbers = new Set(groupRecords.map((record) => record.rowNumber));
    let lines: Map<number, string> | null = null;
    let sourceStatus: ReconstructionStatus = "unavailable";

    try {
      lines = await readLocalSelectedLines(firstRecord.workingStorageKey, rowNumbers);
      sourceStatus = "local";
    } catch {
      const r2Key = workingFileR2Key(sourceMetadata(firstRecord));
      if (r2Key) {
        try {
          lines = await readR2SelectedLines(r2Key, rowNumbers);
          sourceStatus = lines ? "r2" : "unavailable";
        } catch {
          lines = null;
          sourceStatus = "unavailable";
        }
      }
    }

    for (const record of groupRecords) {
      const rawText = lines?.get(record.rowNumber) ?? null;
      results.set(
        record.id,
        buildReconstructionResult(
          record,
          rawText ? sourceStatus : "unavailable",
          rawText,
        ),
      );
    }
  }

  return records.map((record) => results.get(record.id) ?? {
    id: record.id,
    rawValues: null,
    reconstructionStatus: "unavailable",
    tradeFlow: record.tradeFlow,
  });
}

export function operationalFieldRecommendation(args: {
  coveragePercent: number;
  field: Pick<OperationalSourceFieldCatalogItem, "key" | "sourceField">;
  examples: string[];
}): OperationalFieldRecommendation {
  if (args.coveragePercent < 20) {
    return "do_not_use_yet";
  }

  if (fieldNeedsReadableLabel(args.field) && args.examples.some(isCodeHeavyValue)) {
    return "needs_cleanup";
  }

  return args.coveragePercent >= 70 ? "show_now" : "detail_only";
}

function fieldNeedsReadableLabel(
  field: Pick<OperationalSourceFieldCatalogItem, "key" | "sourceField">,
) {
  return [
    "paymentForm",
    "saleClause",
    "transportCompanyCountry",
    "packageDetail",
  ].includes(field.key) || /FORM.?PAGO|CLAUSULA|CL_COMPRA|CODPAISCIA|PAISCIATRANSP/i.test(field.sourceField);
}

function isCodeHeavyValue(value: string) {
  const clean = value.trim();
  return (
    /^Código Aduana\b/.test(clean) ||
    /^\d+$/.test(clean) ||
    /^[A-Z0-9 .:-]{1,8}$/.test(clean)
  );
}

function incrementStatus(
  counts: Record<ReconstructionStatus, number>,
  status: ReconstructionStatus,
) {
  counts[status] += 1;
}

function roundCoverage(value: number) {
  return Number(value.toFixed(coveragePrecision));
}

export function buildOperationalFieldsCoverageReport(args: {
  labelMaps?: OperationalCodeLabelMaps;
  periodFrom: string;
  periodTo: string;
  sampleSize: number;
  samples: OperationalFieldsCoverageSample[];
  tradeFlow: TradeFlow | null;
}): OperationalFieldsCoverageReport {
  const statusCounts = Object.fromEntries(
    reconstructionStatuses.map((status) => [status, 0]),
  ) as Record<ReconstructionStatus, number>;

  for (const sample of args.samples) {
    incrementStatus(statusCounts, sample.reconstructionStatus);
  }

  const reviewedSamples = args.samples.filter((sample) => sample.rawValues);
  const samplesByFlow = new Map<TradeFlow, OperationalFieldsCoverageSample[]>();
  for (const sample of reviewedSamples) {
    const existing = samplesByFlow.get(sample.tradeFlow) ?? [];
    existing.push(sample);
    samplesByFlow.set(sample.tradeFlow, existing);
  }

  const fields = operationalSourceFieldCatalog(args.tradeFlow)
    .map((field): OperationalFieldCoverageRow => {
      const flowSamples = samplesByFlow.get(field.tradeFlow) ?? [];
      const examples: string[] = [];
      const exampleLinks: string[] = [];
      let rowsWithValue = 0;

      for (const sample of flowSamples) {
        const groups = operationalSourceFieldGroups(
          sample.tradeFlow,
          sample.rawValues,
          args.labelMaps,
        );
        const displayField = groups
          .flatMap((group) => group.fields)
          .find((candidate) => candidate.key === field.key);

        if (!displayField?.value) {
          continue;
        }

        rowsWithValue += 1;
        if (examples.length < 5 && !examples.includes(displayField.value)) {
          examples.push(displayField.value);
        }
        const link = `/trade-records/${sample.id}`;
        if (exampleLinks.length < 3 && !exampleLinks.includes(link)) {
          exampleLinks.push(link);
        }
      }

      const coveragePercent = flowSamples.length > 0
        ? roundCoverage((rowsWithValue / flowSamples.length) * 100)
        : 0;

      return {
        coveragePercent,
        exampleLinks,
        examples,
        fieldKey: field.key,
        groupKey: field.groupKey,
        groupTitle: field.groupTitle,
        label: field.label,
        recommendation: operationalFieldRecommendation({
          coveragePercent,
          examples,
          field,
        }),
        rowsWithValue,
        sampledRows: flowSamples.length,
        sourceField: field.sourceField,
        sourceFields: field.sourceFields,
        tradeFlow: field.tradeFlow,
      };
    })
    .sort((a, b) =>
      a.tradeFlow.localeCompare(b.tradeFlow) ||
      a.groupKey.localeCompare(b.groupKey) ||
      b.coveragePercent - a.coveragePercent ||
      a.label.localeCompare(b.label),
    );

  return {
    fields,
    filters: {
      periodFrom: args.periodFrom,
      periodTo: args.periodTo,
      sampleSize: args.sampleSize,
      tradeFlow: args.tradeFlow,
    },
    totals: {
      recordsSampled: args.samples.length,
      rowsReviewed: reviewedSamples.length,
      reconstructionStatusCounts: statusCounts,
    },
  };
}

async function defaultPeriod(db: DbClient) {
  const periods = await listProductTradeRecordPeriods(db);
  const latest = periods[0];

  if (latest) {
    return latest.value;
  }

  return formatTradeRecordPeriodValue(2026, 4);
}

async function resolveReportPeriod(db: DbClient, args: OperationalFieldsCoverageArgs) {
  const fallback = await defaultPeriod(db);
  const periodFrom = args.periodFrom ?? args.periodTo ?? fallback;
  const periodTo = args.periodTo ?? args.periodFrom ?? periodFrom;

  if (periodFrom > periodTo) {
    throw new Error("--period-from must be before or equal to --period-to.");
  }

  return { periodFrom, periodTo };
}

async function sampledPeriodFlows(
  db: DbClient,
  args: {
    periodFrom: string;
    periodTo: string;
    tradeFlow: TradeFlow | null;
  },
) {
  const conditions: SQL[] = [
    tradeRecordPeriodRangeWhere(args.periodFrom, args.periodTo),
  ];
  if (args.tradeFlow) {
    conditions.push(eq(tradeRecords.tradeFlow, args.tradeFlow));
  }

  const rows = await db
    .select({
      periodMonth: tradeRecords.periodMonth,
      periodYear: tradeRecords.periodYear,
      tradeFlow: tradeRecords.tradeFlow,
    })
    .from(tradeRecords)
    .where(and(...conditions))
    .groupBy(
      tradeRecords.periodYear,
      tradeRecords.periodMonth,
      tradeRecords.tradeFlow,
    )
    .orderBy(
      asc(tradeRecords.periodYear),
      asc(tradeRecords.periodMonth),
      asc(tradeRecords.tradeFlow),
    );

  return rows.map((row) => ({
    periodMonth: row.periodMonth,
    periodYear: row.periodYear,
    tradeFlow: parseTradeFlowCliValue(row.tradeFlow),
  }));
}

async function sampleRecordsForPeriodFlow(
  db: DbClient,
  args: {
    periodMonth: number;
    periodYear: number;
    sampleSize: number;
    tradeFlow: TradeFlow;
  },
): Promise<SampledRecord[]> {
  const rows = await db
    .select({
      id: tradeRecords.id,
      periodMonth: tradeRecords.periodMonth,
      periodYear: tradeRecords.periodYear,
      rawText: rawTradeRows.rawText,
      rawTradeRowId: rawTradeRows.id,
      rawValues: rawTradeRows.rawValues,
      rowHashSha256: rawTradeRows.rowHashSha256,
      rowNumber: rawTradeRows.rowNumber,
      sourceDomain: sourceFiles.sourceDomain,
      sourceFileId: sourceFiles.id,
      sourcePeriodMonth: sourceFiles.periodMonth,
      sourcePeriodYear: sourceFiles.periodYear,
      sourceTradeFlow: sourceFiles.tradeFlow,
      tradeFlow: tradeRecords.tradeFlow,
      workingStorageKey: sourceFiles.workingStorageKey,
    })
    .from(tradeRecords)
    .innerJoin(rawTradeRows, eq(tradeRecords.rawTradeRowId, rawTradeRows.id))
    .innerJoin(sourceFiles, eq(tradeRecords.sourceFileId, sourceFiles.id))
    .where(
      and(
        eq(tradeRecords.periodYear, args.periodYear),
        eq(tradeRecords.periodMonth, args.periodMonth),
        eq(tradeRecords.tradeFlow, args.tradeFlow),
      ),
    )
    .orderBy(asc(rawTradeRows.rowNumber), asc(rawTradeRows.id))
    .limit(args.sampleSize);

  return rows.map((row) => ({
    ...row,
    tradeFlow: parseTradeFlowCliValue(row.tradeFlow),
  }));
}

async function listSampledRecords(
  db: DbClient,
  args: {
    periodFrom: string;
    periodTo: string;
    sampleSize: number;
    tradeFlow: TradeFlow | null;
  },
) {
  const periodFlows = await sampledPeriodFlows(db, args);
  const records: SampledRecord[] = [];

  for (const periodFlow of periodFlows) {
    records.push(
      ...(await sampleRecordsForPeriodFlow(db, {
        ...periodFlow,
        sampleSize: args.sampleSize,
      })),
    );
  }

  return records;
}

function renderTextReport(report: OperationalFieldsCoverageReport) {
  const lines = [
    "Duanera operational fields coverage report",
    `Period: ${report.filters.periodFrom} to ${report.filters.periodTo}`,
    `Flow: ${report.filters.tradeFlow ?? "all"}`,
    `Sample size: ${report.filters.sampleSize} per period/flow`,
    `Rows sampled: ${report.totals.recordsSampled}`,
    `Rows reviewed: ${report.totals.rowsReviewed}`,
    `Reconstruction: ${reconstructionStatuses.map((status) => `${status}=${report.totals.reconstructionStatusCounts[status]}`).join(", ")}`,
    "",
  ];

  for (const field of report.fields) {
    lines.push(
      `${field.tradeFlow} · ${field.groupTitle} · ${field.label}`,
      `  source: ${field.sourceField}`,
      `  coverage: ${field.rowsWithValue}/${field.sampledRows} (${field.coveragePercent}%)`,
      `  recommendation: ${field.recommendation}`,
      `  examples: ${field.examples.join(" | ") || "none"}`,
      `  links: ${field.exampleLinks.join(" | ") || "none"}`,
      "",
    );
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

export async function runOperationalFieldsCoverageReport(
  db: DbClient,
  argv: string[],
) {
  const args = parseOperationalFieldsCoverageArgs(argv);
  const period = await resolveReportPeriod(db, args);
  const records = await listSampledRecords(db, {
    ...period,
    sampleSize: args.sampleSize,
    tradeFlow: args.tradeFlow,
  });
  const samples = await reconstructSampledRecords(records);
  const labelMaps = await loadOperationalCodeLabelMaps(db);
  const report = buildOperationalFieldsCoverageReport({
    labelMaps,
    ...period,
    sampleSize: args.sampleSize,
    samples,
    tradeFlow: args.tradeFlow,
  });

  process.stdout.write(args.json ? `${JSON.stringify(report, null, 2)}\n` : renderTextReport(report));
  return report;
}

async function main() {
  config({ path: ".env.local" });
  config();

  const { db } = await import("../../src/db/client");
  await runOperationalFieldsCoverageReport(db, process.argv.slice(2));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Operational fields coverage report failed: ${message}\n`);
    process.exitCode = 1;
  });
}
