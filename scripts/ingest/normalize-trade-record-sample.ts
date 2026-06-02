import { config } from "dotenv";
import { and, asc, eq, gt, isNotNull, sql } from "drizzle-orm";
import { pathToFileURL } from "node:url";

import type { DbClient } from "../../src/db/client";
import { assertDevDatabaseTarget } from "../../src/db/dev-guard";
import {
  rawTradeRows,
  sourceTradeParticipants,
  tradeRecords,
} from "../../src/db/schema";
import { positiveIntegerEnvValue } from "../../src/lib/env";
import { mapTradeRecordValues, rawValuesRecord } from "./normalize-trade-record-values";
export { parseIntegerValue, rawValuesRecord } from "./normalize-trade-record-values";

const parserName = "aduana-main-sample-normalizer";
const parserVersion = "0.1.0";
const defaultRawChunkSize = 1000;
const defaultTradeRecordBatchSize = 500;

type ParticipantRole = "importer" | "exporter_primary" | "exporter_secondary";

type ParticipantStats = {
  id: string;
  count: number;
  firstSeenYear: number;
  firstSeenMonth: number;
  lastSeenYear: number;
  lastSeenMonth: number;
};

let db: DbClient;
const participantStats = new Map<string, ParticipantStats>();
const participantIds = new Map<string, string>();

function rawChunkSize(): number {
  return positiveIntegerEnvValue(
    "NORMALIZE_RAW_CHUNK_SIZE",
    process.env.NORMALIZE_RAW_CHUNK_SIZE,
    defaultRawChunkSize,
  );
}

function tradeRecordBatchSize(): number {
  return positiveIntegerEnvValue(
    "TRADE_RECORD_BATCH_SIZE",
    process.env.TRADE_RECORD_BATCH_SIZE,
    defaultTradeRecordBatchSize,
  );
}

function participantKey(tradeFlow: string, role: ParticipantRole, correlativeId: string) {
  return `${tradeFlow}:${role}:${correlativeId}`;
}

