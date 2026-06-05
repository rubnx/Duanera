import { config } from "dotenv";
import { and, asc, eq, gt, isNotNull, sql } from "drizzle-orm";
import { pathToFileURL } from "node:url";

import type { DbClient } from "../../src/db/client";
import { assertDevDatabaseTarget } from "../../src/db/dev-guard";
import { rawTradeRows, tradeRecords } from "../../src/db/schema";
import { positiveIntegerEnvValue } from "../../src/lib/env";
import {
  deleteLogisticsPartyLinksForRawRows,
  TradeLogisticsPartyTracker,
  type LogisticsPartyRawRow,
  upsertLogisticsPartyLinksForRawRows,
} from "./normalize-trade-record-logistics-parties";
import { TradeParticipantTracker } from "./normalize-trade-record-participants";
import { mapTradeRecordValues, rawValuesRecord } from "./normalize-trade-record-values";
export { parseIntegerValue, rawValuesRecord } from "./normalize-trade-record-values";

const parserName = "aduana-main-sample-normalizer";
const parserVersion = "0.1.0";
const defaultRawChunkSize = 1000;
const defaultTradeRecordBatchSize = 500;

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

export function parseNormalizePeriod(value = process.env.NORMALIZE_PERIOD) {
  if (!value?.trim()) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})$/.exec(value.trim());
  if (!match) {
    throw new Error(`NORMALIZE_PERIOD must use YYYY-MM format, got ${value}.`);
  }

  const year = Number.parseInt(match[1] ?? "", 10);
  const month = Number.parseInt(match[2] ?? "", 10);
  if (month < 1 || month > 12) {
    throw new Error(`NORMALIZE_PERIOD month must be between 01 and 12, got ${value}.`);
  }

  return { year, month, period: value.trim() };
}

export function parseNormalizeStartRow(value = process.env.NORMALIZE_START_ROW) {
  if (!value?.trim()) {
    return 0;
  }

  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`NORMALIZE_START_ROW must be a non-negative integer, got ${value}.`);
  }

  return Number.parseInt(trimmed, 10);
}

export function parseNormalizeStartFlow(value = process.env.NORMALIZE_START_FLOW) {
  if (!value?.trim()) {
    return "export";
  }

  const normalized = value.trim();
  if (normalized !== "export" && normalized !== "import") {
    throw new Error(`NORMALIZE_START_FLOW must be export or import, got ${value}.`);
  }

  return normalized;
}

type NormalizerTradeFlow = "export" | "import";

const normalizerFlowOrder: NormalizerTradeFlow[] = ["export", "import"];

export function normalizeStartRowForFlow(
  tradeFlow: NormalizerTradeFlow,
  startFlow: NormalizerTradeFlow,
  startRow: number,
) {
  if (startRow <= 0) {
    return 0;
  }

  if (normalizerFlowOrder.indexOf(tradeFlow) < normalizerFlowOrder.indexOf(startFlow)) {
    return null;
  }

  return tradeFlow === startFlow ? startRow : 0;
}

async function flushTradeRecordBatch(
  database: DbClient,
  batch: Array<typeof tradeRecords.$inferInsert>,
  logisticsRows: LogisticsPartyRawRow[],
  logisticsParties: TradeLogisticsPartyTracker,
) {
  if (batch.length === 0) {
    return;
  }

  await database
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

  const deletedPartyIds = await deleteLogisticsPartyLinksForRawRows(
    database,
    logisticsRows.map((row) => row.rawTradeRowId),
  );
  logisticsParties.markPartyIdsTouched(deletedPartyIds);
  await upsertLogisticsPartyLinksForRawRows(database, logisticsParties, logisticsRows);

  batch.length = 0;
  logisticsRows.length = 0;
}

export async function runTradeRecordNormalizer(database: DbClient) {
  let normalized = 0;
  const chunkSize = rawChunkSize();
  const insertBatchSize = tradeRecordBatchSize();
  const period = parseNormalizePeriod();
  const startRow = parseNormalizeStartRow();
  const startFlow = parseNormalizeStartFlow();
  const tradeRecordBatch: Array<typeof tradeRecords.$inferInsert> = [];
  const logisticsRowsBatch: LogisticsPartyRawRow[] = [];
  const participants = new TradeParticipantTracker(database);
  const logisticsParties = new TradeLogisticsPartyTracker(database);

  await participants.loadExisting();
  await logisticsParties.loadExisting();

  if (period) {
    process.stdout.write(`Normalizing raw trade rows for period ${period.period} only.\n`);
  }
  if (startRow > 0) {
    process.stdout.write(
      `Resuming ${startFlow} normalization after raw row ${startRow}.\n`,
    );
  }

  for (const tradeFlow of normalizerFlowOrder) {
    const resumeRow = normalizeStartRowForFlow(tradeFlow, startFlow, startRow);
    if (resumeRow === null) {
      process.stdout.write(
        `Skipping ${tradeFlow} normalization because resume starts at ${startFlow} row ${startRow}.\n`,
      );
      continue;
    }

    let lastRowNumber = resumeRow;

    while (true) {
      const filters = [
        eq(rawTradeRows.parseStatus, "parsed"),
        eq(rawTradeRows.tradeFlow, tradeFlow),
        isNotNull(rawTradeRows.rawValues),
        gt(rawTradeRows.rowNumber, lastRowNumber),
      ];

      if (period) {
        filters.push(eq(rawTradeRows.periodYear, period.year));
        filters.push(eq(rawTradeRows.periodMonth, period.month));
      }

      const rows = await database
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
        .where(and(...filters))
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

        const importerParticipantId = await participants.ensure(
          "import",
          "importer",
          mapped.importerCorrelativeId,
          row.periodYear,
          row.periodMonth,
        );
        const exporterPrimaryParticipantId = await participants.ensure(
          "export",
          "exporter_primary",
          mapped.exporterPrimaryCorrelativeId,
          row.periodYear,
          row.periodMonth,
        );
        const exporterSecondaryParticipantId = await participants.ensure(
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
        logisticsRowsBatch.push({
          rawTradeRowId: row.id,
          sourceFileId: row.sourceFileId,
          importBatchId: row.importBatchId,
          tradeFlow: row.tradeFlow,
          periodYear: row.periodYear,
          periodMonth: row.periodMonth,
          rawValues,
        });

        normalized += 1;

        if (tradeRecordBatch.length >= insertBatchSize) {
          await flushTradeRecordBatch(
            database,
            tradeRecordBatch,
            logisticsRowsBatch,
            logisticsParties,
          );
        }
      }

      process.stdout.write(
        `${tradeFlow}: normalized ${normalized} total rows through raw row ${lastRowNumber}.\n`,
      );
    }
  }

  await flushTradeRecordBatch(database, tradeRecordBatch, logisticsRowsBatch, logisticsParties);
  await participants.refreshStats();
  await logisticsParties.refreshStats();

  process.stdout.write(
    `Trade record normalization complete. Normalized ${normalized} raw rows, touched ${participants.participantCount} anonymous participants, and touched ${logisticsParties.partyCount} logistics parties.\n`,
  );

  return {
    normalized,
    participantCount: participants.participantCount,
    logisticsPartyCount: logisticsParties.partyCount,
  };
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
