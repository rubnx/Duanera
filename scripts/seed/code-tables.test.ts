import assert from "node:assert/strict";
import test from "node:test";

import { filterSeedRowsForPreservedValues } from "./code-tables";

test("keeps reviewed code values out of workbook reseed inserts", () => {
  const rows = [
    { codeValue: "817", labelEs: "Workbook Puerto Cabo Froward" },
    { codeValue: "818", labelEs: "Muelle Huachipato" },
    { codeValue: "999", labelEs: "Seeded value" },
  ];

  const result = filterSeedRowsForPreservedValues(rows, new Set(["817", "818"]));

  assert.deepEqual(result, [{ codeValue: "999", labelEs: "Seeded value" }]);
});

test("allows workbook rows when no reviewed value owns the code", () => {
  const rows = [
    { codeValue: "1", labelEs: "A" },
    { codeValue: "2", labelEs: "B" },
  ];

  assert.deepEqual(filterSeedRowsForPreservedValues(rows, new Set(["3"])), rows);
});