async function ensureParticipant(
  tradeFlow: "import" | "export",
  role: ParticipantRole,
  correlativeId: string | null,
  periodYear: number,
  periodMonth: number,
): Promise<string | null> {
  if (!correlativeId || correlativeId === "0") {
    return null;
  }

  const key = participantKey(tradeFlow, role, correlativeId);
  const existingId = participantIds.get(key);

  const values = {
    tradeFlow,
    participantRole: role,
    sourceCorrelativeId: correlativeId,
    firstSeenYear: periodYear,
    firstSeenMonth: periodMonth,
    lastSeenYear: periodYear,
    lastSeenMonth: periodMonth,
    crossYearStabilityStatus: "unknown",
  };

  const id =
    existingId ??
    (
      await db
        .insert(sourceTradeParticipants)
        .values(values)
        .onConflictDoNothing()
        .returning({ id: sourceTradeParticipants.id })
    )[0]?.id;

  if (!id) {
    const [existing] = await db
      .select({ id: sourceTradeParticipants.id })
      .from(sourceTradeParticipants)
      .where(
        and(
          eq(sourceTradeParticipants.tradeFlow, tradeFlow),
          eq(sourceTradeParticipants.participantRole, role),
          eq(sourceTradeParticipants.sourceCorrelativeId, correlativeId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new Error(`Could not create or find participant ${key}.`);
    }

    participantIds.set(key, existing.id);
  } else {
    participantIds.set(key, id);
  }

  const stats = participantStats.get(key);
  if (stats) {
    stats.count += 1;
    if (periodYear * 100 + periodMonth < stats.firstSeenYear * 100 + stats.firstSeenMonth) {
      stats.firstSeenYear = periodYear;
      stats.firstSeenMonth = periodMonth;
    }
    if (periodYear * 100 + periodMonth > stats.lastSeenYear * 100 + stats.lastSeenMonth) {
      stats.lastSeenYear = periodYear;
      stats.lastSeenMonth = periodMonth;
    }
  } else {
    participantStats.set(key, {
      id: participantIds.get(key)!,
      count: 1,
      firstSeenYear: periodYear,
      firstSeenMonth: periodMonth,
      lastSeenYear: periodYear,
      lastSeenMonth: periodMonth,
    });
  }

  return participantIds.get(key)!;
}

async function refreshParticipantStats() {
  for (const stats of participantStats.values()) {
    await db
      .update(sourceTradeParticipants)
      .set({
        recordCount: stats.count,
        firstSeenYear: stats.firstSeenYear,
        firstSeenMonth: stats.firstSeenMonth,
        lastSeenYear: stats.lastSeenYear,
        lastSeenMonth: stats.lastSeenMonth,
        updatedAt: new Date(),
      })
      .where(eq(sourceTradeParticipants.id, stats.id));
  }
}

async function loadExistingParticipants() {
  const rows = await db
    .select({
      id: sourceTradeParticipants.id,
      tradeFlow: sourceTradeParticipants.tradeFlow,
      participantRole: sourceTradeParticipants.participantRole,
      sourceCorrelativeId: sourceTradeParticipants.sourceCorrelativeId,
    })
    .from(sourceTradeParticipants);

  for (const row of rows) {
    participantIds.set(
      participantKey(
        row.tradeFlow,
        row.participantRole as ParticipantRole,
        row.sourceCorrelativeId,
      ),
      row.id,
    );
  }
}

async function flushTradeRecordBatch(batch: Array<typeof tradeRecords.$inferInsert>) {
  if (batch.length === 0) {
    return;
  }

  await db
    .insert(tradeRecords)
    .values(batch)
    .onConflictDoUpdate({
      target: tradeRecords.rawTradeRowId,
      set: {
        sourceFileId: sql`excluded.source_file_id`,
        importBatchId: sql`excluded.import_batch_id`,
        importerParticipantId: sql`excluded.importer_participant_id`,
        exporterPrimaryParticipantId: sql`excluded.exporter_primary_participant_id`,
        exporterSecondaryParticipantId: sql`excluded.exporter_secondary_participant_id`,
        tradeFlow: sql`excluded.trade_flow`,
        periodYear: sql`excluded.period_year`,
        periodMonth: sql`excluded.period_month`,
        declarationIdRaw: sql`excluded.declaration_id_raw`,
        itemNumber: sql`excluded.item_number`,
        acceptanceDateRaw: sql`excluded.acceptance_date_raw`,
        acceptanceDate: sql`excluded.acceptance_date`,
        importerCorrelativeId: sql`excluded.importer_correlative_id`,
        exporterPrimaryCorrelativeId: sql`excluded.exporter_primary_correlative_id`,
        exporterSecondaryCorrelativeId: sql`excluded.exporter_secondary_correlative_id`,
        hsCodeRaw: sql`excluded.hs_code_raw`,
        hsCodeNormalized: sql`excluded.hs_code_normalized`,
        productDescriptionRaw: sql`excluded.product_description_raw`,
        productAttributes: sql`excluded.product_attributes`,
        productSearchText: sql`excluded.product_search_text`,
        quantity: sql`excluded.quantity`,
        quantityUnitCode: sql`excluded.quantity_unit_code`,
        grossWeightTotal: sql`excluded.gross_weight_total`,
        grossWeightItem: sql`excluded.gross_weight_item`,
        itemCifValue: sql`excluded.item_cif_value`,
        itemFobValue: sql`excluded.item_fob_value`,
        declarationFobValue: sql`excluded.declaration_fob_value`,
        freightValue: sql`excluded.freight_value`,
        insuranceValue: sql`excluded.insurance_value`,
        cifValue: sql`excluded.cif_value`,
        unitPriceValue: sql`excluded.unit_price_value`,
        currencyCodeRaw: sql`excluded.currency_code_raw`,
        originCountryCode: sql`excluded.origin_country_code`,
        acquisitionCountryCode: sql`excluded.acquisition_country_code`,
        consignmentCountryCode: sql`excluded.consignment_country_code`,
        destinationCountryCode: sql`excluded.destination_country_code`,
        destinationCountryLabelRaw: sql`excluded.destination_country_label_raw`,
        customsOfficeCode: sql`excluded.customs_office_code`,
        embarkPortCode: sql`excluded.embark_port_code`,
        embarkPortLabelRaw: sql`excluded.embark_port_label_raw`,
        disembarkPortCode: sql`excluded.disembark_port_code`,
        disembarkPortLabelRaw: sql`excluded.disembark_port_label_raw`,
        transportModeCode: sql`excluded.transport_mode_code`,
        cargoTypeCode: sql`excluded.cargo_type_code`,
        parserName: sql`excluded.parser_name`,
        parserVersion: sql`excluded.parser_version`,
        updatedAt: new Date(),
      },
    });

  batch.length = 0;
}

export async function runTradeRecordNormalizer(database: DbClient) {
  db = database;
  participantIds.clear();
  participantStats.clear();

  let normalized = 0;
  const chunkSize = rawChunkSize();
  const insertBatchSize = tradeRecordBatchSize();
  const tradeRecordBatch: Array<typeof tradeRecords.$inferInsert> = [];

  await loadExistingParticipants();

  for (const tradeFlow of ["export", "import"] as const) {
    let lastRowNumber = 0;

    while (true) {
      const rows = await db
        .select({
          id: rawTradeRows.id,
          sourceFileId: rawTradeRows.sourceFileId,
          importBatchId: rawTradeRows.importBatchId,
          tradeFlow: rawTradeRows.tradeFlow,
          periodYear: rawTradeRows.periodYear,
          periodMonth: rawTradeRows.periodMonth,
          rowNumber: rawTradeRows.rowNumber,
          rawValues: rawTradeRows.rawValues,
        })
        .from(rawTradeRows)
        .where(
          and(
            eq(rawTradeRows.parseStatus, "parsed"),
            eq(rawTradeRows.tradeFlow, tradeFlow),
            isNotNull(rawTradeRows.rawValues),
            gt(rawTradeRows.rowNumber, lastRowNumber),
          ),
        )
        .orderBy(asc(rawTradeRows.rowNumber))
        .limit(chunkSize);

      if (rows.length === 0) {
        break;
      }

      for (const row of rows) {
        lastRowNumber = row.rowNumber;

        if (row.tradeFlow !== "import" && row.tradeFlow !== "export") {
          continue;
        }

        if (!row.periodYear || !row.periodMonth) {
          throw new Error(`Raw row ${row.id} is missing period fields.`);
        }

        const rawValues = rawValuesRecord(row.rawValues, row.id);
        const mapped = mapTradeRecordValues(row.tradeFlow, rawValues);

        const importerParticipantId = await ensureParticipant(
          "import",
          "importer",
          mapped.importerCorrelativeId,
          row.periodYear,
          row.periodMonth,
        );
        const exporterPrimaryParticipantId = await ensureParticipant(
          "export",
          "exporter_primary",
          mapped.exporterPrimaryCorrelativeId,
          row.periodYear,
          row.periodMonth,
        );
        const exporterSecondaryParticipantId = await ensureParticipant(
          "export",
          "exporter_secondary",
          mapped.exporterSecondaryCorrelativeId,
          row.periodYear,
          row.periodMonth,
        );

        tradeRecordBatch.push({
          sourceFileId: row.sourceFileId,
          importBatchId: row.importBatchId,
          rawTradeRowId: row.id,
          importerParticipantId,
          exporterPrimaryParticipantId,
          exporterSecondaryParticipantId,
          tradeFlow: row.tradeFlow,
          periodYear: row.periodYear,
          periodMonth: row.periodMonth,
          ...mapped,
          parserName,
          parserVersion,
        });

        normalized += 1;

        if (tradeRecordBatch.length >= insertBatchSize) {
          await flushTradeRecordBatch(tradeRecordBatch);
        }
      }

      process.stdout.write(
        `${tradeFlow}: normalized ${normalized} total rows through raw row ${lastRowNumber}.\n`,
      );
    }
  }

  await flushTradeRecordBatch(tradeRecordBatch);
  await refreshParticipantStats();

  process.stdout.write(
    `Trade record normalization complete. Normalized ${normalized} raw rows and touched ${participantStats.size} anonymous participants.\n`,
  );

  return { normalized, participantCount: participantStats.size };
}

async function main() {
  config({ path: ".env.local" });
  config();
  assertDevDatabaseTarget("trade record sample normalizer");

  const { db } = await import("../../src/db/client");
  await runTradeRecordNormalizer(db);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Trade record normalization failed: ${message}\n`);
    process.exitCode = 1;
  });
}
