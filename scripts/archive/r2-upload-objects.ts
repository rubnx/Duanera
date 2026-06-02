import { createHash } from "node:crypto";
import { createReadStream, existsSync, statSync } from "node:fs";
import {
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import path from "node:path";

import type { PlanObject } from "./r2-upload-plan-parser";

const repoRoot = process.cwd();
const maxSinglePutObjectBytes = 5 * 1024 * 1024 * 1024;

export async function verifyBucketAccess(client: S3Client, bucket: string) {
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

export function resolvePlanLocalPath(localPath: string) {
  const absolutePath = path.resolve(repoRoot, localPath);
  const relativePath = path.relative(repoRoot, absolutePath);
  const posixRelativePath = relativePath.split(path.sep).join("/");

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`${localPath}: local path must stay inside the repository.`);
  }

  if (posixRelativePath !== "data" && !posixRelativePath.startsWith("data/")) {
    throw new Error(`${localPath}: local path must be inside the ignored data/ archive.`);
  }

  return absolutePath;
}

export function verifyLocalFile(object: PlanObject) {
  const absolutePath = resolvePlanLocalPath(object.localPath);
  if (!existsSync(absolutePath)) {
    throw new Error(`${object.localPath}: local file is missing.`);
  }

  const sizeBytes = statSync(absolutePath).size;
  if (sizeBytes !== object.sizeBytes) {
    throw new Error(`${object.localPath}: local size ${sizeBytes} does not match plan size ${object.sizeBytes}.`);
  }

  if (sizeBytes >= maxSinglePutObjectBytes) {
    throw new Error(`${object.localPath}: file is too large for this single-object upload script.`);
  }

  return absolutePath;
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

function isMissingObjectError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return candidate.name === "NotFound" || candidate.name === "NoSuchKey" || candidate.$metadata?.httpStatusCode === 404;
}

async function headObjectMetadata(client: S3Client, bucket: string, key: string) {
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

export async function uploadObject(client: S3Client, bucket: string, object: PlanObject) {
  if (!object.r2Key) {
    throw new Error(`${object.localPath}: missing R2 key.`);
  }

  const absolutePath = verifyLocalFile(object);
  const sha256 = await sha256File(absolutePath);
  if (sha256 !== object.sha256) {
    throw new Error(`${object.localPath}: local SHA-256 no longer matches the plan.`);
  }

  const existingObject = await headObjectMetadata(client, bucket, object.r2Key);
  if (existingObject) {
    if (existingObject.sizeBytes === object.sizeBytes && existingObject.sha256 === object.sha256) {
      return "verified-existing";
    }

    throw new Error(`${object.r2Key}: remote object already exists with different size or SHA-256 metadata.`);
  }

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: object.r2Key,
      Body: createReadStream(absolutePath),
      ContentLength: object.sizeBytes,
      Metadata: object.metadata,
    }),
  );

  const head = await headObjectMetadata(client, bucket, object.r2Key);

  if (!head) {
    throw new Error(`${object.r2Key}: remote object was not found after upload.`);
  }

  if (head.sizeBytes !== object.sizeBytes) {
    throw new Error(`${object.r2Key}: remote size ${head.sizeBytes} does not match local size ${object.sizeBytes}.`);
  }

  if (head.sha256 !== object.sha256) {
    throw new Error(`${object.r2Key}: remote SHA-256 metadata does not match local checksum.`);
  }

  return "uploaded";
}
