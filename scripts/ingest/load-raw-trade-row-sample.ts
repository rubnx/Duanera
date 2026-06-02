import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

import { config } from "dotenv";
import { and, asc, eq, sql } from "drizzle-orm";
import iconv from "iconv-lite";

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

config({ path: ".env.local" });
config();
assertDevDatabaseTarget("raw trade row sample loader");

const { db } = await import("../../src/db/client");

const parserName = "aduana-main-sample-raw-loader";
const parserVersion = "0.1.0";
const defaultLimit = 100;
const defaultBatchSize = 250;
const payloadRetentionMode = parseRawRowPayloadRetentionMode(
  process.env.RAW_ROW_PAYLOAD_RETENTION,
);

type SampleSource = {
  tradeFlow: "import" | "export";
  normalizedRawFilename: string;
};

const sampleSources: SampleSource[] = [
  {
    tradeFlow: "import",
    normalizedRawFilename: "cl_aduana_imports_2026_03_raw.rar",
  },
  {
    tradeFlow: "export",
    normalizedRawFilename: "cl_aduana_exports_2026_03_raw.rar",
  },
];

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

function singleWorkingPath(value: string | null): string {
  if (!value) {
    throw new Error("Source file is missing workingStorageKey.");
  }

  return value.split("|")[0] ?? value;
}

async function getSource(source: SampleSource) {
  const rows = await db
    .select({
      id: sourceFiles.id,
      workingStorageKey: sourceFiles.workingStorageKey,
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

  return rows[0];
}

async function getLayout(tradeFlow: string) {
  const rows = await db
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

  const fields = await db
    .select({ sourceFieldName: sourceLayoutFields.sourceFieldName })
    .from(sourceLayoutFields)
    .where(eq(sourceLayoutFields.sourceLayoutId, rows[0].id))
    .orderBy(asc(sourceLayoutFields.fieldOrdinal));

  return {
    id: rows[0].id,
    fieldNames: fields.map((field) => field.sourceFieldName),
  };
}

async function upsertImportBatch(sourceFileId: string) {
  const existing = await db
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
    await db
      .update(importBatches)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(importBatches.id, existing[0].id));
    return existing[0].id;
  }

  const [inserted] = await db.insert(importBatches).values(values).returning({
    id: importBatches.id,
  });
  return inserted.id;
}

async function loadSample(source: SampleSource, limit: number) {
  const sourceFile = await getSource(source);
  const layout = await getLayout(source.tradeFlow);
  const importBatchId = await upsertImportBatch(sourceFile.id);
  const workingPath = singleWorkingPath(sourceFile.workingStorageKey);

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

    await db
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
      tradeFlow: source.tradeFlow,
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
      console.log(
        `${source.tradeFlow}: read ${rowsRead}, parsed ${rowsParsed}, failed ${rowsFailed}.`,
      );
    }
  }

  await flushBatch();

  await db
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

  console.log(
    `Loaded ${source.tradeFlow} raw rows: ${rowsParsed} parsed, ${rowsFailed} failed.`,
  );
}

const limit = rowLimit();
console.log(`Raw row payload retention mode: ${payloadRetentionMode}.`);
for (const source of sampleSources) {
  await loadSample(source, limit);
}

console.log(`Raw trade row sample load complete. Limit per flow: ${limit}.`);
