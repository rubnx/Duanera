import assert from "node:assert/strict";
import test from "node:test";

import { parseIntegerValue, rawValuesRecord } from "./normalize-trade-record-sample";

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

test("validates normalizer raw value payloads", () => {
  assert.deepEqual(rawValuesRecord({ NUMITEM: "1" }, "row-1"), { NUMITEM: "1" });

  assert.throws(
    () => rawValuesRecord(null, "row-2"),
    /row-2 raw_values must be an object/,
  );
  assert.throws(
    () => rawValuesRecord(["NUMITEM", "1"], "row-3"),
    /row-3 raw_values must be an object/,
  );
  assert.throws(
    () => rawValuesRecord({ NUMITEM: 1 }, "row-4"),
    /row-4 raw_values contains non-string values for: NUMITEM/,
  );
});
