import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { parse } from "csv-parse/sync";

import {
  parsePositiveSafeIntegerCliValue,
  requiredCliValue,
} from "../../src/lib/cli-args";
import type {
  AduanaPreflightCandidate,
  PreflightFlow,
  PreflightManifestRow,
} from "./aduana-load-preflight";

export type AduanaLoadPreflightArgs = {
  manifestFiles: string[];
  normalizedRawFilenames: string[];
  period: string | null;
  tradeFlow: PreflightFlow | null;
  workingPaths: string[];
  year: number | null;
  month: number | null;
  sampleRows: number;
  pretty: boolean;
  verifyChecksums: boolean;
};

const repoRoot = process.cwd();
const defaultManifestFiles = [
  "data/sources/chile-aduana/datos-gob-cl/manifests/cl_aduana_datos_gob_cl_2026_source_files_manifest.csv",
  "data/sources/chile-aduana/aduana-cl/manifests/cl_aduana_aduana_cl_source_files_manifest.csv",
];

function parseFlow(value: string): PreflightFlow {
  if (value !== "import" && value !== "export") {
    throw new Error(`--trade-flow must be import or export, got ${value}.`);
  }

  return value;
}

function parsePeriod(value: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) {
    throw new Error(`--period must use YYYY-MM format, got ${value}.`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) {
    throw new Error(`--period month must be between 01 and 12, got ${value}.`);
  }

  return { year, month, period: value };
}

