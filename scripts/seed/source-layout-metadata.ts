import { config } from "dotenv";
import { and, eq } from "drizzle-orm";
import { pathToFileURL } from "node:url";

import type { DbClient } from "../../src/db/client";
import {
  sourceFiles,
  sourceLayoutFields,
  sourceLayouts,
} from "../../src/db/schema";
import { assertDevDatabaseTarget } from "../../src/db/dev-guard";
import {
  codeTableKeyForSourceField,
  exportCodedFields,
  exportFieldNames,
  importCodedFields,
  importFieldNames,
} from "../../src/ingest/aduana-source-layouts";

const DATA_DICTIONARY_URL =
  "https://datos.gob.cl/dataset/8e686c07-1e86-476e-87eb-d7dd243340a6/resource/792ca993-e4e4-4b83-a965-7aafca93fe2f/download/campos-de-dus-y-din-para-archivos-de-datos-abiertos-v2.0.xlsx";

const DATA_DICTIONARY_PAGE_URL =
  "https://datos.gob.cl/dataset/diccionario-de-datos-para-datos-abiertos-aduana";

type LayoutSeed = {
  countryCode: string;
  sourceSystem: string;
  sourceDomain: string;
  tradeFlow: string;
  recordRole: string;
  layoutName: string;
  layoutVersion: string;
  fieldNames: readonly string[];
  codedFields: Set<string>;
  notes: string;
};

async function upsertDictionarySourceFile(db: DbClient) {
  const values = {
    countryCode: "CL",
    sourceSystem: "chile_aduana",
    sourceDomain: "datos.gob.cl",
    sourceName: "Diccionario de Datos para Datos abiertos Aduana",
    sourcePageUrl: DATA_DICTIONARY_PAGE_URL,
    resourceDownloadUrl: DATA_DICTIONARY_URL,
    acquisitionMethod: "datos_gob_cl_ckan",
    originalFilename: "campos-de-dus-y-din-para-archivos-de-datos-abiertos-v2.0.xlsx",
    normalizedRawFilename: "cl_aduana_data_dictionary_v2_0_raw.xlsx",
    normalizedWorkingFilename: "cl_aduana_data_dictionary_v2_0.xlsx",
    fileFormat: "xlsx",
    fileRole: "reference_file",
    sourceCategory: "data_dictionary",
    processingStatus: "metadata_seeded",
  };

  const existing = await db
    .select({ id: sourceFiles.id })
    .from(sourceFiles)
    .where(eq(sourceFiles.resourceDownloadUrl, DATA_DICTIONARY_URL))
    .limit(1);

  if (existing[0]) {
    const [updated] = await db
      .update(sourceFiles)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(sourceFiles.id, existing[0].id))
      .returning({ id: sourceFiles.id });

    return updated.id;
  }

  const [inserted] = await db.insert(sourceFiles).values(values).returning({
    id: sourceFiles.id,
  });

  return inserted.id;
}

async function upsertLayout(db: DbClient, seed: LayoutSeed, dictionarySourceFileId: string) {
  const values = {
    countryCode: seed.countryCode,
    sourceSystem: seed.sourceSystem,
    sourceDomain: seed.sourceDomain,
    tradeFlow: seed.tradeFlow,
    recordRole: seed.recordRole,
    layoutName: seed.layoutName,
    layoutVersion: seed.layoutVersion,
    dictionarySourceFileId,
    fieldCount: seed.fieldNames.length,
    delimiter: ";",
    hasHeader: false,
    encoding: "latin-1-compatible",
    notes: seed.notes,
  };

  const existing = await db
    .select({ id: sourceLayouts.id })
    .from(sourceLayouts)
    .where(
      and(
        eq(sourceLayouts.sourceSystem, seed.sourceSystem),
        eq(sourceLayouts.sourceDomain, seed.sourceDomain),
        eq(sourceLayouts.tradeFlow, seed.tradeFlow),
        eq(sourceLayouts.recordRole, seed.recordRole),
        eq(sourceLayouts.layoutName, seed.layoutName),
        eq(sourceLayouts.layoutVersion, seed.layoutVersion),
      ),
    )
    .limit(1);

  if (existing[0]) {
    const [updated] = await db
      .update(sourceLayouts)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(sourceLayouts.id, existing[0].id))
      .returning({ id: sourceLayouts.id });

    return updated.id;
  }

  const [inserted] = await db.insert(sourceLayouts).values(values).returning({
    id: sourceLayouts.id,
  });

  return inserted.id;
}

async function replaceLayoutFields(db: DbClient, layoutId: string, seed: LayoutSeed) {
  await db
    .delete(sourceLayoutFields)
    .where(eq(sourceLayoutFields.sourceLayoutId, layoutId));

  await db.insert(sourceLayoutFields).values(
    seed.fieldNames.map((sourceFieldName, index) => ({
      sourceLayoutId: layoutId,
      fieldOrdinal: index + 1,
      sourceFieldName,
      isCoded: seed.codedFields.has(sourceFieldName),
      codeTableKey: seed.codedFields.has(sourceFieldName)
        ? codeTableKeyForSourceField(sourceFieldName)
        : null,
    })),
  );
}

function assertFieldCount(name: string, fields: readonly string[], expected: number) {
  if (fields.length !== expected) {
    throw new Error(`${name} expected ${expected} fields, got ${fields.length}.`);
  }
}

const layoutSeeds: LayoutSeed[] = [
  {
    countryCode: "CL",
    sourceSystem: "chile_aduana",
    sourceDomain: "datos.gob.cl",
    tradeFlow: "import",
    recordRole: "main_data",
    layoutName: "DIN main item file",
    layoutVersion: "v2.0",
    fieldNames: importFieldNames,
    codedFields: importCodedFields,
    notes:
      "Confirmed from inspected March 2026 import TXT and official dictionary titulos sheet DIN row.",
  },
  {
    countryCode: "CL",
    sourceSystem: "chile_aduana",
    sourceDomain: "datos.gob.cl",
    tradeFlow: "export",
    recordRole: "main_data",
    layoutName: "DUS main item file",
    layoutVersion: "v2.0",
    fieldNames: exportFieldNames,
    codedFields: exportCodedFields,
    notes:
      "Confirmed from inspected March 2026 export TXT and official dictionary titulos sheet DUS row.",
  },
];

assertFieldCount("DIN import layout", importFieldNames, 178);
assertFieldCount("DUS export layout", exportFieldNames, 84);

export async function runSourceLayoutMetadataSeed(db: DbClient) {
  const dictionarySourceFileId = await upsertDictionarySourceFile(db);

  for (const seed of layoutSeeds) {
    const layoutId = await upsertLayout(db, seed, dictionarySourceFileId);
    await replaceLayoutFields(db, layoutId, seed);
    process.stdout.write(
      `Seeded ${seed.tradeFlow} ${seed.recordRole} layout with ${seed.fieldNames.length} fields.\n`,
    );
  }

  process.stdout.write("Source layout metadata seed complete.\n");
}

async function main() {
  config({ path: ".env.local" });
  config();
  assertDevDatabaseTarget("source-layout-metadata seed");

  const { db } = await import("../../src/db/client");
  await runSourceLayoutMetadataSeed(db);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Source layout metadata seed failed: ${message}\n`);
    process.exitCode = 1;
  });
}
