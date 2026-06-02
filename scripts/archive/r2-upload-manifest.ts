import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";

import type { ArchiveManifestReference } from "./r2-upload-policy";

export type SourceManifestRow = Record<string, string | undefined>;

type ManifestPathContext = {
  repoRelativePath: (absolutePath: string) => string;
  walkFiles: (root: string) => string[];
};

function sourceManifestRow(
  value: unknown,
  rowIndex: number,
  sourceManifestPath: string,
): SourceManifestRow {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${sourceManifestPath}: manifest row ${rowIndex} must be an object.`);
  }

  const row: SourceManifestRow = { __sourceManifestPath: sourceManifestPath };
  for (const [key, cell] of Object.entries(value)) {
    if (typeof cell !== "string") {
      throw new Error(`${sourceManifestPath}: manifest row ${rowIndex} has non-string column ${key}.`);
    }

    row[key] = cell;
  }

  return row;
}

export function parseArchiveSourceManifestRows(
  content: string,
  sourceManifestPath: string,
): SourceManifestRow[] {
  const parsed: unknown = parse(content, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
  });

  if (!Array.isArray(parsed)) {
    throw new Error(`${sourceManifestPath}: manifest parser returned a non-array CSV result.`);
  }

  return parsed.map((row, rowIndex) => sourceManifestRow(row, rowIndex, sourceManifestPath));
}

export function readSourceManifestRows(
  dataDir: string,
  context: ManifestPathContext,
): SourceManifestRow[] {
  const sourceRoot = path.join(dataDir, "sources", "chile-aduana");
  const rows: SourceManifestRow[] = [];

  for (const filePath of context.walkFiles(sourceRoot)) {
    const relativePath = context.repoRelativePath(filePath);
    if (!relativePath.includes("/manifests/") || !relativePath.endsWith(".csv")) {
      continue;
    }
    if (!path.basename(filePath).includes("manifest")) {
      continue;
    }

    const content = readFileSync(filePath, "utf8");
    rows.push(...parseArchiveSourceManifestRows(content, relativePath));
  }

  return rows;
}

function splitManifestPaths(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(/[|;]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function buildManifestReferences(
  rows: SourceManifestRow[],
): Map<string, ArchiveManifestReference> {
  const references = new Map<string, ArchiveManifestReference>();

  for (const row of rows) {
    const sourceManifestPath = row.__sourceManifestPath;
    if (!sourceManifestPath) {
      continue;
    }

    const common = {
      country: row.country || undefined,
      sourceCategory: row.source_category || undefined,
      sourceDomain: row.source_domain || undefined,
      sourceManifestPath,
      tradeFlow: row.trade_flow || undefined,
      period: row.period || undefined,
    };

    if (row.raw_path) {
      references.set(row.raw_path, {
        ...common,
        fileRole: row.raw_file_role || undefined,
        checksumSha256: row.raw_checksum_sha256 || undefined,
      });
    }

    const workingPaths = splitManifestPaths(row.working_paths);
    const workingChecksums = splitManifestPaths(row.working_checksum_sha256);
    workingPaths.forEach((workingPath, index) => {
      references.set(workingPath, {
        ...common,
        fileRole: "working_file",
        checksumSha256: workingChecksums[index] ?? row.working_checksum_sha256 ?? undefined,
      });
    });
  }

  return references;
}