export function parseAduanaLoadPreflightArgs(
  argv: string[],
): AduanaLoadPreflightArgs {
  const args: AduanaLoadPreflightArgs = {
    manifestFiles: [...defaultManifestFiles],
    normalizedRawFilenames: [],
    period: null,
    tradeFlow: null,
    workingPaths: [],
    year: null,
    month: null,
    sampleRows: 50,
    pretty: false,
    verifyChecksums: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--pretty") {
      args.pretty = true;
      continue;
    }
    if (arg === "--skip-checksums") {
      args.verifyChecksums = false;
      continue;
    }
    if (arg === "--manifest-file") {
      args.manifestFiles.push(requiredCliValue(argv, index, arg));
      index += 1;
      continue;
    }
    if (arg === "--normalized-raw-filename") {
      args.normalizedRawFilenames.push(requiredCliValue(argv, index, arg));
      index += 1;
      continue;
    }
    if (arg === "--working-path") {
      args.workingPaths.push(requiredCliValue(argv, index, arg));
      index += 1;
      continue;
    }
    if (arg === "--trade-flow") {
      args.tradeFlow = parseFlow(requiredCliValue(argv, index, arg));
      index += 1;
      continue;
    }
    if (arg === "--period") {
      const parsed = parsePeriod(requiredCliValue(argv, index, arg));
      args.period = parsed.period;
      args.year = parsed.year;
      args.month = parsed.month;
      index += 1;
      continue;
    }
    if (arg === "--sample-rows") {
      args.sampleRows = parsePositiveSafeIntegerCliValue(
        requiredCliValue(argv, index, arg),
        arg,
      );
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function repoRelativePath(absolutePath: string): string {
  const resolvedPath = path.resolve(absolutePath);
  const relativePath = path.relative(repoRoot, resolvedPath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`${absolutePath}: preflight path must stay inside the repository.`);
  }

  return relativePath.split(path.sep).join("/");
}

export function resolvePreflightDataPath(value: string): string {
  const absolutePath = path.resolve(repoRoot, value);
  const relativePath = repoRelativePath(absolutePath);
  if (relativePath !== "data" && !relativePath.startsWith("data/")) {
    throw new Error(`${value}: preflight path must be inside the ignored data/ archive.`);
  }

  return absolutePath;
}

function splitPaths(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(/[|;]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function optionalString(value: string | undefined): string | null {
  if (!value || value === "unknown") {
    return null;
  }

  return value;
}

function optionalInteger(value: string | undefined, fieldName: string): number | null {
  const normalized = optionalString(value);
  if (!normalized) {
    return null;
  }
  if (!/^\d+$/.test(normalized)) {
    throw new Error(`${fieldName} must be an integer, got ${value}.`);
  }

  return Number(normalized);
}

function firstPath(value: string | undefined): string | null {
  return splitPaths(value)[0] ?? null;
}

function firstValue(value: string | undefined): string | null {
  return splitPaths(value)[0] ?? optionalString(value);
}

function parseManifestRows(content: string, manifestPath: string): PreflightManifestRow[] {
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

export function isMainAduanaDataManifestRow(row: PreflightManifestRow): boolean {
  const filename = row.normalized_raw_filename ?? "";
  const workingFormat = row.working_file_formats ?? "";
  return (
    (row.trade_flow === "import" || row.trade_flow === "export") &&
    row.source_category === "dataset_resource" &&
    Boolean(row.year) &&
    Boolean(row.month) &&
    Boolean(row.working_paths) &&
    workingFormat.includes("txt") &&
    /^cl_aduana_(imports|exports)_\d{4}_\d{2}_raw\.(rar|zip)$/i.test(filename)
  );
}

function inferFlowFromPath(value: string): PreflightFlow | null {
  if (/imports?/i.test(value)) {
    return "import";
  }
  if (/exports?/i.test(value)) {
    return "export";
  }

  return null;
}

export function candidateFromManifestRow(
  row: PreflightManifestRow,
  manifestPath: string,
): AduanaPreflightCandidate {
  const workingPath = firstPath(row.working_paths);
  if (!workingPath) {
    throw new Error(`${row.normalized_raw_filename ?? "manifest row"}: missing working_paths.`);
  }

  const flow = row.trade_flow === "import" || row.trade_flow === "export"
    ? row.trade_flow
    : inferFlowFromPath(`${row.normalized_raw_filename ?? ""} ${workingPath}`);
  if (!flow) {
    throw new Error(`${row.normalized_raw_filename ?? workingPath}: cannot infer import/export flow.`);
  }

  return {
    source: "manifest",
    manifestPath,
    sourceDomain: optionalString(row.source_domain),
    sourceCategory: optionalString(row.source_category),
    country: optionalString(row.country),
    tradeFlow: flow,
    year: optionalInteger(row.year, "year"),
    month: optionalInteger(row.month, "month"),
    period: optionalString(row.period),
    normalizedRawFilename: optionalString(row.normalized_raw_filename),
    rawPath: optionalString(row.raw_path),
    rawFileRole: optionalString(row.raw_file_role),
    rawFileSize: optionalInteger(row.raw_file_size, "raw_file_size"),
    rawChecksumSha256: optionalString(row.raw_checksum_sha256),
    workingPath,
    workingFileFormat: firstValue(row.working_file_formats),
    workingFileSize: optionalInteger(firstValue(row.working_file_sizes) ?? undefined, "working_file_sizes"),
    workingChecksumSha256: firstValue(row.working_checksum_sha256) ?? null,
  };
}

export function candidateFromWorkingPath(
  args: AduanaLoadPreflightArgs,
  workingPath: string,
): AduanaPreflightCandidate {
  const flow = args.tradeFlow ?? inferFlowFromPath(workingPath);
  if (!flow) {
    throw new Error(`${workingPath}: --trade-flow is required when flow cannot be inferred.`);
  }

  return {
    source: "working_path",
    manifestPath: null,
    sourceDomain: null,
    sourceCategory: null,
    country: "CL",
    tradeFlow: flow,
    year: args.year,
    month: args.month,
    period: args.period,
    normalizedRawFilename: null,
    rawPath: null,
    rawFileRole: null,
    rawFileSize: null,
    rawChecksumSha256: null,
    workingPath,
    workingFileFormat: path.extname(workingPath).replace(".", "") || null,
    workingFileSize: null,
    workingChecksumSha256: null,
  };
}

export function loadManifestCandidates(
  args: AduanaLoadPreflightArgs,
): AduanaPreflightCandidate[] {
  const candidates: AduanaPreflightCandidate[] = [];
  const filenameFilter = new Set(args.normalizedRawFilenames);

  for (const manifestFile of args.manifestFiles) {
    const manifestPath = resolvePreflightDataPath(manifestFile);
    if (!existsSync(manifestPath)) {
      continue;
    }

    const rows = parseManifestRows(readFileSync(manifestPath, "utf8"), repoRelativePath(manifestPath));
    for (const row of rows) {
      const selectedByFilename =
        filenameFilter.size > 0 && filenameFilter.has(row.normalized_raw_filename ?? "");
      const selectedByFilters =
        filenameFilter.size === 0 &&
        isMainAduanaDataManifestRow(row) &&
        (!args.tradeFlow || row.trade_flow === args.tradeFlow) &&
        (!args.period || row.period === args.period);

      if (!selectedByFilename && !selectedByFilters) {
        continue;
      }

      candidates.push(candidateFromManifestRow(row, repoRelativePath(manifestPath)));
    }
  }

  return candidates;
}
