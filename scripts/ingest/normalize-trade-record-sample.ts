import { config } from "dotenv";
import { and, asc, eq, gt, isNotNull, sql } from "drizzle-orm";

import { assertDevDatabaseTarget } from "../../src/db/dev-guard";
import {
  normalizeHsCode,
  parseAduanaDate,
  parseDecimalComma,
} from "../../src/ingest/aduana-main-file";
import { positiveIntegerEnvValue } from "../../src/lib/env";
import {
  rawTradeRows,
  sourceTradeParticipants,
  tradeRecords,
} from "../../src/db/schema";

config({ path: ".env.local" });
config();
assertDevDatabaseTarget("trade record sample normalizer");

const { db } = await import("../../src/db/client");

const parserName = "aduana-main-sample-normalizer";
const parserVersion = "0.1.0";
const defaultRawChunkSize = 1000;
const defaultTradeRecordBatchSize = 500;

type RawValues = Record<string, string>;
type ParticipantRole = "importer" | "exporter_primary" | "exporter_secondary";

type ParticipantStats = {
  id: string;
  count: number;
  firstSeenYear: number;
  firstSeenMonth: number;
  lastSeenYear: number;
  lastSeenMonth: number;
};

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

function text(values: RawValues, key: string): string | null {
  const value = values[key]?.trim();
  return value ? value : null;
}

function integer(values: RawValues, key: string): number | null {
  const value = text(values, key);
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function decimal(values: RawValues, key: string): string | null {
  const parsed = parseDecimalComma(values[key]);
  return parsed === null ? null : String(parsed);
}

function productSearchText(parts: Array<string | null>): string | null {
  const value = parts
    .filter((part): part is string => Boolean(part))
    .join(" ")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  return value.length > 0 ? value : null;
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

function importTradeValues(values: RawValues) {
  const description = text(values, "DNOMBRE");
  const attributes = {
    brand: text(values, "DMARCA"),
    variety: text(values, "DVARIEDAD"),
    other1: text(values, "DOTRO1"),
    other2: text(values, "DOTRO2"),
    attribute5: text(values, "ATR-5"),
    attribute6: text(values, "ATR-6"),
  };

  return {
    declarationIdRaw: text(values, "NUMENCRIPTADO"),
    itemNumber: integer(values, "NUMITEM"),
    acceptanceDateRaw: text(values, "FECACEP"),
    acceptanceDate: parseAduanaDate(text(values, "FECACEP")),
    importerCorrelativeId: text(values, "NUM_UNICO_IMPORTADOR"),
    exporterPrimaryCorrelativeId: null,
    exporterSecondaryCorrelativeId: null,
    hsCodeRaw: text(values, "ARANC-NAC"),
    hsCodeNormalized: normalizeHsCode(text(values, "ARANC-NAC")),
    productDescriptionRaw: description,
    productAttributes: attributes,
    productSearchText: productSearchText([description, ...Object.values(attributes)]),
    quantity: decimal(values, "CANT-MERC"),
    quantityUnitCode: text(values, "MEDIDA"),
    grossWeightTotal: decimal(values, "TOT_PESO"),
    grossWeightItem: null,
    itemCifValue: decimal(values, "CIF-ITEM"),
    itemFobValue: null,
    declarationFobValue: decimal(values, "FOB"),
    freightValue: decimal(values, "FLETE"),
    insuranceValue: decimal(values, "SEGURO"),
    cifValue: decimal(values, "CIF"),
    unitPriceValue: decimal(values, "PRE-UNIT"),
    currencyCodeRaw: text(values, "MONEDA"),
    originCountryCode: text(values, "PA_ORIG"),
    acquisitionCountryCode: text(values, "PA_ADQ"),
    consignmentCountryCode: text(values, "CODPAISCON"),
    destinationCountryCode: null,
    destinationCountryLabelRaw: null,
    customsOfficeCode: text(values, "ADU"),
    embarkPortCode: text(values, "PTO_EMB"),
    embarkPortLabelRaw: null,
    disembarkPortCode: text(values, "PTO_DESEM"),
    disembarkPortLabelRaw: null,
    transportModeCode: text(values, "VIA_TRAN"),
    cargoTypeCode: text(values, "TPO_CARGA"),
  };
}

function exportTradeValues(values: RawValues) {
  const description = text(values, "NOMBRE");
  const attributes = {
    attribute1: text(values, "ATRIBUTO1"),
    attribute2: text(values, "ATRIBUTO2"),
    attribute3: text(values, "ATRIBUTO3"),
    attribute4: text(values, "ATRIBUTO4"),
    attribute5: text(values, "ATRIBUTO5"),
    attribute6: text(values, "ATRIBUTO6"),
  };

  return {
    declarationIdRaw: text(values, "NUMEROIDENT"),
    itemNumber: integer(values, "NUMEROITEM"),
    acceptanceDateRaw: text(values, "FECHAACEPT"),
    acceptanceDate: parseAduanaDate(text(values, "FECHAACEPT")),
    importerCorrelativeId: null,
    exporterPrimaryCorrelativeId: text(values, "NRO_EXPORTADOR"),
    exporterSecondaryCorrelativeId: text(values, "NRO_EXPORTADOR_SEC"),
    hsCodeRaw: text(values, "CODIGOARANCEL"),
    hsCodeNormalized: normalizeHsCode(text(values, "CODIGOARANCEL")),
    productDescriptionRaw: description,
    productAttributes: attributes,
    productSearchText: productSearchText([description, ...Object.values(attributes)]),
    quantity: decimal(values, "CANTIDADMERCANCIA"),
    quantityUnitCode: text(values, "UNIDADMEDIDA"),
    grossWeightTotal: decimal(values, "PESOBRUTOTOTAL"),
    grossWeightItem: decimal(values, "PESOBRUTOITEM"),
    itemCifValue: null,
    itemFobValue: decimal(values, "FOBUS"),
    declarationFobValue: decimal(values, "TOTALVALORFOB"),
    freightValue: decimal(values, "VALORFLETE"),
    insuranceValue: decimal(values, "VALORSEGURO"),
    cifValue: decimal(values, "VALORCIF"),
    unitPriceValue: decimal(values, "FOBUNITARIO"),
    currencyCodeRaw: text(values, "MONEDA"),
    originCountryCode: null,
    acquisitionCountryCode: null,
    consignmentCountryCode: null,
    destinationCountryCode: text(values, "PAISDESTINO"),
    destinationCountryLabelRaw: text(values, "GLOSAPAISDESTINO"),
    customsOfficeCode: text(values, "ADUANA"),
    embarkPortCode: text(values, "PUERTOEMB"),
    embarkPortLabelRaw: text(values, "GLOSAPUERTOEMB"),
    disembarkPortCode: text(values, "PUERTODESEMB"),
    disembarkPortLabelRaw: text(values, "GLOSAPUERTODESEMB"),
    transportModeCode: text(values, "VIATRANSPORTE"),
    cargoTypeCode: text(values, "TIPOCARGA"),
  };
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

      const rawValues = row.rawValues as RawValues;
      const mapped =
        row.tradeFlow === "import" ? importTradeValues(rawValues) : exportTradeValues(rawValues);

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

    console.log(
      `${tradeFlow}: normalized ${normalized} total rows through raw row ${lastRowNumber}.`,
    );
  }
}

await flushTradeRecordBatch(tradeRecordBatch);
await refreshParticipantStats();

console.log(
  `Trade record normalization complete. Normalized ${normalized} raw rows and touched ${participantStats.size} anonymous participants.`,
);
