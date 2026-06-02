import { createHash } from "node:crypto";
import { createReadStream, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { requiredCliValue } from "../../src/lib/cli-args";
import {
  buildManifestReferences,
  readSourceManifestRows,
} from "./r2-upload-manifest";
import {
  archiveFileRoleFor,
  archivePeriodFor,
  archiveR2KeyFor,
  archiveR2MetadataFor,
  archiveSourceDomainFor,
  archiveSourceKindFor,
  archiveTradeFlowFor,
  classifyArchivePath,
  type ArchiveManifestKeyMode,
  type ArchiveManifestReference,
} from "./r2-upload-policy";

export { parseArchiveSourceManifestRows } from "./r2-upload-manifest";

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
  manifestKeyMode: ArchiveManifestKeyMode;
  pretty: boolean;
};

export type ArchiveUploadCandidate = UploadCandidate;

export type ArchiveUploadPlan = {
  version: 1;
  generatedAt: string;
  mode: "dry-run";
  uploadAttempted: false;
  bucket: string;
  dataDir: string;
  policy: {
    provider: "Cloudflare R2";
    publicAccess: "disabled";
    canonicalChecksum: "sha256";
    firstUploadPriority: "official_source_raw";
    sourceManifestKeyMode: ArchiveManifestKeyMode;
  };
  summary: Summary;
  errors: string[];
  warnings: string[];
  objects: UploadCandidate[];
};

const defaultBucket = "duanera-source-archive";
const repoRoot = process.cwd();

function parseArgs(argv: string[]): Args {
  const args: Args = {
    bucket: defaultBucket,
    dataDir: "data",
    manifestKeyMode: "legacy",
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

    if (arg === "--manifest-key-mode") {
      args.manifestKeyMode = parseManifestKeyMode(requiredCliValue(argv, index, arg));
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function parseManifestKeyMode(value: string): ArchiveManifestKeyMode {
  if (value === "legacy" || value === "snapshot") {
    return value;
  }
  throw new Error("--manifest-key-mode must be legacy or snapshot.");
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

async function buildCandidate(
  absolutePath: string,
  bucket: string,
  references: Map<string, ArchiveManifestReference>,
  manifestKeyMode: ArchiveManifestKeyMode,
): Promise<UploadCandidate> {
  const localPath = repoRelativePath(absolutePath);
  const classification = classifyArchivePath(localPath);
  const reference = references.get(localPath);
  const sizeBytes = statSync(absolutePath).size;
  const sha256 = await sha256File(absolutePath);
  const manifestSha256 = reference?.checksumSha256 ?? null;
  const checksumMatchesManifest = manifestSha256 ? manifestSha256 === sha256 : null;
  const sourceKind = archiveSourceKindFor(classification, localPath);
  const fileRole = archiveFileRoleFor(classification, reference);
  const r2Key = archiveR2KeyFor(localPath, classification, reference, {
    manifestKeyMode,
    sha256,
  });
  const includeInUpload = classification !== "disposable";
  const baseCandidate = {
    localPath,
    r2Bucket: bucket,
    r2Key,
    classification,
    sourceKind,
    fileRole,
    sourceDomain: archiveSourceDomainFor(localPath, reference),
    country: reference?.country ?? (localPath.includes("chile-aduana") ? "CL" : null),
    tradeFlow: archiveTradeFlowFor(localPath, reference),
    period: archivePeriodFor(localPath, reference),
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
    metadata: archiveR2MetadataFor(baseCandidate),
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

export async function buildArchiveUploadPlan({
  bucket,
  dataDir,
  manifestKeyMode = "legacy",
}: {
  bucket: string;
  dataDir: string;
  manifestKeyMode?: ArchiveManifestKeyMode;
}): Promise<ArchiveUploadPlan> {
  const resolvedDataDir = resolveArchiveDataDirPath(dataDir);
  assertArchiveDataDirExists(resolvedDataDir);
  const sourceRows = readSourceManifestRows(resolvedDataDir, { repoRelativePath, walkFiles });
  const references = buildManifestReferences(sourceRows);
  const candidates = [];

  for (const filePath of walkFiles(resolvedDataDir)) {
    candidates.push(await buildCandidate(filePath, bucket, references, manifestKeyMode));
  }

  const validation = validateCandidates(candidates);
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    mode: "dry-run",
    uploadAttempted: false,
    bucket,
    dataDir: toPosix(path.relative(repoRoot, resolvedDataDir)),
    policy: {
      provider: "Cloudflare R2",
      publicAccess: "disabled",
      canonicalChecksum: "sha256",
      firstUploadPriority: "official_source_raw",
      sourceManifestKeyMode: manifestKeyMode,
    },
    summary: summarize(candidates),
    errors: validation.errors,
    warnings: validation.warnings,
    objects: candidates,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const output = await buildArchiveUploadPlan({
    bucket: args.bucket,
    dataDir: args.dataDir,
    manifestKeyMode: args.manifestKeyMode,
  });

  process.stdout.write(JSON.stringify(output, null, args.pretty ? 2 : 0));
  process.stdout.write("\n");

  process.stderr.write(
    `R2 archive dry run: ${output.summary.uploadCandidates} upload candidates, ${output.summary.excludedFiles} excluded, ${output.errors.length} errors, ${output.warnings.length} warnings.\n`,
  );

  if (output.errors.length > 0) {
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
