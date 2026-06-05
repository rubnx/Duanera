import { createReadStream } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";

import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { eq, inArray } from "drizzle-orm";
import iconv from "iconv-lite";

import type { DbClient } from "@/db/client";
import { rawTradeRows, sourceFiles } from "@/db/schema";
import {
  importFieldNames,
  exportFieldNames,
} from "@/ingest/aduana-source-layouts";
import {
  parseAduanaRow,
  rowHashSha256,
} from "@/ingest/aduana-main-file";

const localDataRoot = path.join(/* turbopackIgnore: true */ process.cwd(), "data");

export type SourceRowReconstructionStatus =
  | "postgres"
  | "local"
  | "r2"
  | "unavailable"
  | "hash_mismatch";

export type SourceRowReconstructionResult = {
  status: SourceRowReconstructionStatus;
  rawText: string | null;
  rawValues: Record<string, string> | null;
  verified: boolean;
  message: string;
};

export type SourceRowRecord = {
  sourceFileId: string;
  rawTradeRowId: string;
  tradeFlow: string;
  rawText: string | null;
  rawValues: unknown | null;
};

type SourceRowMetadata = {
  rawTradeRowId?: string;
  rowNumber: number;
  rowHashSha256: string;
  workingStorageKey: string | null;
  sourceDomain: string;
  tradeFlow: string | null;
  periodYear: number | null;
  periodMonth: number | null;
};

type R2Env = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint: string;
};

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

function firstWorkingStoragePath(value: string | null) {
  return (
    value
      ?.split("|")
      .map((part) => part.trim())
      .find(Boolean) ?? null
  );
}

