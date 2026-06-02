import test from "node:test";
import assert from "node:assert/strict";

import { positiveIntegerEnvValue } from "../../src/lib/env";

test("parses positive integer environment values strictly", () => {
  assert.equal(positiveIntegerEnvValue("LIMIT", undefined, 25), 25);
  assert.equal(positiveIntegerEnvValue("LIMIT", "", 25), 25);
  assert.equal(positiveIntegerEnvValue("LIMIT", "10", 25), 10);

  assert.throws(
    () => positiveIntegerEnvValue("LIMIT", "0", 25),
    /must be a positive integer/,
  );
  assert.throws(
    () => positiveIntegerEnvValue("LIMIT", "-1", 25),
    /must be a positive integer/,
  );
  assert.throws(
    () => positiveIntegerEnvValue("LIMIT", "10abc", 25),
    /must be a positive integer/,
  );
});
