import test from "node:test";
import assert from "node:assert/strict";

import {
  coveragePercent,
  coverageStatus,
  normalizeCodeForCoverage,
} from "../../src/quality/data-quality";

test("normalizes Aduana codes for label coverage comparisons", () => {
  assert.equal(normalizeCodeForCoverage("001"), "1");
  assert.equal(normalizeCodeForCoverage("000"), "0");
  assert.equal(normalizeCodeForCoverage(" cl "), "CL");
  assert.equal(normalizeCodeForCoverage(""), null);
  assert.equal(normalizeCodeForCoverage(null), null);
});

test("computes coverage percentages with stable one-decimal precision", () => {
  assert.equal(coveragePercent(100, 100), 100);
  assert.equal(coveragePercent(1, 3), 33.3);
  assert.equal(coveragePercent(0, 0), 0);
});

test("classifies coverage conservatively", () => {
  assert.equal(coverageStatus({ covered: 100, total: 100 }), "ok");
  assert.equal(coverageStatus({ covered: 95, total: 100 }), "review");
  assert.equal(coverageStatus({ covered: 89, total: 100 }), "warning");
  assert.equal(coverageStatus({ covered: 0, total: 0 }), "review");
});
