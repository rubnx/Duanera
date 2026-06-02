import ExcelJS from "exceljs";
import { config } from "dotenv";
import { and, eq, ne } from "drizzle-orm";
import { pathToFileURL } from "node:url";

import type { DbClient } from "../../src/db/client";
import { assertDevDatabaseTarget } from "../../src/db/dev-guard";
import { codeTables, codeValues, sourceFiles } from "../../src/db/schema";

type SheetSeed = {
  key: string;
  sheetName: string;
  tableName: string;
  headerRow: number;
  notes: string;
};

type CodeValueSeedRow = {
  codeTableId: string;
  codeValue: string;
  labelEs: string | null;
  normalizedLabelEs: string | null;
  sortOrder: number;
  metadata: Record<string, string>;
  reviewStatus: "seeded";
};

const workbookPath =
  "data/sources/chile-aduana/aduana-cl/code-tables/working/cl_aduana_code_tables_2026_05_26.xlsx";

const sourceRawFilename = "cl_aduana_code_tables_2026_05_26_raw.xlsx";

const sheetSeeds: SheetSeed[] = [
  {
    key: "chile_aduana:aduanas",
    sheetName: "Aduanas",
    tableName: "Aduanas",
    headerRow: 4,
    notes: "Official Aduana code table workbook sheet.",
  },
  {
    key: "chile_aduana:tipos_de_operacion",
    sheetName: "Tipos de Operación",
    tableName: "Tipos de Operación",
    headerRow: 4,
    notes: "Official Aduana code table workbook sheet.",
  },
  {
    key: "chile_aduana:paises",
    sheetName: "Países",
    tableName: "Países",
    headerRow: 5,
    notes: "Official Aduana code table workbook sheet.",
  },
  {
    key: "chile_aduana:puertos",
    sheetName: "Puertos",
    tableName: "Puertos",
    headerRow: 5,
    notes: "Official Aduana code table workbook sheet.",
  },
  {
    key: "chile_aduana:tipos_de_carga",
    sheetName: "Tipos de Carga",
    tableName: "Tipos de Carga",
    headerRow: 6,
    notes: "Official Aduana code table workbook sheet.",
  },
  {
    key: "chile_aduana:vias_de_transporte",
    sheetName: "Vías de Transporte",
    tableName: "Vías de Transporte",
    headerRow: 4,
    notes: "Official Aduana code table workbook sheet.",
  },
  {
    key: "chile_aduana:regimen_de_importacion",
    sheetName: "Régimen de Importación",
    tableName: "Régimen de Importación",
    headerRow: 4,
    notes: "Official Aduana code table workbook sheet.",
  },
  {
    key: "chile_aduana:modalidades_de_venta",
    sheetName: "Modalidades de Venta",
    tableName: "Modalidades de Venta",
    headerRow: 3,
    notes: "Official Aduana code table workbook sheet.",
  },
  {
    key: "chile_aduana:regiones",
    sheetName: "Regiones",
    tableName: "Regiones",
    headerRow: 4,
    notes: "Official Aduana code table workbook sheet.",
  },
  {
    key: "chile_aduana:unidades_de_medida",
    sheetName: "Unidades de Medida",
    tableName: "Unidades de Medida",
    headerRow: 4,
    notes: "Official Aduana code table workbook sheet.",
  },
  {
    key: "chile_aduana:moneda",
    sheetName: "Moneda",
    tableName: "Moneda",
    headerRow: 5,
    notes: "Official Aduana code table workbook sheet.",
  },
  {
    key: "chile_aduana:clausulas_de_compra_venta",
    sheetName: "Cláusulas de Compra Venta",
    tableName: "Cláusulas de Compra Venta",
    headerRow: 4,
    notes: "Official Aduana code table workbook sheet.",
  },
];

