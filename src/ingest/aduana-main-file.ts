import { createHash } from "node:crypto";

import { parse } from "csv-parse/sync";
import iconv from "iconv-lite";

export type ParsedAduanaRow = {
  rowNumber: number;
  rawText: string;
  fieldCount: number;
  rawValues: Record<string, string>;
  rowHashSha256: string;
  parseErrors: string[];
};

export function decodeAduanaBuffer(buffer: Buffer): string {
  return iconv.decode(buffer, "win1252");
}

export function rowHashSha256(rawText: string): string {
  return createHash("sha256").update(rawText, "utf8").digest("hex");
}

function csvStringRows(value: unknown): string[][] {
  if (!Array.isArray(value)) {
    throw new Error("Aduana parser returned a non-array CSV result.");
  }

  return value.map((row, rowIndex) => {
    if (!Array.isArray(row)) {
      throw new Error(`Aduana parser returned a non-array row at index ${rowIndex}.`);
    }

    return row.map((field, fieldIndex) => {
      if (typeof field !== "string") {
        throw new Error(
          `Aduana parser returned a non-string field at row ${rowIndex}, field ${fieldIndex}.`,
        );
      }

      return field;
    });
  });
}

export function parseDelimitedLine(rawText: string): string[] {
  const parsed: unknown = parse(rawText, {
    delimiter: ";",
    quote: false,
    relax_column_count: true,
    bom: false,
    trim: false,
  });
  const rows = csvStringRows(parsed);

  return rows[0] ?? [];
}

export function parseAduanaRow(
  rawText: string,
  rowNumber: number,
  fieldNames: readonly string[],
): ParsedAduanaRow {
  const values = parseDelimitedLine(rawText);
  const parseErrors: string[] = [];

  if (values.length !== fieldNames.length) {
    parseErrors.push(
      `Expected ${fieldNames.length} fields, got ${values.length} fields.`,
    );
  }

  const rawValues: Record<string, string> = {};
  for (const [index, fieldName] of fieldNames.entries()) {
    rawValues[fieldName] = values[index] ?? "";
  }

  return {
    rowNumber,
    rawText,
    fieldCount: values.length,
    rawValues,
    rowHashSha256: rowHashSha256(rawText),
    parseErrors,
  };
}

export function parseDecimalComma(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.replace(/\./g, "").replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isNaN(parsed) ? null : parsed;
}

export function parseAduanaDate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!/^\d{8}$/.test(trimmed) || trimmed === "00000000") {
    return null;
  }

  const day = trimmed.slice(0, 2);
  const month = trimmed.slice(2, 4);
  const year = trimmed.slice(4, 8);

  const date = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== Number.parseInt(year, 10) ||
    date.getUTCMonth() + 1 !== Number.parseInt(month, 10) ||
    date.getUTCDate() !== Number.parseInt(day, 10)
  ) {
    return null;
  }

  return `${year}-${month}-${day}`;
}

export function normalizeHsCode(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const digits = value.replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
}
