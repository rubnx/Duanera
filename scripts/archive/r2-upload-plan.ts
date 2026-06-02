import { createHash } from "node:crypto";
import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parse } from "csv-parse/sync";

import { requiredCliValue } from "../../src/lib/cli-args";

type SourceManifestRow = Record<string, string | undefined>;

type ManifestReference = {
  country?: string;
  sourceCategory?: string;
  sourceDomain?: string;
  sourceManifestPath: string;
  tradeFlow?: string;
  period?: string;
  fileRole?: string;
  checksumSha256?: string;
};

type UploadCandidate = {
  localPath: string;
  r2Bucket: string;
  r2Key: string | null;
  classification: string;
  sourceKind: string;
  fileRole: string;
  sourceDomain: string | null;
  country: string | null;
  tradeFlow: string | null;
  period: string | null;
  sizeBytes: number;
  sha256: string;
  sourceManifestPath: string | null;
  manifestSha256: string | null;
  checksumMatchesManifest: boolean | null;
  includeInUpload: boolean;
  exclusionReason: string | null;
  metadata: Record<string, string>;
};

type Summary = {
  totalFiles: number;
  uploadCandidates: number;
  excludedFiles: number;
  totalBytes: number;
  uploadBytes: number;
  byClassification: Record<string, { files: number; bytes: number }>;
};

type Args = {
  bucket: string;
  dataDir: string;
  pretty: boolean;
};

const defaultBucket = "duanera-source-archive";
const repoRoot = process.cwd();

