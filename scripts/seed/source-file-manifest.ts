import { readFile } from "node:fs/promises";

import { parse } from "csv-parse/sync";
import { config } from "dotenv";
import { eq } from "drizzle-orm";

import { assertDevDatabaseTarget } from "../../src/db/dev-guard";
import { sourceFiles } from "../../src/db/schema";

config({ path: ".env.local" });
config();
assertDevDatabaseTarget("source-file-manifest seed");

const { db } = await import("../../src/db/client");

type ManifestRow = {
  source_domain: string;
  source_page_url: string;
  resource_download_url: string;
  country: string;
  trade_flow: string;
  source_category: string;
  year: string;
  month: string;
  period: string;
  original_filename: string;
  normalized_raw_filename: string;
  raw_path: string;
  raw_file_role: string;
  raw_file_format: string;
  raw_file_size: string;
  raw_checksum_sha256: string;
  normalized_working_filenames: string;
  working_paths: string;
  working_file_formats: string;
  downloaded_at: string;
  notes: string;
};

const manifestPaths = [
  "data/sources/chile-aduana/datos-gob-cl/manifests/cl_aduana_datos_gob_cl_2026_source_files_manifest.csv",
  "data/sources/chile-aduana/aduana-cl/manifests/cl_aduana_aduana_cl_source_files_manifest.csv",
];

const selectedRawFilenames = new Set([
  "cl_aduana_imports_2026_03_raw.rar",
  "cl_aduana_exports_2026_03_raw.rar",
  "cl_aduana_code_tables_2026_05_26_raw.xlsx",
]);

function nullable(value: string | undefined): string | null {
  if (!value || value === "unknown") {
    return null;
  }

  return value;
}

function parseInteger(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function periodDate(year: number | null, month: number | null, boundary: "start" | "end") {
  if (!year) {
    return null;
  }

  if (!month) {
    return boundary === "start" ? `${year}-01-01` : `${year}-12-31`;
  }

  const paddedMonth = String(month).padStart(2, "0");
  if (boundary === "start") {
    return `${year}-${paddedMonth}-01`;
  }

  const end = new Date(Date.UTC(year, month, 0));
  return `${year}-${paddedMonth}-${String(end.getUTCDate()).padStart(2, "0")}`;
}

async function readManifest(path: string): Promise<ManifestRow[]> {
  const input = await readFile(path, "utf8");
  return parse(input, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
  }) as ManifestRow[];
}

async function upsertSourceFile(row: ManifestRow): Promise<"inserted" | "updated"> {
  const year = parseInteger(row.year);
  const month = parseInteger(row.month);
  const values = {
    countryCode: row.country,
    sourceSystem: "chile_aduana",
    sourceDomain: row.source_domain,
    sourcePageUrl: nullable(row.source_page_url),
    resourceDownloadUrl: nullable(row.resource_download_url),
    acquisitionMethod: row.source_domain === "datos.gob.cl" ? "datos_gob_cl_ckan" : "aduana_cl_manual_archive",
    originalFilename: row.original_filename,
    normalizedRawFilename: row.normalized_raw_filename,
    normalizedWorkingFilename: nullable(row.normalized_working_filenames),
    storageKey: row.raw_path,
    workingStorageKey: nullable(row.working_paths),
    fileHashSha256: nullable(row.raw_checksum_sha256),
    fileSizeBytes: parseInteger(row.raw_file_size),
    fileFormat: nullable(row.raw_file_format),
    fileRole: row.raw_file_role,
    tradeFlow: nullable(row.trade_flow),
    sourceCategory: nullable(row.source_category),
    periodYear: year,
    periodMonth: month,
    periodStart: periodDate(year, month, "start"),
    periodEnd: periodDate(year, month, "end"),
    processingStatus: "metadata_seeded",
  };

  const existing = await db
    .select({ id: sourceFiles.id })
    .from(sourceFiles)
    .where(eq(sourceFiles.normalizedRawFilename, row.normalized_raw_filename))
    .limit(1);

  if (existing[0]) {
    await db
      .update(sourceFiles)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(sourceFiles.id, existing[0].id));
    return "updated";
  }

  await db.insert(sourceFiles).values(values);
  return "inserted";
}

let inserted = 0;
let updated = 0;

for (const manifestPath of manifestPaths) {
  const rows = await readManifest(manifestPath);
  for (const row of rows) {
    if (!selectedRawFilenames.has(row.normalized_raw_filename)) {
      continue;
    }

    const result = await upsertSourceFile(row);
    if (result === "inserted") {
      inserted += 1;
    } else {
      updated += 1;
    }
  }
}

console.log(`Source file manifest seed complete. Inserted ${inserted}, updated ${updated}.`);
