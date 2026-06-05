import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { parse } from "csv-parse/sync";
import { config } from "dotenv";
import { eq } from "drizzle-orm";

import type { DbClient } from "../../src/db/client";
import { assertDevDatabaseTarget } from "../../src/db/dev-guard";
import { sourceFiles } from "../../src/db/schema";

export type ManifestRow = {
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
  "data/sources/chile-aduana/datos-gob-cl/manifests/cl_aduana_datos_gob_cl_historical_source_files_manifest.csv",
  "data/sources/chile-aduana/aduana-cl/manifests/cl_aduana_aduana_cl_source_files_manifest.csv",
];

const defaultSelectedRawFilenames = [
  "cl_aduana_imports_2026_03_raw.rar",
  "cl_aduana_exports_2026_03_raw.rar",
  "cl_aduana_code_tables_2026_05_26_raw.xlsx",
];

export function selectedRawFilenamesFromEnv(value = process.env.SOURCE_FILE_MANIFEST_RAW_FILENAMES) {
  if (!value?.trim()) {
    return new Set(defaultSelectedRawFilenames);
  }

  const filenames = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (filenames.length === 0) {
    throw new Error("SOURCE_FILE_MANIFEST_RAW_FILENAMES must include at least one filename.");
  }

  return new Set(filenames);
}

function nullable(value: string | undefined): string | null {
  if (!value || value === "unknown") {
    return null;
  }

  return value;
}

export function parseManifestInteger({
  fieldName,
  value,
}: {
  fieldName: string;
  value: string | undefined;
}): number | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed === "unknown") {
    return null;
  }

  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`${fieldName} must be an integer, got ${value}.`);
  }

  return Number.parseInt(trimmed, 10);
}

export function parseManifestMonth(value: string | undefined): number | null {
  const month = parseManifestInteger({ fieldName: "month", value });
  if (month !== null && (month < 1 || month > 12)) {
    throw new Error(`month must be between 1 and 12, got ${value}.`);
  }

  return month;
}

export function periodDate(year: number | null, month: number | null, boundary: "start" | "end") {
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

function manifestColumnValue(
  entries: Record<string, unknown>,
  rowIndex: number,
  column: keyof ManifestRow,
): string {
  const value = entries[column];
  if (typeof value !== "string") {
    throw new Error(`Source manifest row ${rowIndex} is missing string column ${column}.`);
  }

  return value;
}

function manifestRow(value: unknown, rowIndex: number): ManifestRow {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Source manifest row ${rowIndex} must be an object.`);
  }

  const entries = Object.fromEntries(Object.entries(value));
  return {
    source_domain: manifestColumnValue(entries, rowIndex, "source_domain"),
    source_page_url: manifestColumnValue(entries, rowIndex, "source_page_url"),
    resource_download_url: manifestColumnValue(entries, rowIndex, "resource_download_url"),
    country: manifestColumnValue(entries, rowIndex, "country"),
    trade_flow: manifestColumnValue(entries, rowIndex, "trade_flow"),
    source_category: manifestColumnValue(entries, rowIndex, "source_category"),
    year: manifestColumnValue(entries, rowIndex, "year"),
    month: manifestColumnValue(entries, rowIndex, "month"),
    period: manifestColumnValue(entries, rowIndex, "period"),
    original_filename: manifestColumnValue(entries, rowIndex, "original_filename"),
    normalized_raw_filename: manifestColumnValue(entries, rowIndex, "normalized_raw_filename"),
    raw_path: manifestColumnValue(entries, rowIndex, "raw_path"),
    raw_file_role: manifestColumnValue(entries, rowIndex, "raw_file_role"),
    raw_file_format: manifestColumnValue(entries, rowIndex, "raw_file_format"),
    raw_file_size: manifestColumnValue(entries, rowIndex, "raw_file_size"),
    raw_checksum_sha256: manifestColumnValue(entries, rowIndex, "raw_checksum_sha256"),
    normalized_working_filenames: manifestColumnValue(entries, rowIndex, "normalized_working_filenames"),
    working_paths: manifestColumnValue(entries, rowIndex, "working_paths"),
    working_file_formats: manifestColumnValue(entries, rowIndex, "working_file_formats"),
    downloaded_at: manifestColumnValue(entries, rowIndex, "downloaded_at"),
    notes: manifestColumnValue(entries, rowIndex, "notes"),
  };
}

export function parseSourceFileManifest(input: string): ManifestRow[] {
  const parsed: unknown = parse(input, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
  });

  if (!Array.isArray(parsed)) {
    throw new Error("Source manifest parser returned a non-array CSV result.");
  }

  return parsed.map((row, rowIndex) => manifestRow(row, rowIndex));
}

async function readManifest(path: string): Promise<ManifestRow[]> {
  const input = await readFile(path, "utf8");
  return parseSourceFileManifest(input);
}

async function upsertSourceFile(
  db: DbClient,
  row: ManifestRow,
): Promise<"inserted" | "updated"> {
  const year = parseManifestInteger({ fieldName: "year", value: row.year });
  const month = parseManifestMonth(row.month);
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
    fileSizeBytes: parseManifestInteger({
      fieldName: "raw_file_size",
      value: row.raw_file_size,
    }),
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

export async function runSourceFileManifestSeed(db: DbClient) {
  let inserted = 0;
  let updated = 0;
  const selectedRawFilenames = selectedRawFilenamesFromEnv();

  for (const manifestPath of manifestPaths) {
    const rows = await readManifest(manifestPath);
    for (const row of rows) {
      if (!selectedRawFilenames.has(row.normalized_raw_filename)) {
        continue;
      }

      const result = await upsertSourceFile(db, row);
      if (result === "inserted") {
        inserted += 1;
      } else {
        updated += 1;
      }
    }
  }

  process.stdout.write(`Source file manifest seed complete. Inserted ${inserted}, updated ${updated}.\n`);
  return { inserted, updated };
}

async function main() {
  config({ path: ".env.local" });
  config();
  assertDevDatabaseTarget("source-file-manifest seed");

  const { db } = await import("../../src/db/client");
  await runSourceFileManifestSeed(db);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Source file manifest seed failed: ${message}\n`);
    process.exitCode = 1;
  });
}
