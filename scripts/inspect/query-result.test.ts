import assert from "node:assert/strict";
import test from "node:test";

import { queryResultRows } from "../../src/db/query-result";

test("returns rows from raw database query results", () => {
  const rows = queryResultRows<{ id: string }>({
    rows: [{ id: "row-1" }],
  });

  assert.deepEqual(rows, [{ id: "row-1" }]);
});

test("rejects malformed raw database query results", () => {
  assert.throws(
    () => queryResultRows(null, "test query"),
    /test query must be an object with a rows array/,
  );
  assert.throws(
    () => queryResultRows({ rows: undefined }, "test query"),
    /test query rows must be an array/,
  );
  assert.throws(
    () => queryResultRows({ rows: {} }, "test query"),
    /test query rows must be an array/,
  );
});