function parseArgs(argv: string[]): Args {
  const args: Args = {
    bucket: defaultBucket,
    dataDir: "data",
    pretty: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--pretty") {
      args.pretty = true;
      continue;
    }

    if (arg === "--bucket") {
      args.bucket = requiredCliValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--data-dir") {
      args.dataDir = requiredCliValue(argv, index, arg);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function toPosix(value: string) {
  return value.split(path.sep).join("/");
}

export function repoRelativePath(absolutePath: string): string {
  const resolvedPath = path.resolve(absolutePath);
  const relativePath = path.relative(repoRoot, resolvedPath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`${absolutePath}: archive planner path must stay inside the repository.`);
  }

  return toPosix(relativePath);
}

export function resolveArchiveDataDirPath(dataDir: string): string {
  const absolutePath = path.resolve(repoRoot, dataDir);
  const relativePath = repoRelativePath(absolutePath);

  if (relativePath !== "data" && !relativePath.startsWith("data/")) {
    throw new Error(`${dataDir}: archive planner data directory must be inside the ignored data/ archive.`);
  }

  return absolutePath;
}

function assertArchiveDataDirExists(dataDir: string): void {
  if (!existsSync(dataDir) || !statSync(dataDir).isDirectory()) {
    throw new Error(`${dataDir}: archive planner data directory does not exist.`);
  }
}

function walkFiles(root: string): string[] {
  const files: string[] = [];

  function walk(current: string) {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }

  walk(root);
  return files.sort();
}

function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

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

function readSourceManifestRows(dataDir: string): SourceManifestRow[] {
  const sourceRoot = path.join(dataDir, "sources", "chile-aduana");
  const rows: SourceManifestRow[] = [];

  for (const filePath of walkFiles(sourceRoot)) {
    const relativePath = repoRelativePath(filePath);
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

function buildManifestReferences(rows: SourceManifestRow[]): Map<string, ManifestReference> {
  const references = new Map<string, ManifestReference>();

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

function classify(relativePath: string): string {
  const basename = path.posix.basename(relativePath);
  if (basename === ".DS_Store" || basename.endsWith(".download")) {
    return "disposable";
  }

  if (relativePath.includes("/manifests/") || relativePath === "data/sources/chile-aduana/README.md") {
    return "source_manifest";
  }

  if (relativePath.startsWith("data/research/chile-aduana-identity-validation/")) {
    return "generated_validation";
  }

  if (relativePath.startsWith("data/research/")) {
    return "research_evidence";
  }

  if (relativePath.includes("/raw/")) {
    return "official_source_raw";
  }

  if (relativePath.includes("/working/")) {
    return "working_file";
  }

  return "unknown";
}

function sourceDomainFor(relativePath: string, reference?: ManifestReference) {
  if (reference?.sourceDomain) {
    return reference.sourceDomain;
  }
  if (relativePath.includes("/datos-gob-cl/")) {
    return "datos.gob.cl";
  }
  if (relativePath.includes("/aduana-cl/")) {
    return "aduana.cl";
  }
  return null;
}

function tradeFlowFor(relativePath: string, reference?: ManifestReference) {
  if (reference?.tradeFlow) {
    return reference.tradeFlow;
  }
  if (relativePath.includes("/imports/")) {
    return "import";
  }
  if (relativePath.includes("/exports/")) {
    return "export";
  }
  if (relativePath.includes("/references/") || relativePath.includes("/code-tables/")) {
    return "reference";
  }
  return null;
}

function sourceKindFor(classification: string, relativePath: string) {
  if (classification === "generated_validation") {
    return "generated_validation";
  }
  if (classification === "research_evidence") {
    return "research_evidence";
  }
  if (classification === "disposable") {
    return "disposable";
  }
  if (relativePath.startsWith("data/sources/")) {
    return "official_source";
  }
  return "unknown";
}

function fileRoleFor(classification: string, reference?: ManifestReference) {
  if (reference?.fileRole) {
    return reference.fileRole;
  }

  const roles: Record<string, string> = {
    disposable: "disposable",
    generated_validation: "generated_validation",
    official_source_raw: "official_source_file",
    research_evidence: "research_evidence",
    source_manifest: "source_manifest",
    unknown: "unknown",
    working_file: "working_file",
  };

  return roles[classification] ?? "unknown";
}

function periodFor(relativePath: string, reference?: ManifestReference) {
  if (reference?.period) {
    return reference.period;
  }

  const monthMatch = /_(\d{4})_(\d{2})(?:_|\.|$)/.exec(relativePath);
  if (monthMatch) {
    return `${monthMatch[1]}-${monthMatch[2]}`;
  }

  const yearMatch = /_(\d{4})(?:_|\.|$)/.exec(relativePath);
  return yearMatch?.[1] ?? null;
}

function periodKey(period: string | null) {
  if (!period) {
    return "undated";
  }

  const monthMatch = /^(\d{4})-(\d{2})$/.exec(period);
  if (monthMatch) {
    return `${monthMatch[1]}/${monthMatch[2]}`;
  }

  return period;
}

function sourceGroup(relativePath: string) {
  if (relativePath.includes("/imports/")) {
    return "imports";
  }
  if (relativePath.includes("/exports/")) {
    return "exports";
  }
  if (relativePath.includes("/code-tables/")) {
    return "code-tables";
  }
  if (relativePath.includes("/references/")) {
    return "references";
  }
  return "misc";
}

function roleDirectory(relativePath: string, classification: string) {
  if (relativePath.includes("/raw/")) {
    return "raw";
  }
  if (relativePath.includes("/working/")) {
    return "working";
  }
  return classification;
}

function r2KeyFor(relativePath: string, classification: string, reference?: ManifestReference) {
  const basename = path.posix.basename(relativePath);
  const sourceDomain = sourceDomainFor(relativePath, reference)?.replaceAll(".", "-");
  const period = periodFor(relativePath, reference);

  if (classification === "disposable") {
    return null;
  }

  if (classification === "source_manifest") {
    if (sourceDomain) {
      return `manifests/cl/aduana/${sourceDomain}/${basename}`;
    }
    return `manifests/cl/aduana/${basename}`;
  }

  if (relativePath.startsWith("data/sources/chile-aduana/")) {
    const domainSegment = sourceDomain ?? "unknown-source";
    return [
      "sources",
      "cl",
      "aduana",
      domainSegment,
      sourceGroup(relativePath),
      periodKey(period),
      roleDirectory(relativePath, classification),
      basename,
    ].join("/");
  }

  if (classification === "generated_validation") {
    const suffix = relativePath.replace("data/research/chile-aduana-identity-validation/", "");
    return `research/cl/aduana/identity-validation/${suffix}`;
  }

  if (classification === "research_evidence") {
    const suffix = relativePath.replace("data/research/", "");
    return `research/cl/aduana/${suffix}`;
  }

  return `unclassified/${relativePath.replace(/^data\//, "")}`;
}

function r2MetadataFor(candidate: Omit<UploadCandidate, "metadata">): Record<string, string> {
  const metadata: Record<string, string> = {
    file_role: candidate.fileRole,
    sha256: candidate.sha256,
    source_kind: candidate.sourceKind,
  };

  if (candidate.country) {
    metadata.country = candidate.country;
  }
  if (candidate.sourceDomain) {
    metadata.source_domain = candidate.sourceDomain;
  }
  if (candidate.tradeFlow) {
    metadata.trade_flow = candidate.tradeFlow;
  }
  if (candidate.period) {
    metadata.period = candidate.period;
  }
  if (candidate.sourceManifestPath) {
    metadata.manifest_local_path = candidate.sourceManifestPath;
  }

  return metadata;
}

async function buildCandidate(
  absolutePath: string,
  bucket: string,
  references: Map<string, ManifestReference>,
): Promise<UploadCandidate> {
  const localPath = repoRelativePath(absolutePath);
  const classification = classify(localPath);
  const reference = references.get(localPath);
  const sizeBytes = statSync(absolutePath).size;
  const sha256 = await sha256File(absolutePath);
  const manifestSha256 = reference?.checksumSha256 ?? null;
  const checksumMatchesManifest = manifestSha256 ? manifestSha256 === sha256 : null;
  const sourceKind = sourceKindFor(classification, localPath);
  const fileRole = fileRoleFor(classification, reference);
  const r2Key = r2KeyFor(localPath, classification, reference);
  const includeInUpload = classification !== "disposable";
  const baseCandidate = {
    localPath,
    r2Bucket: bucket,
    r2Key,
    classification,
    sourceKind,
    fileRole,
    sourceDomain: sourceDomainFor(localPath, reference),
    country: reference?.country ?? (localPath.includes("chile-aduana") ? "CL" : null),
    tradeFlow: tradeFlowFor(localPath, reference),
    period: periodFor(localPath, reference),
    sizeBytes,
    sha256,
    sourceManifestPath: reference?.sourceManifestPath ?? null,
    manifestSha256,
    checksumMatchesManifest,
    includeInUpload,
    exclusionReason: includeInUpload ? null : "Disposable local file.",
  };

  return {
    ...baseCandidate,
    metadata: r2MetadataFor(baseCandidate),
  };
}

function validateCandidates(candidates: UploadCandidate[]) {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const candidate of candidates) {
    if (candidate.classification === "official_source_raw") {
      if (!candidate.sourceManifestPath) {
        errors.push(`${candidate.localPath}: official raw file is missing a source manifest reference.`);
      }
      if (!candidate.manifestSha256) {
        errors.push(`${candidate.localPath}: official raw file is missing a manifest SHA-256.`);
      }
      if (!candidate.fileRole || candidate.fileRole === "unknown") {
        errors.push(`${candidate.localPath}: official raw file is missing a file role.`);
      }
      if (!candidate.r2Key) {
        errors.push(`${candidate.localPath}: official raw file has no proposed R2 key.`);
      }
      if (candidate.checksumMatchesManifest === false) {
        errors.push(`${candidate.localPath}: computed SHA-256 does not match source manifest.`);
      }
    }

    if (candidate.classification === "working_file" && candidate.checksumMatchesManifest === false) {
      warnings.push(`${candidate.localPath}: computed SHA-256 does not match working checksum in source manifest.`);
    }

    if (candidate.classification === "unknown") {
      warnings.push(`${candidate.localPath}: file could not be classified.`);
    }
  }

  return { errors, warnings };
}

function summarize(candidates: UploadCandidate[]): Summary {
  const summary: Summary = {
    totalFiles: candidates.length,
    uploadCandidates: 0,
    excludedFiles: 0,
    totalBytes: 0,
    uploadBytes: 0,
    byClassification: {},
  };

  for (const candidate of candidates) {
    summary.totalBytes += candidate.sizeBytes;

    if (candidate.includeInUpload) {
      summary.uploadCandidates += 1;
      summary.uploadBytes += candidate.sizeBytes;
    } else {
      summary.excludedFiles += 1;
    }

    summary.byClassification[candidate.classification] ??= { files: 0, bytes: 0 };
    summary.byClassification[candidate.classification].files += 1;
    summary.byClassification[candidate.classification].bytes += candidate.sizeBytes;
  }

  return summary;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dataDir = resolveArchiveDataDirPath(args.dataDir);
  assertArchiveDataDirExists(dataDir);
  const sourceRows = readSourceManifestRows(dataDir);
  const references = buildManifestReferences(sourceRows);
  const candidates = [];

  for (const filePath of walkFiles(dataDir)) {
    candidates.push(await buildCandidate(filePath, args.bucket, references));
  }

  const validation = validateCandidates(candidates);
  const output = {
    version: 1,
    generatedAt: new Date().toISOString(),
    mode: "dry-run",
    uploadAttempted: false,
    bucket: args.bucket,
    dataDir: toPosix(path.relative(repoRoot, dataDir)),
    policy: {
      provider: "Cloudflare R2",
      publicAccess: "disabled",
      canonicalChecksum: "sha256",
      firstUploadPriority: "official_source_raw",
    },
    summary: summarize(candidates),
    errors: validation.errors,
    warnings: validation.warnings,
    objects: candidates,
  };

  process.stdout.write(JSON.stringify(output, null, args.pretty ? 2 : 0));
  process.stdout.write("\n");

  process.stderr.write(
    `R2 archive dry run: ${output.summary.uploadCandidates} upload candidates, ${output.summary.excludedFiles} excluded, ${validation.errors.length} errors, ${validation.warnings.length} warnings.\n`,
  );

  if (validation.errors.length > 0) {
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`R2 archive dry run failed: ${message}\n`);
    process.exitCode = 1;
  });
}
