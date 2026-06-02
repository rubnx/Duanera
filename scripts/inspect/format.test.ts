import assert from "node:assert/strict";
import test from "node:test";

import {
  formatIntegerEsCl,
  formatNullableIntegerEsCl,
  formatPercentEsCl,
} from "../../src/lib/format";

test("formats integers with es-CL separators", () => {
  assert.equal(formatIntegerEsCl(1234567), "1.234.567");
  assert.equal(formatNullableIntegerEsCl(null), "No informado");
  assert.equal(formatNullableIntegerEsCl(undefined, "Sin dato"), "Sin dato");
});

test("formats percentages without unnecessary decimal places", () => {
  assert.equal(formatPercentEsCl(10), "10");
  assert.equal(formatPercentEsCl(10.5), "10,5");
});
