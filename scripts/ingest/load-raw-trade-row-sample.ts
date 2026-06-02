import { createReadStream } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";

import { config } from "dotenv";
import { and, asc, eq, sql } from "drizzle-orm";
import iconv from "iconv-lite";

import type { DbClient } from "../../src/db/client";
import { assertDevDatabaseTarget } from "../../src/db/dev-guard";
import { positiveIntegerEnvValue } from "../../src/lib/env";
import { parseAduanaRow } from "../../src/ingest/aduana-main-file";
import {
  parseRawRowPayloadRetentionMode,
  rawRowPayloadRetentionFields,
} from "../../src/ingest/raw-row-retention";
import {
  importBatches,
  rawTradeRows,
  sourceFiles,
  sourceLayoutFields,
  sourceLayouts,
} from "../../src/db/schema";

const parserName = "aduana-main-sample-raw-loader";
const parserVersion = "0.1.0";
const defaultLimit = 100;
const defaultBatchSize = 250;
const repoRoot = process.cwd();

type SampleSource = {
  normalizedRawFilename: string;
};

const sampleSources: SampleSource[] = [
  {
    normalizedRawFilename: "cl_aduana_imports_2026_03_raw.rar",
  },
  {
    normalizedRawFilename: "cl_aduana_exports_2026_03_raw.rar",
  },
];

export function rawTradeRowSourceFilenamesFromEnv(
  value = process.env.RAW_TRADE_ROW_SOURCE_FILENAMES,
): SampleSource[] {
  if (!value?.trim()) {
    return sampleSources;
  }

  const filenames = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (filenames.length === 0) {
    throw new Error("RAW_TRADE_ROW_SOURCE_FILENAMES must include at least one filename.");
  }

  return filenames.map((normalizedRawFilename) => ({ normalizedRawFilename }));
}

function rowLimit(): number {
  return positiveIntegerEnvValue("SAMPLE_ROW_LIMIT", process.env.SAMPLE_ROW_LIMIT, defaultLimit);
}

function batchSize(): number {
  return positiveIntegerEnvValue(
    "RAW_LOAD_BATCH_SIZE",
    process.env.RAW_LOAD_BATCH_SIZE,
    defaultBatchSize,
  );
}

export function resolveWorkingStoragePath(value: string | null): string {
  if (!value) {
    throw new Error("Source file is missing workingStorageKey.");
  }

  const firstPath = value
    .split("|")
    .map((part) => part.trim())
    .find(Boolean);

  if (!firstPath) {
    throw new Error("Source file workingStorageKey does not contain a usable local path.");
  }

  const absolutePath = path.resolve(repoRoot, firstPath);
  const relativePath = path.relative(repoRoot, absolutePath);
  const posixRelativePath = relativePath.split(path.sep).join("/");

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`${firstPath}: working storage path must stay inside the repository.`);
  }

  if (posixRelativePath !== "data" && !posixRelativePath.startsWith("data/")) {
    throw new Error(`${firstPath}: working storage path must be inside the ignored data/ archive.`);
  }

  return absolutePath;
}

async function getSource(database: DbClient, source: SampleSource) {
  const rows = await database
    .select({
      id: sourceFiles.id,
      workingStorageKey: sourceFiles.workingStorageKey,
      tradeFlow: sourceFiles.tradeFlow,
      sourceCategory: sourceFiles.sourceCategory,
      periodYear: sourceFiles.periodYear,
      periodMonth: sourceFiles.periodMonth,
    })
    .from(sourceFiles)
    .where(eq(sourceFiles.normalizedRawFilename, source.normalizedRawFilename))
    .limit(1);

  if (!rows[0]) {
    throw new Error(
      `Source file ${source.normalizedRawFilename} is missing. Run db:seed:source-files first.`,
    );
  }

  const tradeFlow = rows[0].tradeFlow;
  if (tradeFlow !== "import" && tradeFlow !== "export") {
    throw new Error(`${source.normalizedRawFilename} must have import/export trade_flow.`);
  }

  if (rows[0].sourceCategory !== "dataset_resource") {
    throw new Error(
      `${source.normalizedRawFilename} is ${rows[0].sourceCategory ?? "uncategorized"}; raw row loading only accepts main dataset_resource files.`,
    );
  }

  return { ...rows[0], tradeFlow };
}

