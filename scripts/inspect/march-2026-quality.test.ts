import assert from "node:assert/strict";
import test from "node:test";

import { march2026ReportPeriod } from "../../src/quality/march-2026";

test("exposes the March 2026 QA report period", () => {
  assert.deepEqual(march2026ReportPeriod, {
    year: 2026,
    month: 3,
    label: "2026-03",
  });
});
