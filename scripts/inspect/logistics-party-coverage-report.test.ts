import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLogisticsCoverageReport,
  parseLogisticsCoverageArgs,
} from "./logistics-party-coverage-report";

test("parses logistics party coverage report arguments", () => {
  assert.deepEqual(parseLogisticsCoverageArgs([]), {
    json: false,
    periodFrom: null,
    periodTo: null,
  });

  assert.deepEqual(
    parseLogisticsCoverageArgs([
      "--period-from=2025-07",
      "--period-to",
      "2026-04",
      "--json",
    ]),
    {
      json: true,
      periodFrom: "2025-07",
      periodTo: "2026-04",
    },
  );

  assert.throws(
    () => parseLogisticsCoverageArgs(["--period-from=2026-13"]),
    /YYYY-MM/,
  );
  assert.throws(
    () => parseLogisticsCoverageArgs(["--unknown"]),
    /Unknown argument/,
  );
});

test("builds logistics party coverage rows from record and link counts", () => {
  const report = buildLogisticsCoverageReport({
    recordRows: [
      { flow: "import", year: 2026, month: 4, total: 100 },
      { flow: "export", year: 2026, month: 4, total: 50 },
      { flow: "import", year: 2099, month: 1, total: 1 },
    ],
    linkRows: [
      { flow: "import", year: 2026, month: 4, links: 180, linkedRecords: 90 },
      { flow: "export", year: 2026, month: 4, links: 100, linkedRecords: 50 },
    ],
    periodFrom: "2026-04",
    periodTo: "2026-04",
  });

  assert.equal(report.rows.length, 2);
  assert.deepEqual(report.rows[0], {
    coveragePercent: 100,
    flow: "export",
    linkedRecords: 50,
    links: 100,
    missingRecords: 0,
    period: "2026-04",
    records: 50,
    status: "complete",
  });
  assert.deepEqual(report.rows[1], {
    coveragePercent: 90,
    flow: "import",
    linkedRecords: 90,
    links: 180,
    missingRecords: 10,
    period: "2026-04",
    records: 100,
    status: "partial",
  });
  assert.deepEqual(report.totals, {
    complete: 1,
    missing: 0,
    partial: 1,
    records: 150,
    linkedRecords: 140,
    links: 280,
  });
});
