import { mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import test, { after } from "node:test";
import assert from "node:assert/strict";

import {
  parseArchivePlan,
  resolvePlanLocalPath,
  verifyLocalFile,
  type PlanObject,
} from "./r2-upload-archive";

const testDir = "data/.duanera-test-r2-upload-archive";
const testFile = `${testDir}/sample.txt`;

after(() => {
  rmSync(testDir, { force: true, recursive: true });
});

function planObject(localPath: string, sizeBytes: number): PlanObject {
  return {
    localPath,
    r2Bucket: "duanera-source-archive",
    r2Key: "test/key",
    classification: "official_source_raw",
    sizeBytes,
    sha256: "a".repeat(64),
    includeInUpload: true,
    metadata: {},
  };
}

test("rejects archive plan local paths outside the repository or data archive", () => {
  assert.throws(
    () => resolvePlanLocalPath("../outside.txt"),
    /local path must stay inside the repository/,
  );
  assert.throws(
    () => resolvePlanLocalPath("/tmp/duanera-outside.txt"),
    /local path must stay inside the repository/,
  );
  assert.throws(
    () => resolvePlanLocalPath("package.json"),
    /local path must be inside the ignored data\/ archive/,
  );
});

test("verifies archive plan local files inside the ignored data archive", () => {
  mkdirSync(testDir, { recursive: true });
  writeFileSync(testFile, "sample source payload");
  const sizeBytes = statSync(testFile).size;

  assert.equal(verifyLocalFile(planObject(testFile, sizeBytes)), resolvePlanLocalPath(testFile));

  assert.throws(
    () => verifyLocalFile(planObject(testFile, sizeBytes + 1)),
    /does not match plan size/,
  );
});

test("validates archive upload plan JSON before use", () => {
  const validPlan = {
    mode: "dry-run",
    uploadAttempted: false,
    bucket: "duanera-source-archive",
    errors: [],
    warnings: [],
    objects: [planObject("data/sources/sample.txt", 12)],
  };

  assert.equal(parseArchivePlan(JSON.stringify(validPlan)).objects.length, 1);
  assert.throws(() => parseArchivePlan("{"), /not valid JSON/);
  assert.throws(
    () => parseArchivePlan(JSON.stringify({ ...validPlan, errors: "none" })),
    /errors must be an array of strings/,
  );
  assert.throws(
    () =>
      parseArchivePlan(
        JSON.stringify({
          ...validPlan,
          objects: [{ ...validPlan.objects[0], metadata: { sha256: 123 } }],
        }),
      ),
    /metadata field sha256 must be a string/,
  );
  assert.throws(
    () =>
      parseArchivePlan(
        JSON.stringify({
          ...validPlan,
          objects: [{ ...validPlan.objects[0], sha256: "bad" }],
        }),
      ),
    /invalid SHA-256/,
  );
});
