import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  isUsefulBultoMark,
  parseArgs,
  resolveResearchDataPath,
} from "./identity-evidence-report";

test("parses identity evidence report arguments with safe defaults", () => {
  assert.deepEqual(parseArgs([]), { flow: "import", limit: 5 });
  assert.deepEqual(parseArgs(["--export", "--limit=8"]), { flow: "export", limit: 8 });
});

test("clamps identity evidence report limit", () => {
  assert.equal(parseArgs(["--limit=0"]).limit, 1);
  assert.equal(parseArgs(["--limit=50"]).limit, 10);
  assert.equal(parseArgs(["--limit=bad"]).limit, 5);
});

test("keeps useful export bulto marks and rejects generic values", () => {
  assert.equal(isUsefulBultoMark("MARCA ACME"), true);
  assert.equal(isUsefulBultoMark("ROTUL."), false);
  assert.equal(isUsefulBultoMark("ABCD1234567"), false);
  assert.equal(isUsefulBultoMark("1234 / 567"), false);
});

test("resolves research data paths inside the ignored data archive", () => {
  assert.equal(
    resolveResearchDataPath("data/research/example.txt"),
    path.resolve("data/research/example.txt"),
  );
});

test("rejects research data paths outside the repository or data archive", () => {
  assert.throws(
    () => resolveResearchDataPath(path.resolve("..", "outside.txt")),
    /must stay inside the repository/,
  );
  assert.throws(
    () => resolveResearchDataPath("scripts/example.txt"),
    /must be inside the ignored data\/ archive/,
  );
});