function cellText(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function normalizeLabel(value: string | null): string | null {
  if (!value) {
    return null;
  }

  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueHeader(base: string, seen: Map<string, number>): string {
  const count = seen.get(base) ?? 0;
  seen.set(base, count + 1);
  return count === 0 ? base : `${base}_${count + 1}`;
}

function rowValues(row: ExcelJS.Row): unknown[] {
  const values = Array.isArray(row.values) ? row.values.slice(1) : [];
  return values;
}

function metadataFor(headers: string[], values: unknown[]): Record<string, string> {
  const metadata: Record<string, string> = {};
  headers.forEach((header, index) => {
    const value = cellText(values[index]);
    if (value !== null) {
      metadata[header] = value;
    }
  });
  return metadata;
}

export function filterSeedRowsForPreservedValues<T extends { codeValue: string }>(
  rows: T[],
  preservedCodeValues: Set<string>,
): T[] {
  return rows.filter((row) => !preservedCodeValues.has(row.codeValue));
}

async function getSourceFileId(db: DbClient): Promise<string> {
  const rows = await db
    .select({ id: sourceFiles.id })
    .from(sourceFiles)
    .where(eq(sourceFiles.normalizedRawFilename, sourceRawFilename))
    .limit(1);

  if (!rows[0]) {
    throw new Error(
      `Source file ${sourceRawFilename} is missing. Run db:seed:source-files first.`,
    );
  }

  return rows[0].id;
}

async function upsertCodeTable(db: DbClient, seed: SheetSeed, sourceFileId: string): Promise<string> {
  const values = {
    codeTableKey: seed.key,
    countryCode: "CL",
    sourceSystem: "chile_aduana",
    sourceDomain: "aduana.cl",
    tableName: seed.tableName,
    sourceSheetName: seed.sheetName,
    sourceFileId,
    reviewStatus: "seeded",
    notes: seed.notes,
  };

  const existing = await db
    .select({ id: codeTables.id })
    .from(codeTables)
    .where(eq(codeTables.codeTableKey, seed.key))
    .limit(1);

  if (existing[0]) {
    const [updated] = await db
      .update(codeTables)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(codeTables.id, existing[0].id))
      .returning({ id: codeTables.id });
    return updated.id;
  }

  const [inserted] = await db.insert(codeTables).values(values).returning({
    id: codeTables.id,
  });
  return inserted.id;
}

async function preservedCodeValueSet(db: DbClient, codeTableId: string): Promise<Set<string>> {
  const preservedRows = await db
    .select({ codeValue: codeValues.codeValue })
    .from(codeValues)
    .where(and(eq(codeValues.codeTableId, codeTableId), ne(codeValues.reviewStatus, "seeded")));

  return new Set(preservedRows.map((row) => row.codeValue));
}

export async function runCodeTableSeed(db: DbClient) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(workbookPath);
  const sourceFileId = await getSourceFileId(db);
  let tableCount = 0;
  let valueCount = 0;
  let preservedValueCount = 0;

  for (const seed of sheetSeeds) {
    const worksheet = workbook.getWorksheet(seed.sheetName);
    if (!worksheet) {
      throw new Error(`Worksheet ${seed.sheetName} not found in ${workbookPath}.`);
    }

    const headerRawValues = rowValues(worksheet.getRow(seed.headerRow));
    const firstHeaderIndex = headerRawValues.findIndex((value) => cellText(value) !== null);
    if (firstHeaderIndex < 0) {
      throw new Error(`Worksheet ${seed.sheetName} has no header row at ${seed.headerRow}.`);
    }

    const seenHeaders = new Map<string, number>();
    const headers = headerRawValues.slice(firstHeaderIndex).map((value, index) => {
      const fallback = `column_${index + 1}`;
      return uniqueHeader(cellText(value) ?? fallback, seenHeaders);
    });

    const codeTableId = await upsertCodeTable(db, seed, sourceFileId);
    const preservedCodeValues = await preservedCodeValueSet(db, codeTableId);
    await db
      .delete(codeValues)
      .where(and(eq(codeValues.codeTableId, codeTableId), eq(codeValues.reviewStatus, "seeded")));

    const workbookRows: CodeValueSeedRow[] = [];
    for (let rowNumber = seed.headerRow + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const values = rowValues(worksheet.getRow(rowNumber)).slice(firstHeaderIndex);
      const codeValue = cellText(values[0]);
      if (!codeValue) {
        continue;
      }

      const labelEs = cellText(values[1]);
      workbookRows.push({
        codeTableId,
        codeValue,
        labelEs,
        normalizedLabelEs: normalizeLabel(labelEs),
        sortOrder: rowNumber - seed.headerRow,
        metadata: metadataFor(headers, values),
        reviewStatus: "seeded",
      });
    }

    const rowsToInsert = filterSeedRowsForPreservedValues(workbookRows, preservedCodeValues);
    const skippedPreservedRows = workbookRows.length - rowsToInsert.length;

    if (rowsToInsert.length > 0) {
      await db.insert(codeValues).values(rowsToInsert);
    }

    tableCount += 1;
    valueCount += rowsToInsert.length;
    preservedValueCount += skippedPreservedRows;
    process.stdout.write(
      `Seeded ${seed.tableName}: ${rowsToInsert.length} values, preserved ${skippedPreservedRows} reviewed values.\n`,
    );
  }

  process.stdout.write(
    `Code table seed complete. Seeded ${tableCount} tables and ${valueCount} values; preserved ${preservedValueCount} reviewed values.\n`,
  );

  return { tableCount, valueCount, preservedValueCount };
}

async function main() {
  config({ path: ".env.local" });
  config();
  assertDevDatabaseTarget("code-tables seed");

  const { db } = await import("../../src/db/client");
  await runCodeTableSeed(db);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Code table seed failed: ${message}\n`);
    process.exitCode = 1;
  });
}
