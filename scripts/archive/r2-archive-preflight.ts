import { config } from "dotenv";
import {
  HeadObjectCommand,
  ListObjectsV2Command,
  S3Client,
  type S3Client as S3ClientType,
} from "@aws-sdk/client-s3";
import { pathToFileURL } from "node:url";

import { requiredCliValue } from "../../src/lib/cli-args";
import {
  buildArchiveUploadPlan,
  type ArchiveUploadCandidate,
  type ArchiveUploadPlan,
} from "./r2-upload-plan";
import type { ArchiveManifestKeyMode } from "./r2-upload-policy";

type Env = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint: string;
};

type Args = {
  bucket: string | null;
  dataDir: string;
  manifestKeyMode: ArchiveManifestKeyMode;
  pretty: boolean;
};

type RemoteObjectState = {
  sizeBytes: number | null;
  sha256: string | null;
};

export type ArchivePreflightStatus =
  | "already_archived"
  | "missing"
  | "remote_mismatch"
  | "skipped"
  | "unsafe";

export type ArchivePreflightObject = {
  localPath: string;
  r2Key: string | null;
  classification: string;
  sizeBytes: number;
  sha256: string;
  status: ArchivePreflightStatus;
  reason: string;
  remoteSizeBytes: number | null;
  remoteSha256: string | null;
};

export type ArchivePreflightReport = {
  version: 1;
  generatedAt: string;
  mode: "read-only";
  uploadAttempted: false;
  bucket: string;
  access: {
    bucket: string;
    objectSampleCount: number;
    keyCountKnown: number | null;
    isTruncated: boolean;
  };
  env: Record<string, "set">;
  planSummary: ArchiveUploadPlan["summary"];
  summary: {
    totalObjects: number;
    alreadyArchived: number;
    missing: number;
    remoteMismatches: number;
    skipped: number;
    unsafe: number;
    planErrors: number;
    planWarnings: number;
    checksumMismatches: number;
  };
  byClassification: Record<
    string,
    {
      planned: number;
      bytes: number;
      alreadyArchived: number;
      missing: number;
      remoteMismatches: number;
      skipped: number;
      unsafe: number;
    }
  >;
  april2026: {
    planned: number;
    alreadyArchived: number;
    missing: number;
    remoteMismatches: number;
    objects: ArchivePreflightObject[];
  };
  uploadPlanCommand: string;
  uploadCommands: Array<{
    classification: string;
    missingObjects: number;
    missingBytes: number;
    command: string;
  }>;
  errors: string[];
  warnings: string[];
  objects: ArchivePreflightObject[];
};

const defaultBucket = "duanera-source-archive";
const uploadPlanPath = "/tmp/duanera-r2-upload-plan.json";
const safeMissingUploadClassifications = new Set([
  "official_source_raw",
  "source_manifest",
  "working_file",
]);

