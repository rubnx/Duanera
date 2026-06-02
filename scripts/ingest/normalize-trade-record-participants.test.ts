import assert from "node:assert/strict";
import test from "node:test";

import { uniqueParticipantIds } from "./normalize-trade-record-participants";

test("dedupes participant ids before refreshing stats", () => {
  assert.deepEqual(
    uniqueParticipantIds([
      {
        id: "participant-a",
        count: 1,
        firstSeenYear: 2026,
        firstSeenMonth: 3,
        lastSeenYear: 2026,
        lastSeenMonth: 3,
      },
      {
        id: "participant-b",
        count: 1,
        firstSeenYear: 2026,
        firstSeenMonth: 4,
        lastSeenYear: 2026,
        lastSeenMonth: 4,
      },
      {
        id: "participant-a",
        count: 2,
        firstSeenYear: 2026,
        firstSeenMonth: 4,
        lastSeenYear: 2026,
        lastSeenMonth: 4,
      },
    ]),
    ["participant-a", "participant-b"],
  );
});