export function resolveLocalWorkingStoragePath(value: string | null): string {
  const firstPath = firstWorkingStoragePath(value);
  if (!firstPath) {
    throw new Error("Source file is missing a usable working storage path.");
  }

  const normalizedPath = firstPath.replace(/\\/g, "/");
  if (path.isAbsolute(firstPath)) {
    throw new Error(`${firstPath}: working storage path must stay inside the repository.`);
  }

  if (normalizedPath !== "data" && !normalizedPath.startsWith("data/")) {
    throw new Error(`${firstPath}: working storage path must be inside the ignored data/ archive.`);
  }

  const absolutePath = path.resolve(
    localDataRoot,
    normalizedPath === "data" ? "" : normalizedPath.replace(/^data\//, ""),
  );
  const relativeDataPath = path.relative(localDataRoot, absolutePath);

  if (relativeDataPath.startsWith("..") || path.isAbsolute(relativeDataPath)) {
    throw new Error(`${firstPath}: working storage path must be inside the ignored data/ archive.`);
  }

  return absolutePath;
}

async function readLineFromDecodedStream(
  stream: NodeJS.ReadableStream,
  rowNumber: number,
): Promise<string | null> {
  if (!Number.isSafeInteger(rowNumber) || rowNumber < 1) {
    throw new Error(`Invalid source row number: ${rowNumber}.`);
  }

  const reader = createInterface({
    input: stream.pipe(iconv.decodeStream("win1252")),
    crlfDelay: Infinity,
  });

  let currentRow = 0;
  try {
    for await (const line of reader) {
      currentRow += 1;
      if (currentRow === rowNumber) {
        reader.close();
        return line;
      }
    }
  } finally {
    reader.close();
  }

  return null;
}

async function readSelectedLinesFromDecodedStream(
  stream: NodeJS.ReadableStream,
  rowNumbers: Set<number>,
): Promise<Map<number, string>> {
  if (rowNumbers.size === 0) {
    return new Map();
  }

  for (const rowNumber of rowNumbers) {
    if (!Number.isSafeInteger(rowNumber) || rowNumber < 1) {
      throw new Error(`Invalid source row number: ${rowNumber}.`);
    }
  }

  const lines = new Map<number, string>();
  const maxRow = Math.max(...rowNumbers);
  const reader = createInterface({
    input: stream.pipe(iconv.decodeStream("win1252")),
    crlfDelay: Infinity,
  });

  let currentRow = 0;
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

export async function readLocalSourceLine(
  workingStorageKey: string | null,
  rowNumber: number,
) {
  return readLineFromDecodedStream(
    createReadStream(resolveLocalWorkingStoragePath(workingStorageKey)),
    rowNumber,
  );
}

async function readLocalSourceLines(
  workingStorageKey: string | null,
  rowNumbers: Set<number>,
) {
  return readSelectedLinesFromDecodedStream(
    createReadStream(resolveLocalWorkingStoragePath(workingStorageKey)),
    rowNumbers,
  );
}

function periodKey(year: number | null, month: number | null) {
  if (!year || !month) {
    return "undated";
  }

  return `${year}/${String(month).padStart(2, "0")}`;
}

function sourceGroup(tradeFlow: string | null, workingPath: string) {
  if (tradeFlow === "import") return "imports";
  if (tradeFlow === "export") return "exports";
  if (workingPath.includes("/imports/")) return "imports";
  if (workingPath.includes("/exports/")) return "exports";
  return "misc";
}

export function workingFileR2Key(metadata: SourceRowMetadata) {
  const workingPath = firstWorkingStoragePath(metadata.workingStorageKey);
  if (!workingPath) {
    return null;
  }

  const sourceDomain = metadata.sourceDomain.replaceAll(".", "-");
  return [
    "sources",
    "cl",
    "aduana",
    sourceDomain,
    sourceGroup(metadata.tradeFlow, workingPath),
    periodKey(metadata.periodYear, metadata.periodMonth),
    "working",
    path.posix.basename(workingPath),
  ].join("/");
}

function r2Env(): R2Env | null {
  const env = {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucket: process.env.R2_BUCKET,
    endpoint: process.env.R2_ENDPOINT,
  };

  if (
    !env.accountId ||
    !env.accessKeyId ||
    !env.secretAccessKey ||
    !env.bucket ||
    !env.endpoint
  ) {
    return null;
  }

  const endpointHost = new URL(env.endpoint).host;
  const expectedHost = `${env.accountId}.r2.cloudflarestorage.com`;
  if (endpointHost !== expectedHost) {
    throw new Error(`R2 endpoint host does not match Cloudflare account ${env.accountId}.`);
  }

  return env as R2Env;
}

function r2Client(env: R2Env) {
  return new S3Client({
    region: "auto",
    endpoint: env.endpoint,
    credentials: {
      accessKeyId: env.accessKeyId,
      secretAccessKey: env.secretAccessKey,
    },
  });
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

async function readR2SourceLine(key: string, rowNumber: number) {
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

  return readLineFromDecodedStream(objectBodyStream(response.Body), rowNumber);
}

async function readR2SourceLines(key: string, rowNumbers: Set<number>) {
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

  return readSelectedLinesFromDecodedStream(objectBodyStream(response.Body), rowNumbers);
}

function fieldNamesForFlow(tradeFlow: string) {
  if (tradeFlow === "import") return importFieldNames;
  if (tradeFlow === "export") return exportFieldNames;
  return null;
}

function parseVerifiedLine({
  rawText,
  rowNumber,
  expectedHash,
  tradeFlow,
}: {
  rawText: string;
  rowNumber: number;
  expectedHash: string;
  tradeFlow: string;
}) {
  if (rowHashSha256(rawText) !== expectedHash) {
    return null;
  }

  const fieldNames = fieldNamesForFlow(tradeFlow);
  if (!fieldNames) {
    return null;
  }

  const parsed = parseAduanaRow(rawText, rowNumber, fieldNames);
  return parsed.rawValues;
}

async function sourceRowMetadata(
  db: DbClient,
  record: Pick<SourceRowRecord, "sourceFileId" | "rawTradeRowId">,
) {
  const rows = await db
    .select({
      rowNumber: rawTradeRows.rowNumber,
      rowHashSha256: rawTradeRows.rowHashSha256,
      workingStorageKey: sourceFiles.workingStorageKey,
      sourceDomain: sourceFiles.sourceDomain,
      tradeFlow: sourceFiles.tradeFlow,
      periodYear: sourceFiles.periodYear,
      periodMonth: sourceFiles.periodMonth,
    })
    .from(rawTradeRows)
    .innerJoin(sourceFiles, eq(rawTradeRows.sourceFileId, sourceFiles.id))
    .where(eq(rawTradeRows.id, record.rawTradeRowId))
    .limit(1);

  const row = rows[0];
  return row ?? null;
}

async function sourceRowsMetadata(
  db: DbClient,
  rawTradeRowIds: string[],
): Promise<Map<string, SourceRowMetadata>> {
  if (rawTradeRowIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({
      rawTradeRowId: rawTradeRows.id,
      rowNumber: rawTradeRows.rowNumber,
      rowHashSha256: rawTradeRows.rowHashSha256,
      workingStorageKey: sourceFiles.workingStorageKey,
      sourceDomain: sourceFiles.sourceDomain,
      tradeFlow: sourceFiles.tradeFlow,
      periodYear: sourceFiles.periodYear,
      periodMonth: sourceFiles.periodMonth,
    })
    .from(rawTradeRows)
    .innerJoin(sourceFiles, eq(rawTradeRows.sourceFileId, sourceFiles.id))
    .where(inArray(rawTradeRows.id, rawTradeRowIds));

  return new Map(rows.map((row) => [row.rawTradeRowId, row]));
}

async function tryLocal(metadata: SourceRowMetadata, tradeFlow: string) {
  try {
    const rawText = await readLocalSourceLine(
      metadata.workingStorageKey,
      metadata.rowNumber,
    );
    if (!rawText) {
      return null;
    }

    const rawValues = parseVerifiedLine({
      rawText,
      rowNumber: metadata.rowNumber,
      expectedHash: metadata.rowHashSha256,
      tradeFlow,
    });

    return rawValues ? { rawText, rawValues } : "hash_mismatch";
  } catch {
    return null;
  }
}

async function tryR2(metadata: SourceRowMetadata, tradeFlow: string) {
  const key = workingFileR2Key(metadata);
  if (!key) {
    return null;
  }

  try {
    const rawText = await readR2SourceLine(key, metadata.rowNumber);
    if (!rawText) {
      return null;
    }

    const rawValues = parseVerifiedLine({
      rawText,
      rowNumber: metadata.rowNumber,
      expectedHash: metadata.rowHashSha256,
      tradeFlow,
    });

    return rawValues ? { rawText, rawValues } : "hash_mismatch";
  } catch {
    return null;
  }
}

function sourceGroupKey(metadata: SourceRowMetadata) {
  return [
    metadata.workingStorageKey ?? "",
    metadata.sourceDomain,
    metadata.tradeFlow ?? "",
    metadata.periodYear ?? "",
    metadata.periodMonth ?? "",
  ].join("|");
}

function unavailableSourceRow(message: string): SourceRowReconstructionResult {
  return {
    status: "unavailable",
    rawText: null,
    rawValues: null,
    verified: false,
    message,
  };
}

function hashMismatchSourceRow(): SourceRowReconstructionResult {
  return {
    status: "hash_mismatch",
    rawText: null,
    rawValues: null,
    verified: false,
    message: "La fila encontrada no coincide con el hash guardado.",
  };
}

async function readBatchSourceLines(
  metadata: SourceRowMetadata,
  rowNumbers: Set<number>,
) {
  let lines: Map<number, string> | null = null;
  let status: "local" | "r2" | null = null;

  try {
    lines = await readLocalSourceLines(metadata.workingStorageKey, rowNumbers);
    status = "local";
  } catch {
    lines = null;
  }

  if (lines && lines.size === rowNumbers.size) {
    return { lines, status };
  }

  const r2Key = workingFileR2Key(metadata);
  if (!r2Key) {
    return { lines, status };
  }

  try {
    const r2Lines = await readR2SourceLines(r2Key, rowNumbers);
    if (!r2Lines) {
      return { lines, status };
    }

    return {
      lines: new Map([...(lines ?? new Map()), ...r2Lines]),
      status: "r2" as const,
    };
  } catch {
    return { lines, status };
  }
}

export async function reconstructTradeRecordSourceRows(
  db: DbClient,
  records: SourceRowRecord[],
): Promise<Map<string, SourceRowReconstructionResult>> {
  const results = new Map<string, SourceRowReconstructionResult>();
  const pendingRecords: SourceRowRecord[] = [];

  for (const record of records) {
    const postgresValues = objectRecord(record.rawValues);
    if (postgresValues) {
      results.set(record.rawTradeRowId, {
        status: "postgres",
        rawText: record.rawText,
        rawValues: postgresValues,
        verified: true,
        message: "Fila fuente disponible en Postgres.",
      });
    } else {
      pendingRecords.push(record);
    }
  }

  const metadataByRawRowId = await sourceRowsMetadata(
    db,
    pendingRecords.map((record) => record.rawTradeRowId),
  );
  const groupedRecords = new Map<string, SourceRowRecord[]>();

  for (const record of pendingRecords) {
    const metadata = metadataByRawRowId.get(record.rawTradeRowId);
    if (!metadata) {
      results.set(
        record.rawTradeRowId,
        unavailableSourceRow(
          "No se encontró metadata suficiente para reconstruir la fila fuente.",
        ),
      );
      continue;
    }

    const group = groupedRecords.get(sourceGroupKey(metadata)) ?? [];
    group.push(record);
    groupedRecords.set(sourceGroupKey(metadata), group);
  }

  for (const recordsInGroup of groupedRecords.values()) {
    const firstRecord = recordsInGroup[0];
    if (!firstRecord) {
      continue;
    }

    const firstMetadata = metadataByRawRowId.get(firstRecord.rawTradeRowId);
    if (!firstMetadata) {
      continue;
    }

    const rowNumbers = new Set(
      recordsInGroup
        .map((record) => metadataByRawRowId.get(record.rawTradeRowId)?.rowNumber)
        .filter((rowNumber): rowNumber is number => rowNumber !== undefined),
    );
    const source = await readBatchSourceLines(firstMetadata, rowNumbers);

    for (const record of recordsInGroup) {
      const metadata = metadataByRawRowId.get(record.rawTradeRowId);
      const rawText = metadata ? source.lines?.get(metadata.rowNumber) : undefined;

      if (!metadata || !rawText) {
        results.set(
          record.rawTradeRowId,
          unavailableSourceRow(
            "No fue posible reconstruir la fila desde Postgres, archivo local o R2.",
          ),
        );
        continue;
      }

      const rawValues = parseVerifiedLine({
        rawText,
        rowNumber: metadata.rowNumber,
        expectedHash: metadata.rowHashSha256,
        tradeFlow: record.tradeFlow,
      });

      results.set(
        record.rawTradeRowId,
        rawValues
          ? {
              status: source.status ?? "local",
              rawText,
              rawValues,
              verified: true,
              message:
                source.status === "r2"
                  ? "Fila reconstruida desde archivo privado R2."
                  : "Fila reconstruida desde archivo local preservado.",
            }
          : hashMismatchSourceRow(),
      );
    }
  }

  return results;
}

export async function reconstructTradeRecordSourceRow(
  db: DbClient,
  record: SourceRowRecord,
): Promise<SourceRowReconstructionResult> {
  const postgresValues = objectRecord(record.rawValues);
  if (postgresValues) {
    return {
      status: "postgres",
      rawText: record.rawText,
      rawValues: postgresValues,
      verified: true,
      message: "Fila fuente disponible en Postgres.",
    };
  }

  const metadata = await sourceRowMetadata(db, record);
  if (!metadata) {
    return {
      status: "unavailable",
      rawText: null,
      rawValues: null,
      verified: false,
      message: "No se encontró metadata suficiente para reconstruir la fila fuente.",
    };
  }

  const localResult = await tryLocal(metadata, record.tradeFlow);
  if (localResult && localResult !== "hash_mismatch") {
    return {
      status: "local",
      rawText: localResult.rawText,
      rawValues: localResult.rawValues,
      verified: true,
      message: "Fila reconstruida desde archivo local preservado.",
    };
  }

  const r2Result = await tryR2(metadata, record.tradeFlow);
  if (r2Result && r2Result !== "hash_mismatch") {
    return {
      status: "r2",
      rawText: r2Result.rawText,
      rawValues: r2Result.rawValues,
      verified: true,
      message: "Fila reconstruida desde archivo privado R2.",
    };
  }

  if (localResult === "hash_mismatch" || r2Result === "hash_mismatch") {
    return {
      status: "hash_mismatch",
      rawText: null,
      rawValues: null,
      verified: false,
      message: "La fila encontrada no coincide con el hash guardado.",
    };
  }

  return {
    status: "unavailable",
    rawText: null,
    rawValues: null,
    verified: false,
    message: "No fue posible reconstruir la fila desde Postgres, archivo local o R2.",
  };
}
