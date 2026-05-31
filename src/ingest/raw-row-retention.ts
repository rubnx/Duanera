export const rawRowPayloadRetentionModes = [
  "full_postgres",
  "errors_and_warnings",
] as const;

export type RawRowPayloadRetentionMode = (typeof rawRowPayloadRetentionModes)[number];

export type RawRowPayloadRetentionFields = {
  payloadRetentionMode: RawRowPayloadRetentionMode;
  payloadStorageKind: "postgres";
  payloadStorageBucket: null;
  payloadStorageKey: null;
  payloadHashSha256: string;
  payloadRetainedReason:
    | "dev_sample"
    | "parse_error"
    | "parse_warning"
    | "pending_post_normalization_prune";
  payloadPrunedAt: null;
  payloadReconstructable: true;
};

export function parseRawRowPayloadRetentionMode(
  value: string | undefined,
): RawRowPayloadRetentionMode {
  if (!value || value.trim() === "") {
    return "full_postgres";
  }

  const normalized = value.trim();
  if (rawRowPayloadRetentionModes.includes(normalized as RawRowPayloadRetentionMode)) {
    return normalized as RawRowPayloadRetentionMode;
  }

  throw new Error(
    `RAW_ROW_PAYLOAD_RETENTION must be one of ${rawRowPayloadRetentionModes.join(
      ", ",
    )}, got ${value}.`,
  );
}

export function rawRowPayloadRetentionFields(input: {
  mode: RawRowPayloadRetentionMode;
  rowHashSha256: string;
  hasParseErrors: boolean;
  hasParseWarnings: boolean;
}): RawRowPayloadRetentionFields {
  let payloadRetainedReason: RawRowPayloadRetentionFields["payloadRetainedReason"] =
    "dev_sample";

  if (input.mode === "errors_and_warnings") {
    if (input.hasParseErrors) {
      payloadRetainedReason = "parse_error";
    } else if (input.hasParseWarnings) {
      payloadRetainedReason = "parse_warning";
    } else {
      payloadRetainedReason = "pending_post_normalization_prune";
    }
  }

  return {
    payloadRetentionMode: input.mode,
    payloadStorageKind: "postgres",
    payloadStorageBucket: null,
    payloadStorageKey: null,
    payloadHashSha256: input.rowHashSha256,
    payloadRetainedReason,
    payloadPrunedAt: null,
    payloadReconstructable: true,
  };
}

export type RawRowPruningCandidate = {
  payloadRetentionMode: string | null;
  payloadStorageKind: string | null;
  payloadRetainedReason: string | null;
  payloadPrunedAt: Date | string | null;
  payloadReconstructable: boolean | null;
  parseStatus: string | null;
  parseErrors: unknown;
  parseWarnings: unknown;
  rawText: string | null;
  rawValues: unknown;
  hasMatchingTradeRecord: boolean;
};

export function isRawRowPayloadPrunable(row: RawRowPruningCandidate): boolean {
  return (
    row.payloadRetentionMode === "errors_and_warnings" &&
    row.payloadStorageKind === "postgres" &&
    row.payloadRetainedReason === "pending_post_normalization_prune" &&
    row.payloadPrunedAt === null &&
    row.payloadReconstructable === true &&
    row.parseStatus === "parsed" &&
    row.parseErrors === null &&
    row.parseWarnings === null &&
    (row.rawText !== null || row.rawValues !== null) &&
    row.hasMatchingTradeRecord
  );
}
