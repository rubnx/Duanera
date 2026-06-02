import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { resolveWorkingStoragePath } from "./load-raw-trade-row-sample";

test("resolves working storage paths inside the ignored data archive", () => {
  assert.equal(
    resolveWorkingStoragePath("data/sources/chile-aduana/sample.txt"),
    path.resolve("data/sources/chile-aduana/sample.txt"),
  );
});

test("uses the first usable working storage path from pipe-delimited values", () => {
  assert.equal(
    resolveWorkingStoragePath(" data/sources/chile-aduana/first.txt | data/second.txt "),
    path.resolve("data/sources/chile-aduana/first.txt"),
  );
});

test("rejects missing or blank working storage paths", () => {
  assert.throws(() => resolveWorkingStoragePath(null), /missing workingStorageKey/);
  assert.throws(
    () => resolveWorkingStoragePath(" | "),
    /does not contain a usable local path/,
  );
});

test("rejects working storage paths outside the repository", () => {
  assert.throws(
    () => resolveWorkingStoragePath(path.resolve("..", "outside.txt")),
    /must stay inside the repository/,
  );
});

test("rejects working storage paths outside the ignored data archive", () => {
  assert.throws(
    () => resolveWorkingStoragePath("scripts/not-data.txt"),
    /must be inside the ignored data\/ archive/,
  );
});
