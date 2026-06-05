import { config } from "dotenv";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import {
  and,
  asc,
  eq,
  isNotNull,
  sql,
} from "drizzle-orm";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { pathToFileURL } from "node:url";

import type { DbClient } from "../../src/db/client";
import { assertDevDatabaseTarget } from "../../src/db/dev-guard";
import {
  rawTradeRows,
  sourceFiles,
  tradeRecords,
} from "../../src/db/schema";
import {
  exportFieldNames,
  importFieldNames,
} from "../../src/ingest/aduana-source-layouts";
import {
  parseAduanaRow,
  rowHashSha256,
} from "../../src/ingest/aduana-main-file";
import { positiveIntegerEnvValue } from "../../src/lib/env";
import {
  resolveLocalWorkingStoragePath,
  workingFileR2Key,
} from "../../src/sources/source-row-reconstruction";
import {
  deleteLogisticsPartyLinksForRawRows,
  TradeLogisticsPartyTracker,
  type LogisticsPartyRawRow,
  upsertLogisticsPartyLinksForRawRows,
} from "./normalize-trade-record-logistics-parties";
import { rawValuesRecord } from "./normalize-trade-record-values";

const defaultChunkSize = 500;

type BackfillPeriod = {
  year: number;
  month: number;
  period: string;
};

type BackfillRecord = {
  id: string;
  rawTradeRowId: string;
  sourceFileId: string;
  importBatchId: string;
  tradeFlow: string;
  periodYear: number;
  periodMonth: number;
  rawText: string | null;
  rawValues: unknown;
  rowNumber: number;
  rowHashSha256: string;
  workingStorageKey: string | null;
  sourceDomain: string;
  sourceTradeFlow: string | null;
  sourcePeriodYear: number | null;
  sourcePeriodMonth: number | null;
};

type R2Env = {
  accessKeyId: string;
  bucket: string;
  endpoint: string;
  secretAccessKey: string;
};

function chunkSize(): number {
  return positiveIntegerEnvValue(
    "LOGISTICS_PARTY_BACKFILL_CHUNK_SIZE",
    process.env.LOGISTICS_PARTY_BACKFILL_CHUNK_SIZE,
    defaultChunkSize,
  );
}

function backfillLimit(): number | null {
  const raw = process.env.LOGISTICS_PARTY_BACKFILL_LIMIT?.trim();
  if (!raw) {
    return null;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!/^\d+$/.test(raw) || parsed < 1) {
    throw new Error("LOGISTICS_PARTY_BACKFILL_LIMIT must be a positive integer.");
  }

  return parsed;
}

function parseBackfillPeriod(value = process.env.LOGISTICS_PARTY_BACKFILL_PERIOD): BackfillPeriod | null {
  if (!value?.trim()) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})$/.exec(value.trim());
  if (!match) {
    throw new Error(`LOGISTICS_PARTY_BACKFILL_PERIOD must use YYYY-MM format, got ${value}.`);
  }

  const year = Number.parseInt(match[1] ?? "", 10);
  const month = Number.parseInt(match[2] ?? "", 10);
  if (month < 1 || month > 12) {
    throw new Error(
      `LOGISTICS_PARTY_BACKFILL_PERIOD month must be between 01 and 12, got ${value}.`,
    );
  }

  return { year, month, period: value.trim() };
}

