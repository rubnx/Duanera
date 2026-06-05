import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeStartRowForFlow,
  parseIntegerValue,
  parseNormalizePeriod,
  parseNormalizeStartFlow,
  parseNormalizeStartRow,
  rawValuesRecord,
} from "./normalize-trade-record-sample";

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

test("parses optional normalizer period filters", () => {
  assert.equal(parseNormalizePeriod(""), null);
  assert.deepEqual(parseNormalizePeriod("2026-04"), {
    year: 2026,
    month: 4,
    period: "2026-04",
  });

  assert.throws(
    () => parseNormalizePeriod("2026-4"),
    /must use YYYY-MM format/,
  );
  assert.throws(
    () => parseNormalizePeriod("2026-13"),
    /month must be between 01 and 12/,
  );
});

test("parses optional normalizer start row filters", () => {
  assert.equal(parseNormalizeStartRow(""), 0);
  assert.equal(parseNormalizeStartRow("0"), 0);
  assert.equal(parseNormalizeStartRow("141528"), 141528);
  assert.equal(parseNormalizeStartRow(" 25 "), 25);

  assert.throws(
    () => parseNormalizeStartRow("12x"),
    /must be a non-negative integer/,
  );
  assert.throws(
    () => parseNormalizeStartRow("-1"),
    /must be a non-negative integer/,
  );
});

test("parses optional normalizer start flow filters", () => {
  assert.equal(parseNormalizeStartFlow(""), "export");
  assert.equal(parseNormalizeStartFlow("export"), "export");
  assert.equal(parseNormalizeStartFlow("import"), "import");

  assert.throws(
    () => parseNormalizeStartFlow("imports"),
    /must be export or import/,
  );
});

test("scopes normalizer resume rows to the active and remaining flows", () => {
  assert.equal(normalizeStartRowForFlow("export", "export", 0), 0);
  assert.equal(normalizeStartRowForFlow("import", "export", 0), 0);

  assert.equal(normalizeStartRowForFlow("export", "export", 141528), 141528);
  assert.equal(normalizeStartRowForFlow("import", "export", 141528), 0);

  assert.equal(normalizeStartRowForFlow("export", "import", 141528), null);
  assert.equal(normalizeStartRowForFlow("import", "import", 141528), 141528);
});
