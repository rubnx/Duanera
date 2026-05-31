import { asc, eq, inArray } from "drizzle-orm";

import type { DbClient } from "@/db/client";
import { codeTables, codeValues } from "@/db/schema";

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
};

const filterTableKeys = {
  countries: "chile_aduana:paises",
  customsOffices: "chile_aduana:aduanas",
  ports: "chile_aduana:puertos",
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
    transportModes: [],
    ports: [],
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
      displayLabel: `${value} · ${label}`,
    });
  }

  return options;
}
