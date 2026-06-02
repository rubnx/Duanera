import assert from "node:assert/strict";
import test from "node:test";

import {
  parsePositiveSafeIntegerCliValue,
  requiredCliValue,
} from "../../src/lib/cli-args";

test("reads required CLI flag values", () => {
  assert.equal(requiredCliValue(["--limit", "5"], 0, "--limit"), "5");
  assert.throws(() => requiredCliValue(["--limit"], 0, "--limit"), /requires a value/);
  assert.throws(() => requiredCliValue(["--limit", "--pretty"], 0, "--limit"), /requires a value/);
});

test("parses positive safe integer CLI values strictly", () => {
  assert.equal(parsePositiveSafeIntegerCliValue("5", "--limit"), 5);
  assert.throws(() => parsePositiveSafeIntegerCliValue("1e2", "--limit"), /positive integer/);
  assert.throws(() => parsePositiveSafeIntegerCliValue("1.5", "--limit"), /positive integer/);
  assert.throws(() => parsePositiveSafeIntegerCliValue("0", "--limit"), /positive safe integer/);
});
