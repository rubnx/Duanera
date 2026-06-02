import { Buffer } from "node:buffer";
import test from "node:test";
import assert from "node:assert/strict";

import {
  decodeAduanaBuffer,
  normalizeHsCode,
  parseAduanaDate,
  parseDelimitedLine,
  parseAduanaRow,
  parseDecimalComma,
  rowHashSha256,
} from "../../src/ingest/aduana-main-file";

test("maps import rows with 178 fields", () => {
  const fieldNames = Array.from({ length: 178 }, (_, index) => `F${index + 1}`);
  const rawText = fieldNames.map((_, index) => String(index + 1)).join(";");
  const parsed = parseAduanaRow(rawText, 1, fieldNames);

  assert.equal(parsed.fieldCount, 178);
  assert.equal(parsed.rawValues.F1, "1");
  assert.equal(parsed.rawValues.F178, "178");
  assert.deepEqual(parsed.parseErrors, []);
});

test("maps export rows with 84 fields", () => {
  const fieldNames = Array.from({ length: 84 }, (_, index) => `F${index + 1}`);
  const rawText = fieldNames.map((_, index) => String(index + 1)).join(";");
  const parsed = parseAduanaRow(rawText, 1, fieldNames);

  assert.equal(parsed.fieldCount, 84);
  assert.equal(parsed.rawValues.F84, "84");
  assert.deepEqual(parsed.parseErrors, []);
});

test("reports wrong field count", () => {
  const parsed = parseAduanaRow("a;b", 1, ["A", "B", "C"]);

  assert.equal(parsed.fieldCount, 2);
  assert.deepEqual(parsed.parseErrors, ["Expected 3 fields, got 2 fields."]);
});

test("parses semicolon-delimited source lines without trimming fields", () => {
  assert.deepEqual(parseDelimitedLine(" a ;b;;c "), [" a ", "b", "", "c "]);
});

test("parses decimal comma values", () => {
  assert.equal(parseDecimalComma("1.234,56"), 1234.56);
  assert.equal(parseDecimalComma("46,08"), 46.08);
  assert.equal(parseDecimalComma(""), null);
});

test("decodes Windows-1252 text", () => {
  const decoded = decodeAduanaBuffer(Buffer.from([0x43, 0x41, 0x4d, 0x49, 0xd3, 0x4e]));

  assert.equal(decoded, "CAMIÓN");
});

test("normalizes dates and hs codes", () => {
  assert.equal(parseAduanaDate("05032026"), "2026-03-05");
  assert.equal(parseAduanaDate("00000000"), null);
  assert.equal(normalizeHsCode("4011.10.00"), "40111000");
});

test("hashes are stable", () => {
  assert.equal(rowHashSha256("a;b;c"), rowHashSha256("a;b;c"));
  assert.notEqual(rowHashSha256("a;b;c"), rowHashSha256("a;b;d"));
});
