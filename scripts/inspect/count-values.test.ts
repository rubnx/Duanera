import assert from "node:assert/strict";
import test from "node:test";

import { countValueToNumber } from "../../src/db/count-values";

test("coerces database count values safely", () => {
  assert.equal(countValueToNumber(12), 12);
  assert.equal(countValueToNumber("12"), 12);
  assert.equal(countValueToNumber(null), 0);
  assert.equal(countValueToNumber(undefined), 0);
  assert.equal(countValueToNumber("not-a-number"), 0);
});
