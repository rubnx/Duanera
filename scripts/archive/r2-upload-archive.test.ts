import { statSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

import {
  resolvePlanLocalPath,
  verifyLocalFile,
  type PlanObject,
} from "./r2-upload-archive";

function planObject(localPath: string, sizeBytes: number): PlanObject {
  return {
    localPath,
    r2Bucket: "duanera-source-archive",
    r2Key: "test/key",
    classification: "official_source_raw",
    sizeBytes,
    sha256: "unused",
    includeInUpload: true,
    metadata: {},
  };
}

test("rejects archive plan local paths outside the repository", () => {
  assert.throws(
    () => resolvePlanLocalPath("../outside.txt"),
    /local path must stay inside the repository/,
  );
  assert.throws(
    () => resolvePlanLocalPath("/tmp/duanera-outside.txt"),
    /local path must stay inside the repository/,
  );
});

test("verifies archive plan local files inside the repository", () => {
  const sizeBytes = statSync("package.json").size;

  assert.equal(verifyLocalFile(planObject("package.json", sizeBytes)), resolvePlanLocalPath("package.json"));
  assert.throws(
    () => verifyLocalFile(planObject("package.json", sizeBytes + 1)),
    /does not match plan size/,
  );
});