async function getLayout(database: DbClient, tradeFlow: string) {
  const rows = await database
    .select({ id: sourceLayouts.id })
    .from(sourceLayouts)
    .where(
      and(
        eq(sourceLayouts.sourceSystem, "chile_aduana"),
        eq(sourceLayouts.sourceDomain, "datos.gob.cl"),
        eq(sourceLayouts.tradeFlow, tradeFlow),
        eq(sourceLayouts.recordRole, "main_data"),
      ),
    )
    .limit(1);

  if (!rows[0]) {
    throw new Error(`Source layout for ${tradeFlow} main_data is missing.`);
  }

  const fields = await database
    .select({ sourceFieldName: sourceLayoutFields.sourceFieldName })
    .from(sourceLayoutFields)
    .where(eq(sourceLayoutFields.sourceLayoutId, rows[0].id))
    .orderBy(asc(sourceLayoutFields.fieldOrdinal));

  return {
    id: rows[0].id,
    fieldNames: fields.map((field) => field.sourceFieldName),
  };
}

async function upsertImportBatch(database: DbClient, sourceFileId: string) {
  const existing = await database
    .select({ id: importBatches.id })
    .from(importBatches)
    .where(
      and(
        eq(importBatches.sourceFileId, sourceFileId),
        eq(importBatches.parserName, parserName),
        eq(importBatches.parserVersion, parserVersion),
      ),
    )
    .limit(1);

  const values = {
    sourceFileId,
    parserName,
    parserVersion,
    status: "running",
    startedAt: new Date(),
    completedAt: null,
    rowsTotal: null,
    rowsParsed: 0,
    rowsFailed: 0,
    warningSummary: null,
    errorSummary: null,
  };

  if (existing[0]) {
    await database
      .update(importBatches)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(importBatches.id, existing[0].id));
    return existing[0].id;
  }

  const [inserted] = await database.insert(importBatches).values(values).returning({
    id: importBatches.id,
  });
  return inserted.id;
}

