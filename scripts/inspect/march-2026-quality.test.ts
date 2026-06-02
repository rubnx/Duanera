import assert from "node:assert/strict";
import test from "node:test";

import {
  countValueToNumber,
  march2026ReportPeriod,
} from "../../src/quality/march-2026";

test("exposes the March 2026 QA report period", () => {
  assert.deepEqual(march2026ReportPeriod, {
    year: 2026,
    month: 3,
    label: "2026-03",
  });
});

test("coerces database count values safely", () => {
  assert.equal(countValueToNumber(12), 12);
  assert.equal(countValueToNumber("12"), 12);
  assert.equal(countValueToNumber(null), 0);
  assert.equal(countValueToNumber(undefined), 0);
  assert.equal(countValueToNumber("not-a-number"), 0);
});
