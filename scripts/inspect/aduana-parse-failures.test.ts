import test from "node:test";
import assert from "node:assert/strict";

import {
  classifyParseFailure,
  classificationLabel,
  classifyRecommendation,
  combinedAdjacentFieldCount,
} from "./aduana-parse-failures";

test("classifies export split-line segments", () => {
  assert.equal(
    classifyParseFailure({
      tradeFlow: "export",
      fieldCount: 19,
      parseErrors: '["Expected 84 fields, got 19 fields."]',
    }),
    "export_split_line_segment",
  );

  assert.equal(
    classifyParseFailure({
      tradeFlow: "export",
      fieldCount: 66,
      parseErrors: '["Expected 84 fields, got 66 fields."]',
    }),
    "export_split_line_segment",
  );
});

test("classifies export short records separately from split-line segments", () => {
  assert.equal(
    classifyParseFailure({
      tradeFlow: "export",
      fieldCount: 63,
      parseErrors: '["Expected 84 fields, got 63 fields."]',
    }),
    "export_short_record",
  );
});

test("classifies January import short records", () => {
  for (const fieldCount of [135, 136, 137]) {
    assert.equal(
      classifyParseFailure({
        tradeFlow: "import",
        fieldCount,
        parseErrors: `["Expected 178 fields, got ${fieldCount} fields."]`,
      }),
      "import_short_record",
    );
  }
});

test("falls back to unknown for unrecognized shapes", () => {
  assert.equal(
    classifyParseFailure({
      tradeFlow: "import",
      fieldCount: 70,
      parseErrors: '["Expected 178 fields, got 70 fields."]',
    }),
    "unknown_field_count",
  );
});

test("labels and recommendations are stable for report output", () => {
  assert.equal(
    classificationLabel("export_split_line_segment"),
    "Export split-line segment",
  );
  assert.match(
    classifyRecommendation("export_split_line_segment"),
    /recoverable later/,
  );
  assert.match(classifyRecommendation("unknown_field_count"), /Stop and inspect/);
});

test("detects that adjacent split-line export segments can combine to 84 fields", () => {
  const first = Array.from({ length: 19 }, (_, index) => `a${index + 1}`).join(";");
  const second = `;${Array.from({ length: 65 }, (_, index) => `b${index + 1}`).join(";")}`;

  assert.equal(combinedAdjacentFieldCount(first, second), 84);
});
