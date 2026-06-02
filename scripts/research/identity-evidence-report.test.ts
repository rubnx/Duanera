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
  assert.deepEqual(parseArgs(["--import", "--limit=3"]), { flow: "import", limit: 3 });
});

test("clamps valid identity evidence report limits", () => {
  assert.equal(parseArgs(["--limit=0"]).limit, 1);
  assert.equal(parseArgs(["--limit=50"]).limit, 10);
});

test("rejects invalid identity evidence report arguments", () => {
  assert.throws(() => parseArgs(["--limit=bad"]), /positive integer/);
  assert.throws(() => parseArgs(["--export", "--import"]), /either --import or --export/);
  assert.throws(() => parseArgs(["--unknown"]), /Unknown argument/);
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
