export type PlanObject = {
  localPath: string;
  r2Bucket: string;
  r2Key: string | null;
  classification: string;
  sizeBytes: number;
  sha256: string;
  includeInUpload: boolean;
  metadata: Record<string, string>;
};

export type ArchivePlan = {
  mode: string;
  uploadAttempted: boolean;
  bucket: string;
  errors: string[];
  warnings: string[];
  objects: PlanObject[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringField(value: Record<string, unknown>, key: string): string {
  const fieldValue = value[key];
  if (typeof fieldValue !== "string") {
    throw new Error(`Plan file field ${key} must be a string.`);
  }
  return fieldValue;
}

function optionalStringField(value: Record<string, unknown>, key: string): string | null {
  const fieldValue = value[key];
  if (fieldValue === null) {
    return null;
  }
  if (typeof fieldValue !== "string") {
    throw new Error(`Plan file field ${key} must be a string or null.`);
  }
  return fieldValue;
}

function booleanField(value: Record<string, unknown>, key: string): boolean {
  const fieldValue = value[key];
  if (typeof fieldValue !== "boolean") {
    throw new Error(`Plan file field ${key} must be a boolean.`);
  }
  return fieldValue;
}

function nonNegativeIntegerField(value: Record<string, unknown>, key: string): number {
  const fieldValue = value[key];
  if (
    typeof fieldValue !== "number" ||
    !Number.isSafeInteger(fieldValue) ||
    fieldValue < 0
  ) {
    throw new Error(`Plan file field ${key} must be a non-negative safe integer.`);
  }
  return fieldValue;
}

function stringArrayField(value: Record<string, unknown>, key: string): string[] {
  const fieldValue = value[key];
  if (!Array.isArray(fieldValue) || !fieldValue.every((item) => typeof item === "string")) {
    throw new Error(`Plan file field ${key} must be an array of strings.`);
  }
  return fieldValue;
}

function metadataField(value: Record<string, unknown>): Record<string, string> {
  const fieldValue = value.metadata;
  if (!isRecord(fieldValue)) {
    throw new Error("Plan file field metadata must be an object with string values.");
  }

  const metadata: Record<string, string> = {};
  for (const [key, metadataValue] of Object.entries(fieldValue)) {
    if (typeof metadataValue !== "string") {
      throw new Error(`Plan metadata field ${key} must be a string.`);
    }

    metadata[key] = metadataValue;
  }

  return metadata;
}

function parsePlanObject(value: unknown, index: number): PlanObject {
  if (!isRecord(value)) {
    throw new Error(`Plan object ${index} must be an object.`);
  }

  const sha256 = stringField(value, "sha256");
  if (!/^[0-9a-f]{64}$/i.test(sha256)) {
    throw new Error(`Plan object ${index} has an invalid SHA-256 checksum.`);
  }

  return {
    localPath: stringField(value, "localPath"),
    r2Bucket: stringField(value, "r2Bucket"),
    r2Key: optionalStringField(value, "r2Key"),
    classification: stringField(value, "classification"),
    sizeBytes: nonNegativeIntegerField(value, "sizeBytes"),
    sha256: sha256.toLowerCase(),
    includeInUpload: booleanField(value, "includeInUpload"),
    metadata: metadataField(value),
  };
}

export function parseArchivePlan(content: string): ArchivePlan {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Plan file is not valid JSON: ${message}`);
  }

  if (!isRecord(parsed)) {
    throw new Error("Plan file must contain a JSON object.");
  }

  const objects = parsed.objects;
  if (!Array.isArray(objects)) {
    throw new Error("Plan file field objects must be an array.");
  }

  return {
    mode: stringField(parsed, "mode"),
    uploadAttempted: booleanField(parsed, "uploadAttempted"),
    bucket: stringField(parsed, "bucket"),
    errors: stringArrayField(parsed, "errors"),
    warnings: stringArrayField(parsed, "warnings"),
    objects: objects.map(parsePlanObject),
  };
}
