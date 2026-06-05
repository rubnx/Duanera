import { asc, eq, inArray } from "drizzle-orm";

import type { DbClient } from "@/db/client";
import {
  codeTables,
  codeValues,
} from "@/db/schema";
import { cleanPublicReferenceLabel } from "@/text/reference-labels";
import { canonicalTradeParticipantDisplayName } from "@/trade/trade-participant-display";
import {
  getLogisticsPartySearchResultById,
  searchLogisticsParties,
} from "@/trade/trade-logistics-party-search";

export type TradeRecordFilterOption = {
  value: string;
  label: string;
  displayLabel: string;
};

export type TradeRecordFilterOptions = {
  countries: TradeRecordFilterOption[];
  customsOffices: TradeRecordFilterOption[];
  transportModes: TradeRecordFilterOption[];
  ports: TradeRecordFilterOption[];
  cargoTypes: TradeRecordFilterOption[];
  logisticsParties: TradeRecordFilterOption[];
  currencies: TradeRecordFilterOption[];
  quantityUnits: TradeRecordFilterOption[];
};

const filterTableKeys = {
  countries: "chile_aduana:paises",
  customsOffices: "chile_aduana:aduanas",
  currencies: "chile_aduana:moneda",
  cargoTypes: "chile_aduana:tipos_de_carga",
  ports: "chile_aduana:puertos",
  quantityUnits: "chile_aduana:unidades_de_medida",
  transportModes: "chile_aduana:vias_de_transporte",
} as const;

type FilterOptionGroup = keyof typeof filterTableKeys;
type FilterTableKey = (typeof filterTableKeys)[FilterOptionGroup];

const groupByTableKey = Object.fromEntries(
  Object.entries(filterTableKeys).map(([group, tableKey]) => [tableKey, group]),
) as Record<FilterTableKey, FilterOptionGroup>;

function emptyOptions(): TradeRecordFilterOptions {
  return {
    countries: [],
    customsOffices: [],
    currencies: [],
    cargoTypes: [],
    logisticsParties: [],
    transportModes: [],
    ports: [],
    quantityUnits: [],
  };
}

function normalizeCode(code: string) {
  const trimmed = code.trim();
  const numeric = Number.parseInt(trimmed, 10);

  if (/^\d+$/.test(trimmed) && Number.isFinite(numeric)) {
    return String(numeric);
  }

  return trimmed;
}

export async function loadTradeRecordFilterOptions(
  db: DbClient,
  input: { logisticsPartyIds?: string[] } = {},
): Promise<TradeRecordFilterOptions> {
  const options = emptyOptions();
  const rows = await db
    .select({
      tableKey: codeTables.codeTableKey,
      codeValue: codeValues.codeValue,
      labelEs: codeValues.labelEs,
    })
    .from(codeValues)
    .innerJoin(codeTables, eq(codeValues.codeTableId, codeTables.id))
    .where(inArray(codeTables.codeTableKey, Object.values(filterTableKeys)))
    .orderBy(asc(codeTables.codeTableKey), asc(codeValues.sortOrder), asc(codeValues.labelEs));

  for (const row of rows) {
    const tableKey = row.tableKey as FilterTableKey;
    const group = groupByTableKey[tableKey];
    const value = normalizeCode(row.codeValue);
    const label = row.labelEs?.trim();

    if (!group || !value || !label) {
      continue;
    }

    options[group].push({
      value,
      label,
      displayLabel: `${value} · ${cleanPublicReferenceLabel(label)}`,
    });
  }

  const selectedLogisticsPartyIds = Array.from(
    new Set((input.logisticsPartyIds ?? []).filter(Boolean)),
  );
  const [selectedLogisticsPartyRows, logisticsPartyRows] = await Promise.all([
    Promise.all(
      selectedLogisticsPartyIds.map((id) => getLogisticsPartySearchResultById(db, id)),
    ),
    searchLogisticsParties(db, { limit: 50 }),
  ]);
  const seenLogisticsPartyIds = new Set<string>();

  for (const row of [...selectedLogisticsPartyRows, ...logisticsPartyRows]) {
    if (!row) {
      continue;
    }

    if (seenLogisticsPartyIds.has(row.id)) {
      continue;
    }

    if (row.recordCount <= 0) {
      continue;
    }

    seenLogisticsPartyIds.add(row.id);
    const displayName = canonicalTradeParticipantDisplayName(row.displayName);

    options.logisticsParties.push({
      value: row.id,
      label: displayName,
      displayLabel: `${displayName} · ${row.recordCount} registros`,
    });
  }

  return options;
}
