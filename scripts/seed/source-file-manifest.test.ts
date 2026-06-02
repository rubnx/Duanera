import assert from "node:assert/strict";
import test from "node:test";

import {
  parseManifestInteger,
  parseManifestMonth,
  periodDate,
} from "./source-file-manifest";

test("parses manifest integers strictly", () => {
  assert.equal(parseManifestInteger({ fieldName: "year", value: "2026" }), 2026);
  assert.equal(parseManifestInteger({ fieldName: "raw_file_size", value: " 123 " }), 123);
  assert.equal(parseManifestInteger({ fieldName: "year", value: "" }), null);
  assert.equal(parseManifestInteger({ fieldName: "year", value: "unknown" }), null);

  assert.throws(
    () => parseManifestInteger({ fieldName: "year", value: "2026x" }),
    /year must be an integer/,
  );
  assert.throws(
    () => parseManifestInteger({ fieldName: "raw_file_size", value: "1.5" }),
    /raw_file_size must be an integer/,
  );
});

test("validates manifest months", () => {
  assert.equal(parseManifestMonth("03"), 3);
  assert.equal(parseManifestMonth("unknown"), null);

  assert.throws(() => parseManifestMonth("0"), /month must be between 1 and 12/);
  assert.throws(() => parseManifestMonth("13"), /month must be between 1 and 12/);
  assert.throws(() => parseManifestMonth("03x"), /month must be an integer/);
});

test("formats source manifest period boundaries", () => {
  assert.equal(periodDate(2026, 3, "start"), "2026-03-01");
  assert.equal(periodDate(2026, 3, "end"), "2026-03-31");
  assert.equal(periodDate(2026, null, "start"), "2026-01-01");
  assert.equal(periodDate(2026, null, "end"), "2026-12-31");
  assert.equal(periodDate(null, null, "start"), null);
});
