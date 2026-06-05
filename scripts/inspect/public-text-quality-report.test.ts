import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPublicTextQualityIssues,
  classifyPublicTextIssue,
  parsePublicTextQualityArgs,
  publicTextGroupScanLimit,
} from "./public-text-quality-report";

test("parses public text quality report arguments", () => {
  assert.deepEqual(parsePublicTextQualityArgs([]), {
    json: false,
    limit: 50,
    periodFrom: null,
    periodTo: null,
    tradeFlow: null,
  });

  assert.deepEqual(
    parsePublicTextQualityArgs([
      "--period-from=2026-03",
      "--period-to",
      "2026-04",
      "--trade-flow=import",
      "--limit=10",
      "--json",
    ]),
    {
      json: true,
      limit: 10,
      periodFrom: "2026-03",
      periodTo: "2026-04",
      tradeFlow: "import",
    },
  );

  assert.throws(
    () => parsePublicTextQualityArgs(["--period-from=2026-13"]),
    /YYYY-MM/,
  );
  assert.throws(
    () => parsePublicTextQualityArgs(["--trade-flow=both"]),
    /import or export/,
  );
  assert.throws(() => parsePublicTextQualityArgs(["--limit=0"]), /positive/);
});

test("classifies safe public text cleanup issues", () => {
  assert.deepEqual(classifyPublicTextIssue("CONFECCION DE TAPICERIA"), {
    cleaned: "Confección de tapicería",
    issueTypes: ["all_caps", "accent_fixed"],
    recommendation: "safe_auto_rule",
  });

  assert.deepEqual(classifyPublicTextIssue("HILAD OS"), {
    cleaned: "Hilados",
    issueTypes: ["all_caps", "broken_word_fixed"],
    recommendation: "safe_auto_rule",
  });

  assert.deepEqual(classifyPublicTextIssue("CHO: 1.45MTS"), {
    cleaned: "Ancho: 1.45 m",
    issueTypes: ["all_caps", "spacing_or_unit_fixed"],
    recommendation: "safe_auto_rule",
  });
});

test("ignores code-like public text fragments", () => {
  assert.deepEqual(classifyPublicTextIssue("YFELPA2"), {
    cleaned: "YFELPA2",
    issueTypes: [],
    recommendation: "ignore",
  });

  assert.deepEqual(classifyPublicTextIssue("I.D.D.T.-F"), {
    cleaned: "I.D.D.T.-F",
    issueTypes: [],
    recommendation: "ignore",
  });
});

test("groups and ranks public text quality issues", () => {
  const issues = buildPublicTextQualityIssues(
    [
      {
        exampleRecordId: "record-1",
        field: "product_description_raw",
        raw: "CONFECCION DE TAPICERIA",
        records: 5,
      },
      {
        exampleRecordId: "record-2",
        field: "product_attributes.other1",
        raw: "CONFECCION DE TAPICERIA",
        records: 3,
      },
      {
        exampleRecordId: "record-3",
        field: "product_attributes.other2",
        raw: "HILAD OS",
        records: 12,
      },
      {
        exampleRecordId: "record-4",
        field: "product_attributes.brand",
        raw: "YFELPA2",
        records: 100,
      },
    ],
    10,
  );

  assert.equal(issues.length, 2);
  assert.equal(issues[0]?.raw, "HILAD OS");
  assert.equal(issues[0]?.count, 12);
  assert.equal(issues[1]?.raw, "CONFECCION DE TAPICERIA");
  assert.equal(issues[1]?.count, 8);
  assert.deepEqual(issues[1]?.fields, [
    "product_description_raw",
    "product_attributes.other1",
  ]);
  assert.deepEqual(issues[1]?.exampleLinks, [
    "/trade-records/record-1",
    "/trade-records/record-2",
  ]);
});

test("limits public text quality issues", () => {
  const issues = buildPublicTextQualityIssues(
    [
      {
        field: "product_description_raw",
        raw: "CONFECCION DE TAPICERIA",
        records: 5,
      },
      {
        field: "product_description_raw",
        raw: "HILAD OS",
        records: 12,
      },
    ],
    1,
  );

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.raw, "HILAD OS");
});

test("keeps public text fragment scans bounded", () => {
  assert.equal(publicTextGroupScanLimit(1), 250);
  assert.equal(publicTextGroupScanLimit(50), 2500);
  assert.equal(publicTextGroupScanLimit(1000), 2500);
});
