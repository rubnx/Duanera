import { eq, inArray } from "drizzle-orm";

import type { DbClient } from "@/db/client";
import { codeTables, codeValues } from "@/db/schema";
import { cleanPublicText } from "@/text/public-text";
import { cleanPublicReferenceLabel } from "@/text/reference-labels";

export const operationalCodeTableKeys = [
  "chile_aduana:clausulas_de_compra_venta",
  "chile_aduana:paises",
] as const;

export type OperationalCodeTableKey = (typeof operationalCodeTableKeys)[number];
export type OperationalCodeLabelMaps = Record<OperationalCodeTableKey, Map<string, string>>;

export function emptyOperationalCodeLabelMaps(): OperationalCodeLabelMaps {
  return Object.fromEntries(
    operationalCodeTableKeys.map((key) => [key, new Map<string, string>()]),
  ) as OperationalCodeLabelMaps;
}

export function normalizeOperationalCode(code: string | null | undefined) {
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

export function operationalCodeTableKeyForSourceField(
  sourceField: string,
): OperationalCodeTableKey | null {
  if (sourceField === "CL_COMPRA" || sourceField === "CLAUSULAVENTA") {
    return "chile_aduana:clausulas_de_compra_venta";
  }

  if (sourceField === "CODPAISCIA" || sourceField === "PAISCIATRANSP") {
    return "chile_aduana:paises";
  }

  return null;
}

export function isUnknownOperationalCodeSourceField(sourceField: string) {
  return (
    sourceField === "FORM_PAGO" ||
    sourceField === "FORMAPAGO" ||
    /^TPO_BUL\d+$/.test(sourceField)
  );
}

export function formatUnknownOperationalCode(value: string) {
  return `Código Aduana ${cleanPublicText(value)}`;
}

export function shouldFormatUnknownOperationalCode(value: string) {
  const clean = value.trim();
  return /^\d+$/.test(clean) || /^[A-Z0-9 .:-]{1,8}$/.test(clean);
}

export function operationalCodeLabel(
  maps: OperationalCodeLabelMaps,
  sourceField: string,
  value: string,
) {
  const tableKey = operationalCodeTableKeyForSourceField(sourceField);
  const normalizedCode = normalizeOperationalCode(value);

  if (!tableKey || !normalizedCode) {
    return null;
  }

  const label = maps[tableKey].get(normalizedCode);
  if (!label) {
    return null;
  }

  const publicLabel =
    tableKey === "chile_aduana:paises"
      ? cleanPublicReferenceLabel(label)
      : cleanPublicText(label);

  return `${normalizedCode} · ${publicLabel}`;
}

export async function loadOperationalCodeLabelMaps(
  db: DbClient,
): Promise<OperationalCodeLabelMaps> {
  const maps = emptyOperationalCodeLabelMaps();
  const rows = await db
    .select({
      tableKey: codeTables.codeTableKey,
      codeValue: codeValues.codeValue,
      labelEs: codeValues.labelEs,
    })
    .from(codeValues)
    .innerJoin(codeTables, eq(codeValues.codeTableId, codeTables.id))
    .where(inArray(codeTables.codeTableKey, [...operationalCodeTableKeys]));

  for (const row of rows) {
    const tableKey = row.tableKey as OperationalCodeTableKey;
    const normalizedCode = normalizeOperationalCode(row.codeValue);
    if (!normalizedCode || !row.labelEs || !(tableKey in maps)) {
      continue;
    }

    maps[tableKey].set(normalizedCode, row.labelEs);
  }

  return maps;
}
