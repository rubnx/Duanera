import { eq, inArray } from "drizzle-orm";

import type { DbClient } from "@/db/client";
import { codeTables, codeValues } from "@/db/schema";
import type { TradeRecordDetail, TradeRecordSummary } from "@/trade/trade-records";

export type TradeRecordDecodedLabels = {
  currency?: string;
  quantityUnit?: string;
  originCountry?: string;
  acquisitionCountry?: string;
  consignmentCountry?: string;
  destinationCountry?: string;
  customsOffice?: string;
  embarkPort?: string;
  disembarkPort?: string;
  transportMode?: string;
  cargoType?: string;
};

export type TradeRecordWithLabels<T extends TradeRecordSummary | TradeRecordDetail> = T & {
  decodedLabels: TradeRecordDecodedLabels;
};

const labelTableKeys = [
  "chile_aduana:aduanas",
  "chile_aduana:paises",
  "chile_aduana:puertos",
  "chile_aduana:tipos_de_carga",
  "chile_aduana:vias_de_transporte",
  "chile_aduana:unidades_de_medida",
  "chile_aduana:moneda",
] as const;

type LabelTableKey = (typeof labelTableKeys)[number];
type LabelMaps = Record<LabelTableKey, Map<string, string>>;

function emptyLabelMaps(): LabelMaps {
  return Object.fromEntries(
    labelTableKeys.map((key) => [key, new Map<string, string>()]),
  ) as LabelMaps;
}

function normalizeCode(code: string | null | undefined): string | null {
  if (!code) {
    return null;
  }

  const trimmed = code.trim();
  if (!trimmed) {
    return null;
  }

  const numeric = Number.parseInt(trimmed, 10);
  if (/^\d+$/.test(trimmed) && Number.isFinite(numeric)) {
    return String(numeric);
  }

  return trimmed;
}

function labelFor(map: Map<string, string>, code: string | null | undefined) {
  const normalized = normalizeCode(code);
  if (!normalized) {
    return undefined;
  }

  return map.get(normalized);
}

export async function loadTradeRecordLabelMaps(db: DbClient): Promise<LabelMaps> {
  const maps = emptyLabelMaps();
  const rows = await db
    .select({
      tableKey: codeTables.codeTableKey,
      codeValue: codeValues.codeValue,
      labelEs: codeValues.labelEs,
    })
    .from(codeValues)
    .innerJoin(codeTables, eq(codeValues.codeTableId, codeTables.id))
    .where(inArray(codeTables.codeTableKey, [...labelTableKeys]));

  for (const row of rows) {
    const tableKey = row.tableKey as LabelTableKey;
    const normalizedCode = normalizeCode(row.codeValue);
    if (!normalizedCode || !row.labelEs || !(tableKey in maps)) {
      continue;
    }

    maps[tableKey].set(normalizedCode, row.labelEs);
  }

  return maps;
}

export function decodeTradeRecordLabels(
  record: TradeRecordSummary | TradeRecordDetail,
  maps: LabelMaps,
): TradeRecordDecodedLabels {
  return {
    currency: labelFor(maps["chile_aduana:moneda"], record.currencyCodeRaw),
    quantityUnit: labelFor(
      maps["chile_aduana:unidades_de_medida"],
      record.quantityUnitCode,
    ),
    originCountry: labelFor(maps["chile_aduana:paises"], record.originCountryCode),
    acquisitionCountry: "acquisitionCountryCode" in record
      ? labelFor(maps["chile_aduana:paises"], record.acquisitionCountryCode)
      : undefined,
    consignmentCountry: "consignmentCountryCode" in record
      ? labelFor(maps["chile_aduana:paises"], record.consignmentCountryCode)
      : undefined,
    destinationCountry:
      record.destinationCountryLabelRaw ??
      labelFor(maps["chile_aduana:paises"], record.destinationCountryCode),
    customsOffice: labelFor(maps["chile_aduana:aduanas"], record.customsOfficeCode),
    embarkPort:
      record.embarkPortLabelRaw ??
      labelFor(maps["chile_aduana:puertos"], record.embarkPortCode),
    disembarkPort:
      record.disembarkPortLabelRaw ??
      labelFor(maps["chile_aduana:puertos"], record.disembarkPortCode),
    transportMode: labelFor(
      maps["chile_aduana:vias_de_transporte"],
      record.transportModeCode,
    ),
    cargoType: labelFor(maps["chile_aduana:tipos_de_carga"], record.cargoTypeCode),
  };
}

export async function enrichTradeRecordsWithLabels<T extends TradeRecordSummary | TradeRecordDetail>(
  db: DbClient,
  records: T[],
): Promise<Array<TradeRecordWithLabels<T>>> {
  const maps = await loadTradeRecordLabelMaps(db);

  return records.map((record) => ({
    ...record,
    decodedLabels: decodeTradeRecordLabels(record, maps),
  }));
}

export async function enrichTradeRecordWithLabels<T extends TradeRecordSummary | TradeRecordDetail>(
  db: DbClient,
  record: T | null,
): Promise<TradeRecordWithLabels<T> | null> {
  if (!record) {
    return null;
  }

  const [enriched] = await enrichTradeRecordsWithLabels(db, [record]);
  return enriched ?? null;
}