function parseArgs(argv: string[]): Args {
  const args: Args = {
    bucket: null,
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

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is missing from .env.local.`);
  }
  return value;
}

function readEnv(): Env {
  return {
    accountId: requireEnv("CLOUDFLARE_ACCOUNT_ID"),
    accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
    bucket: requireEnv("R2_BUCKET"),
    endpoint: requireEnv("R2_ENDPOINT"),
  };
}

function assertEndpointMatchesAccount(env: Env) {
  const expectedHost = `${env.accountId}.r2.cloudflarestorage.com`;
  const endpoint = new URL(env.endpoint);
  if (endpoint.hostname !== expectedHost) {
    throw new Error(`R2_ENDPOINT host does not match CLOUDFLARE_ACCOUNT_ID. Expected ${expectedHost}.`);
  }
}

function createClient(env: Env) {
  return new S3Client({
    region: "auto",
    endpoint: env.endpoint,
    credentials: {
      accessKeyId: env.accessKeyId,
      secretAccessKey: env.secretAccessKey,
    },
  });
}

async function verifyBucketAccess(client: S3ClientType, bucket: string) {
  const response = await client.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      MaxKeys: 1,
    }),
  );

  return {
    bucket,
    objectSampleCount: response.Contents?.length ?? 0,
    keyCountKnown: response.KeyCount ?? null,
    isTruncated: response.IsTruncated ?? false,
  };
}

function isMissingObjectError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as {
    name?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    candidate.name === "NotFound" ||
    candidate.name === "NoSuchKey" ||
    candidate.$metadata?.httpStatusCode === 404
  );
}

async function headRemoteObject(
  client: S3ClientType,
  bucket: string,
  key: string,
): Promise<RemoteObjectState | null> {
  try {
    const head = await client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );

    return {
      sizeBytes: head.ContentLength ?? null,
      sha256: head.Metadata?.sha256 ?? null,
    };
  } catch (error) {
    if (isMissingObjectError(error)) {
      return null;
    }
    throw error;
  }
}

function remoteComparisonReason(
  candidate: ArchiveUploadCandidate,
  remote: RemoteObjectState | null,
): Pick<ArchivePreflightObject, "reason" | "status"> {
  if (!candidate.includeInUpload) {
    return {
      reason: candidate.exclusionReason ?? "Excluded from archive uploads.",
      status: "skipped",
    };
  }

  if (!candidate.r2Key || candidate.classification === "unknown") {
    return {
      reason: "Uploadable object is missing a safe R2 key or classification.",
      status: "unsafe",
    };
  }

  if (!remote) {
    return {
      reason: "Object is not archived in R2 yet.",
      status: "missing",
    };
  }

  if (remote.sizeBytes !== candidate.sizeBytes || remote.sha256 !== candidate.sha256) {
    return {
      reason: "Remote object exists but size or SHA-256 metadata does not match local plan.",
      status: "remote_mismatch",
    };
  }

  return {
    reason: "Remote object size and SHA-256 metadata match local plan.",
    status: "already_archived",
  };
}

function isApril2026Object(object: ArchivePreflightObject) {
  return (
    object.localPath.includes("2026_04") ||
    object.localPath.includes("2026/04") ||
    Boolean(object.r2Key?.includes("2026/04"))
  );
}

function uploadCommandFor(classification: string) {
  return [
    "R2_UPLOAD_CONFIRM=upload",
    "npm run archive:r2:upload --",
    `--plan-file ${uploadPlanPath}`,
    `--only-classification ${classification}`,
    "--confirm-upload",
  ].join(" ");
}

function uploadPlanCommandFor(plan: ArchiveUploadPlan) {
  const manifestKeyMode = plan.policy.sourceManifestKeyMode;
  const manifestKeyArg =
    manifestKeyMode === "snapshot" ? " --manifest-key-mode snapshot" : "";
  return `npm --silent run archive:r2:plan -- --pretty${manifestKeyArg} > ${uploadPlanPath}`;
}

export function buildArchivePreflightReport({
  access,
  generatedAt,
  plan,
  remoteByKey,
}: {
  access: ArchivePreflightReport["access"];
  generatedAt: string;
  plan: ArchiveUploadPlan;
  remoteByKey: Map<string, RemoteObjectState | null>;
}): ArchivePreflightReport {
  const objects: ArchivePreflightObject[] = plan.objects.map((candidate) => {
    const remote = candidate.r2Key ? remoteByKey.get(candidate.r2Key) ?? null : null;
    const comparison = remoteComparisonReason(candidate, remote);

    return {
      localPath: candidate.localPath,
      r2Key: candidate.r2Key,
      classification: candidate.classification,
      sizeBytes: candidate.sizeBytes,
      sha256: candidate.sha256,
      status: comparison.status,
      reason: comparison.reason,
      remoteSizeBytes: remote?.sizeBytes ?? null,
      remoteSha256: remote?.sha256 ?? null,
    };
  });

  const byClassification: ArchivePreflightReport["byClassification"] = {};
  for (const object of objects) {
    byClassification[object.classification] ??= {
      planned: 0,
      bytes: 0,
      alreadyArchived: 0,
      missing: 0,
      remoteMismatches: 0,
      skipped: 0,
      unsafe: 0,
    };

    const group = byClassification[object.classification];
    group.planned += 1;
    group.bytes += object.sizeBytes;
    if (object.status === "already_archived") {
      group.alreadyArchived += 1;
    } else if (object.status === "missing") {
      group.missing += 1;
    } else if (object.status === "remote_mismatch") {
      group.remoteMismatches += 1;
    } else if (object.status === "skipped") {
      group.skipped += 1;
    } else if (object.status === "unsafe") {
      group.unsafe += 1;
    }
  }

  const checksumMismatchObjects = plan.objects.filter(
    (object) => object.checksumMatchesManifest === false,
  );
  const missingBySafeClass = new Map<string, { missingObjects: number; missingBytes: number }>();
  for (const object of objects) {
    if (
      object.status === "missing" &&
      safeMissingUploadClassifications.has(object.classification)
    ) {
      const group = missingBySafeClass.get(object.classification) ?? {
        missingObjects: 0,
        missingBytes: 0,
      };
      group.missingObjects += 1;
      group.missingBytes += object.sizeBytes;
      missingBySafeClass.set(object.classification, group);
    }
  }

  const aprilObjects = objects.filter(isApril2026Object);
  const uploadCommands = [...missingBySafeClass.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([classification, group]) => ({
      classification,
      missingObjects: group.missingObjects,
      missingBytes: group.missingBytes,
      command: uploadCommandFor(classification),
    }));

  const summary = {
    totalObjects: objects.length,
    alreadyArchived: objects.filter((object) => object.status === "already_archived").length,
    missing: objects.filter((object) => object.status === "missing").length,
    remoteMismatches: objects.filter((object) => object.status === "remote_mismatch").length,
    skipped: objects.filter((object) => object.status === "skipped").length,
    unsafe: objects.filter((object) => object.status === "unsafe").length,
    planErrors: plan.errors.length,
    planWarnings: plan.warnings.length,
    checksumMismatches: checksumMismatchObjects.length,
  };

  const errors = [
    ...plan.errors,
    ...checksumMismatchObjects.map(
      (object) => `${object.localPath}: local SHA-256 does not match source manifest.`,
    ),
    ...objects
      .filter((object) => object.status === "remote_mismatch")
      .map((object) => `${object.r2Key}: remote size or SHA-256 metadata mismatch.`),
    ...objects
      .filter((object) => object.status === "unsafe")
      .map((object) => `${object.localPath}: unsafe upload candidate.`),
  ];

  const warnings = [
    ...plan.warnings,
    ...objects
      .filter(
        (object) =>
          object.status === "missing" &&
          !safeMissingUploadClassifications.has(object.classification),
      )
      .map(
        (object) =>
          `${object.localPath}: missing from R2 but requires manual review before upload.`,
      ),
  ];

  return {
    version: 1,
    generatedAt,
    mode: "read-only",
    uploadAttempted: false,
    bucket: plan.bucket,
    access,
    env: {
      CLOUDFLARE_ACCOUNT_ID: "set",
      R2_ACCESS_KEY_ID: "set",
      R2_SECRET_ACCESS_KEY: "set",
      R2_BUCKET: "set",
      R2_ENDPOINT: "set",
    },
    planSummary: plan.summary,
    summary,
    byClassification,
    april2026: {
      planned: aprilObjects.length,
      alreadyArchived: aprilObjects.filter((object) => object.status === "already_archived").length,
      missing: aprilObjects.filter((object) => object.status === "missing").length,
      remoteMismatches: aprilObjects.filter((object) => object.status === "remote_mismatch").length,
      objects: aprilObjects,
    },
    uploadPlanCommand: uploadPlanCommandFor(plan),
    uploadCommands,
    errors,
    warnings,
    objects,
  };
}

async function main() {
  config({ path: ".env.local", quiet: true });
  const args = parseArgs(process.argv.slice(2));
  const env = readEnv();
  assertEndpointMatchesAccount(env);
  const bucket = args.bucket ?? env.bucket ?? defaultBucket;
  if (bucket !== env.bucket) {
    throw new Error(`Preflight bucket ${bucket} does not match R2_BUCKET ${env.bucket}.`);
  }

  const client = createClient(env);
  const [access, plan] = await Promise.all([
    verifyBucketAccess(client, bucket),
    buildArchiveUploadPlan({
      bucket,
      dataDir: args.dataDir,
      manifestKeyMode: args.manifestKeyMode,
    }),
  ]);

  const remoteByKey = new Map<string, RemoteObjectState | null>();
  for (const object of plan.objects) {
    if (!object.includeInUpload || !object.r2Key) {
      continue;
    }
    remoteByKey.set(object.r2Key, await headRemoteObject(client, bucket, object.r2Key));
  }

  const report = buildArchivePreflightReport({
    access,
    generatedAt: new Date().toISOString(),
    plan,
    remoteByKey,
  });

  process.stdout.write(JSON.stringify(report, null, args.pretty ? 2 : 0));
  process.stdout.write("\n");
  process.stderr.write(
    `R2 archive preflight: ${report.summary.alreadyArchived} archived, ${report.summary.missing} missing, ${report.summary.remoteMismatches} remote mismatches, ${report.summary.unsafe} unsafe, ${report.errors.length} errors.\n`,
  );

  if (report.errors.length > 0) {
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`R2 archive preflight failed: ${message}\n`);
    process.exitCode = 1;
  });
}