function parseBackfillFlow(value = process.env.LOGISTICS_PARTY_BACKFILL_FLOW) {
  if (!value?.trim()) {
    return null;
  }

  const normalized = value.trim();
  if (normalized !== "import" && normalized !== "export") {
    throw new Error("LOGISTICS_PARTY_BACKFILL_FLOW must be import or export.");
  }

  return normalized;
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

function fieldNamesForFlow(tradeFlow: "import" | "export") {
  return tradeFlow === "import" ? importFieldNames : exportFieldNames;
}

function parseVerifiedLine(row: BackfillRecord, rawText: string) {
  if (row.tradeFlow !== "import" && row.tradeFlow !== "export") {
    return null;
  }

  if (rowHashSha256(rawText) !== row.rowHashSha256) {
    return null;
  }

  return parseAduanaRow(rawText, row.rowNumber, fieldNamesForFlow(row.tradeFlow)).rawValues;
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

class LocalSourceLineReader {
  private currentRow = 0;
  private readonly iterator: AsyncIterableIterator<string>;

  private constructor(
    private readonly reader: ReturnType<typeof createInterface>,
  ) {
    this.iterator = reader[Symbol.asyncIterator]();
  }

  static async create(workingStorageKey: string | null) {
    const iconv = await import("iconv-lite");
    const reader = createInterface({
      input: createReadStream(resolveLocalWorkingStoragePath(workingStorageKey)).pipe(
        iconv.decodeStream("win1252"),
      ),
      crlfDelay: Infinity,
    });

    return new LocalSourceLineReader(reader);
  }

  async readRows(rowNumbers: Set<number>): Promise<Map<number, string>> {
    const lines = new Map<number, string>();
    const targets = [...rowNumbers]
      .filter((rowNumber) => rowNumber > this.currentRow)
      .sort((a, b) => a - b);

    if (targets.length === 0) {
      return lines;
    }

    const targetSet = new Set(targets);
    const maxRow = targets.at(-1);
    if (!maxRow) {
      return lines;
    }

    while (this.currentRow < maxRow) {
      const next = await this.iterator.next();
      if (next.done) {
        break;
      }

      this.currentRow += 1;
      if (targetSet.has(this.currentRow)) {
        lines.set(this.currentRow, next.value);
      }
      if (lines.size === targetSet.size) {
        break;
      }
    }

    return lines;
  }

  close() {
    this.reader.close();
  }
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

function sourceGroupKey(record: BackfillRecord) {
  return [
    record.sourceFileId,
    record.workingStorageKey ?? "",
    record.sourceDomain,
    record.sourceTradeFlow ?? "",
    record.sourcePeriodYear ?? "",
    record.sourcePeriodMonth ?? "",
  ].join("|");
}

function sourceMetadata(record: BackfillRecord) {
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

function logisticsRawRowFromValues(
  row: BackfillRecord,
  rawValues: Record<string, string> | null,
): LogisticsPartyRawRow | null {
  if (row.tradeFlow !== "import" && row.tradeFlow !== "export") {
    return null;
  }

  if (!rawValues) {
    return null;
  }

  return {
    rawTradeRowId: row.rawTradeRowId,
    sourceFileId: row.sourceFileId,
    importBatchId: row.importBatchId,
    tradeFlow: row.tradeFlow,
    periodYear: row.periodYear,
    periodMonth: row.periodMonth,
    rawValues: rawValuesRecord(rawValues, row.rawTradeRowId),
  };
}

async function reconstructRawRows(
  records: BackfillRecord[],
  localLineReaders: Map<string, LocalSourceLineReader>,
) {
  const results = new Map<string, LogisticsPartyRawRow>();
  const prunedRecords: BackfillRecord[] = [];
  let skipped = 0;

  for (const record of records) {
    const rawValues = objectRecord(record.rawValues);
    const rawRow = logisticsRawRowFromValues(record, rawValues);
    if (rawRow) {
      results.set(record.rawTradeRowId, rawRow);
      continue;
    }

    prunedRecords.push(record);
  }

  const groups = new Map<string, BackfillRecord[]>();
  for (const record of prunedRecords) {
    const group = groups.get(sourceGroupKey(record)) ?? [];
    group.push(record);
    groups.set(sourceGroupKey(record), group);
  }

  for (const groupRecords of groups.values()) {
    const firstRecord = groupRecords[0];
    if (!firstRecord) continue;

    const rowNumbers = new Set(groupRecords.map((record) => record.rowNumber));
    let lines: Map<number, string> | null = null;

    try {
      let localReader = localLineReaders.get(sourceGroupKey(firstRecord));
      if (!localReader) {
        localReader = await LocalSourceLineReader.create(firstRecord.workingStorageKey);
        localLineReaders.set(sourceGroupKey(firstRecord), localReader);
      }
      lines = await localReader.readRows(rowNumbers);
    } catch {
      const r2Key = workingFileR2Key(sourceMetadata(firstRecord));
      if (r2Key) {
        try {
          lines = await readR2SelectedLines(r2Key, rowNumbers);
        } catch {
          lines = null;
        }
      }
    }

    for (const record of groupRecords) {
      const rawText = lines?.get(record.rowNumber);
      const rawValues = rawText ? parseVerifiedLine(record, rawText) : null;
      const rawRow = logisticsRawRowFromValues(record, rawValues);
      if (rawRow) {
        results.set(record.rawTradeRowId, rawRow);
      } else {
        skipped += 1;
      }
    }
  }

  return {
    rawRows: records
      .map((record) => results.get(record.rawTradeRowId))
      .filter((row): row is LogisticsPartyRawRow => row !== undefined),
    skipped,
  };
}

export async function runLogisticsPartyBackfill(db: DbClient) {
  const period = parseBackfillPeriod();
  const tradeFlow = parseBackfillFlow();
  const size = chunkSize();
  const limit = backfillLimit();
  const tracker = new TradeLogisticsPartyTracker(db);
  const localLineReaders = new Map<string, LocalSourceLineReader>();
  let lastCursor: {
    rowNumber: number;
    rawTradeRowId: string;
  } | null = null;
  let scanned = 0;
  let linked = 0;
  let skipped = 0;

  await tracker.loadExisting();

  if (period) {
    process.stdout.write(`Backfilling logistics parties for period ${period.period}.\n`);
  }
  if (tradeFlow) {
    process.stdout.write(`Restricting logistics party backfill to ${tradeFlow} records.\n`);
  }
  if (limit) {
    process.stdout.write(`Stopping logistics party backfill after ${limit} scanned records.\n`);
  }

  try {
    while (true) {
      const currentLimit = limit ? Math.min(size, Math.max(limit - scanned, 0)) : size;
      if (currentLimit <= 0) {
        break;
      }

      const conditions = [isNotNull(tradeRecords.rawTradeRowId)];
      if (lastCursor) {
        conditions.push(sql`(
          ${rawTradeRows.rowNumber},
          ${rawTradeRows.id}
        ) > (
          ${lastCursor.rowNumber},
          ${lastCursor.rawTradeRowId}::uuid
        )`);
      }
      if (period) {
        conditions.push(eq(tradeRecords.periodYear, period.year));
        conditions.push(eq(tradeRecords.periodMonth, period.month));
        conditions.push(eq(rawTradeRows.periodYear, period.year));
        conditions.push(eq(rawTradeRows.periodMonth, period.month));
      }
      if (tradeFlow) {
        conditions.push(eq(tradeRecords.tradeFlow, tradeFlow));
        conditions.push(eq(rawTradeRows.tradeFlow, tradeFlow));
      }

      const rows = await db
        .select({
          id: tradeRecords.id,
          rawTradeRowId: tradeRecords.rawTradeRowId,
          sourceFileId: tradeRecords.sourceFileId,
          importBatchId: tradeRecords.importBatchId,
          tradeFlow: tradeRecords.tradeFlow,
          periodYear: tradeRecords.periodYear,
          periodMonth: tradeRecords.periodMonth,
          rawText: rawTradeRows.rawText,
          rawValues: rawTradeRows.rawValues,
          rowNumber: rawTradeRows.rowNumber,
          rowHashSha256: rawTradeRows.rowHashSha256,
          workingStorageKey: sourceFiles.workingStorageKey,
          sourceDomain: sourceFiles.sourceDomain,
          sourceTradeFlow: sourceFiles.tradeFlow,
          sourcePeriodYear: sourceFiles.periodYear,
          sourcePeriodMonth: sourceFiles.periodMonth,
        })
        .from(tradeRecords)
        .innerJoin(rawTradeRows, eq(tradeRecords.rawTradeRowId, rawTradeRows.id))
        .innerJoin(sourceFiles, eq(tradeRecords.sourceFileId, sourceFiles.id))
        .where(and(...conditions))
        .orderBy(asc(rawTradeRows.rowNumber), asc(rawTradeRows.id))
        .limit(currentLimit);

      if (rows.length === 0) {
        break;
      }

      const lastRow = rows.at(-1);
      if (lastRow) {
        lastCursor = {
          rowNumber: lastRow.rowNumber,
          rawTradeRowId: lastRow.rawTradeRowId,
        };
      }
      scanned += rows.length;

      const reconstructed = await reconstructRawRows(rows, localLineReaders);
      const rawRows = reconstructed.rawRows;
      skipped += reconstructed.skipped;

      const deletedPartyIds = await deleteLogisticsPartyLinksForRawRows(
        db,
        rawRows.map((row) => row.rawTradeRowId),
      );
      tracker.markPartyIdsTouched(deletedPartyIds);

      linked += await upsertLogisticsPartyLinksForRawRows(db, tracker, rawRows);

      process.stdout.write(
        `Backfilled logistics parties through ${scanned} records; linked ${linked} logistics appearances.\n`,
      );
    }
  } finally {
    for (const reader of localLineReaders.values()) {
      reader.close();
    }
  }

  await tracker.refreshStats();

  process.stdout.write(
    `Logistics party backfill complete. Scanned ${scanned} records, linked ${linked} appearances, skipped ${skipped}, touched ${tracker.partyCount} parties.\n`,
  );

  return {
    scanned,
    linked,
    skipped,
    partyCount: tracker.partyCount,
  };
}

async function main() {
  config({ path: ".env.local" });
  config();
  assertDevDatabaseTarget("logistics party backfill");

  const { db } = await import("../../src/db/client");
  await runLogisticsPartyBackfill(db);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Logistics party backfill failed: ${message}\n`);
    process.exitCode = 1;
  });
}
