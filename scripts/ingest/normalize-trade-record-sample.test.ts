import assert from "node:assert/strict";
import test from "node:test";

import { parseIntegerValue } from "./normalize-trade-record-sample";

test("parses trade record integer fields strictly", () => {
  assert.equal(parseIntegerValue("1"), 1);
  assert.equal(parseIntegerValue("001"), 1);
  assert.equal(parseIntegerValue(" 25 "), 25);
  assert.equal(parseIntegerValue(null), null);
  assert.equal(parseIntegerValue(""), null);

  assert.equal(parseIntegerValue("12x"), null);
  assert.equal(parseIntegerValue("1.5"), null);
  assert.equal(parseIntegerValue("-1"), null);
});
