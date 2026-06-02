import { parse } from "csv-parse/sync";

import type { PreflightManifestRow } from "./aduana-load-preflight";

export function splitManifestPaths(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(/[|;]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function parsePreflightManifestRows(
  content: string,
  manifestPath: string,
): PreflightManifestRow[] {
  const parsed: unknown = parse(content, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
  });

  if (!Array.isArray(parsed)) {
    throw new Error(`${manifestPath}: manifest parser returned a non-array CSV result.`);
  }

  return parsed.map((row, index) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      throw new Error(`${manifestPath}: manifest row ${index} must be an object.`);
    }

    const result: PreflightManifestRow = {};
    for (const [key, value] of Object.entries(row)) {
      if (typeof value !== "string") {
        throw new Error(`${manifestPath}: manifest row ${index} has non-string column ${key}.`);
      }
      result[key] = value;
    }

    return result;
  });
}
