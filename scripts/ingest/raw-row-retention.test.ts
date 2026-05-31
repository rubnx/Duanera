import assert from "node:assert/strict";
import test from "node:test";

import {
  isRawRowPayloadPrunable,
  parseRawRowPayloadRetentionMode,
  rawRowPayloadRetentionFields,
  type RawRowPruningCandidate,
} from "../../src/ingest/raw-row-retention";

test("defaults raw row payload retention to full_postgres", () => {
  assert.equal(parseRawRowPayloadRetentionMode(undefined), "full_postgres");
  assert.equal(parseRawRowPayloadRetentionMode(""), "full_postgres");
});

test("parses supported raw row payload retention modes", () => {
  assert.equal(parseRawRowPayloadRetentionMode("full_postgres"), "full_postgres");
  assert.equal(parseRawRowPayloadRetentionMode(" errors_and_warnings "), "errors_and_warnings");
});

test("rejects unsupported raw row payload retention modes", () => {
  assert.throws(
    () => parseRawRowPayloadRetentionMode("metadata_only"),
    /RAW_ROW_PAYLOAD_RETENTION must be one of/,
  );
});

test("keeps full_postgres rows as dev samples", () => {
  assert.deepEqual(
    rawRowPayloadRetentionFields({
      mode: "full_postgres",
      rowHashSha256: "abc123",
      hasParseErrors: false,
      hasParseWarnings: false,
    }),
    {
      payloadRetentionMode: "full_postgres",
      payloadStorageKind: "postgres",
      payloadStorageBucket: null,
      payloadStorageKey: null,
      payloadHashSha256: "abc123",
      payloadRetainedReason: "dev_sample",
      payloadPrunedAt: null,
      payloadReconstructable: true,
    },
  );
});

test("marks failed rows retained in errors_and_warnings mode", () => {
  assert.equal(
    rawRowPayloadRetentionFields({
      mode: "errors_and_warnings",
      rowHashSha256: "abc123",
      hasParseErrors: true,
      hasParseWarnings: false,
    }).payloadRetainedReason,
    "parse_error",
  );
});

test("marks warning rows retained in errors_and_warnings mode", () => {
  assert.equal(
    rawRowPayloadRetentionFields({
      mode: "errors_and_warnings",
      rowHashSha256: "abc123",
      hasParseErrors: false,
      hasParseWarnings: true,
    }).payloadRetainedReason,
    "parse_warning",
  );
});

test("marks successful rows as pending prune in errors_and_warnings mode", () => {
  assert.equal(
    rawRowPayloadRetentionFields({
      mode: "errors_and_warnings",
      rowHashSha256: "abc123",
      hasParseErrors: false,
      hasParseWarnings: false,
    }).payloadRetainedReason,
    "pending_post_normalization_prune",
  );
});

const prunableRow: RawRowPruningCandidate = {
  payloadRetentionMode: "errors_and_warnings",
  payloadStorageKind: "postgres",
  payloadRetainedReason: "pending_post_normalization_prune",
  payloadPrunedAt: null,
  payloadReconstructable: true,
  parseStatus: "parsed",
  parseErrors: null,
  parseWarnings: null,
  rawText: "raw row",
  rawValues: { FIELD: "value" },
  hasMatchingTradeRecord: true,
};

test("allows pruning only for normalized successful rows pending prune", () => {
  assert.equal(isRawRowPayloadPrunable(prunableRow), true);
});

test("does not prune full_postgres rows", () => {
  assert.equal(
    isRawRowPayloadPrunable({
      ...prunableRow,
      payloadRetentionMode: "full_postgres",
    }),
    false,
  );
});

test("does not prune rows with errors or warnings", () => {
  assert.equal(
    isRawRowPayloadPrunable({
      ...prunableRow,
      parseErrors: ["bad field count"],
    }),
    false,
  );
  assert.equal(
    isRawRowPayloadPrunable({
      ...prunableRow,
      parseWarnings: ["suspicious value"],
    }),
    false,
  );
});

test("does not prune rows without a matching trade record", () => {
  assert.equal(
    isRawRowPayloadPrunable({
      ...prunableRow,
      hasMatchingTradeRecord: false,
    }),
    false,
  );
});

test("does not prune already pruned rows", () => {
  assert.equal(
    isRawRowPayloadPrunable({
      ...prunableRow,
      rawText: null,
      rawValues: null,
      payloadPrunedAt: new Date("2026-05-28T00:00:00.000Z"),
    }),
    false,
  );
});