async function loadSample(
  database: DbClient,
  source: SampleSource,
  limit: number,
  payloadRetentionMode: ReturnType<typeof parseRawRowPayloadRetentionMode>,
) {
  const sourceFile = await getSource(database, source);
  const layout = await getLayout(database, sourceFile.tradeFlow);
  const importBatchId = await upsertImportBatch(database, sourceFile.id);
  const workingPath = resolveWorkingStoragePath(sourceFile.workingStorageKey);

  let rowsRead = 0;
  let rowsParsed = 0;
  let rowsFailed = 0;
  const batch: Array<typeof rawTradeRows.$inferInsert> = [];
  const insertBatchSize = batchSize();
  const reader = createInterface({
    input: createReadStream(workingPath).pipe(iconv.decodeStream("win1252")),
    crlfDelay: Infinity,
  });

  async function flushBatch() {
    if (batch.length === 0) {
      return;
    }

    await database
      .insert(rawTradeRows)
      .values(batch)
      .onConflictDoUpdate({
        target: [rawTradeRows.sourceFileId, rawTradeRows.rowNumber],
        set: {
          importBatchId: sql`excluded.import_batch_id`,
          sourceLayoutId: sql`excluded.source_layout_id`,
          tradeFlow: sql`excluded.trade_flow`,
          periodYear: sql`excluded.period_year`,
          periodMonth: sql`excluded.period_month`,
          fieldCount: sql`excluded.field_count`,
          rawText: sql`excluded.raw_text`,
          rawValues: sql`excluded.raw_values`,
          rowHashSha256: sql`excluded.row_hash_sha256`,
          payloadRetentionMode: sql`excluded.payload_retention_mode`,
          payloadStorageKind: sql`excluded.payload_storage_kind`,
          payloadStorageBucket: sql`excluded.payload_storage_bucket`,
          payloadStorageKey: sql`excluded.payload_storage_key`,
          payloadHashSha256: sql`excluded.payload_hash_sha256`,
          payloadRetainedReason: sql`excluded.payload_retained_reason`,
          payloadPrunedAt: sql`excluded.payload_pruned_at`,
          payloadReconstructable: sql`excluded.payload_reconstructable`,
          parseStatus: sql`excluded.parse_status`,
          parseErrors: sql`excluded.parse_errors`,
          parseWarnings: sql`excluded.parse_warnings`,
          parserName: sql`excluded.parser_name`,
          parserVersion: sql`excluded.parser_version`,
          updatedAt: new Date(),
        },
      });

    batch.length = 0;
  }

  for await (const line of reader) {
    if (rowsRead >= limit) {
      break;
    }

    rowsRead += 1;
    const parsed = parseAduanaRow(line, rowsRead, layout.fieldNames);
    if (parsed.parseErrors.length > 0) {
      rowsFailed += 1;
    } else {
      rowsParsed += 1;
    }

    batch.push({
      sourceFileId: sourceFile.id,
      importBatchId,
      sourceLayoutId: layout.id,
      tradeFlow: sourceFile.tradeFlow,
      periodYear: sourceFile.periodYear,
      periodMonth: sourceFile.periodMonth,
      rowNumber: parsed.rowNumber,
      fieldCount: parsed.fieldCount,
      rawText: parsed.rawText,
      rawValues: parsed.rawValues,
      rowHashSha256: parsed.rowHashSha256,
      ...rawRowPayloadRetentionFields({
        mode: payloadRetentionMode,
        rowHashSha256: parsed.rowHashSha256,
        hasParseErrors: parsed.parseErrors.length > 0,
        hasParseWarnings: false,
      }),
      parseStatus: parsed.parseErrors.length > 0 ? "failed" : "parsed",
      parseErrors: parsed.parseErrors.length > 0 ? parsed.parseErrors : null,
      parseWarnings: null,
      parserName,
      parserVersion,
    });

    if (batch.length >= insertBatchSize) {
      await flushBatch();
    }

    if (rowsRead % 25000 === 0) {
      process.stdout.write(
        `${sourceFile.tradeFlow}: read ${rowsRead}, parsed ${rowsParsed}, failed ${rowsFailed}.\n`,
      );
    }
  }

  await flushBatch();

  await database
    .update(importBatches)
    .set({
      status: rowsFailed > 0 ? "partial" : "completed",
      completedAt: new Date(),
      rowsTotal: rowsRead,
      rowsParsed,
      rowsFailed,
      errorSummary: rowsFailed > 0 ? `${rowsFailed} rows failed field-count validation.` : null,
      updatedAt: new Date(),
    })
    .where(eq(importBatches.id, importBatchId));

  process.stdout.write(
    `Loaded ${sourceFile.tradeFlow} raw rows: ${rowsParsed} parsed, ${rowsFailed} failed.\n`,
  );
}

export async function runRawTradeRowSampleLoader(database: DbClient) {
  const limit = rowLimit();
  const payloadRetentionMode = parseRawRowPayloadRetentionMode(
    process.env.RAW_ROW_PAYLOAD_RETENTION,
  );

  process.stdout.write(`Raw row payload retention mode: ${payloadRetentionMode}.\n`);

  for (const source of rawTradeRowSourceFilenamesFromEnv()) {
    await loadSample(database, source, limit, payloadRetentionMode);
  }

  process.stdout.write(`Raw trade row sample load complete. Limit per flow: ${limit}.\n`);

  return { limit, payloadRetentionMode };
}

async function main() {
  config({ path: ".env.local" });
  config();
  assertDevDatabaseTarget("raw trade row sample loader");

  const { db } = await import("../../src/db/client");
  await runRawTradeRowSampleLoader(db);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Raw trade row sample load failed: ${message}\n`);
    process.exitCode = 1;
  });
}
