import test from "node:test";
import assert from "node:assert/strict";

import {
  parseTradeRecordSearchParams,
  TradeRecordSearchError,
} from "../../src/trade/trade-record-search";
import { encodeTradeRecordCursor } from "../../src/trade/trade-records";

test("parses route-style trade search params", () => {
  const params = new URLSearchParams({
    tradeFlow: "import",
    periodFrom: "2026-03",
    periodTo: "2026-03",
    hsCodePrefix: "8523",
    q: "tarjetas",
    importer: "10998",
    originCountry: "336 · México",
    customsOffice: "39",
    transportMode: "1 · MARÍTIMA, FLUVIAL Y LACUSTRE",
    port: "906",
    limit: "25",
    offset: "10",
  });

  assert.deepEqual(parseTradeRecordSearchParams(params), {
    tradeFlow: "import",
    periodFrom: "2026-03",
    periodTo: "2026-03",
    hsCodePrefix: "8523",
    productQuery: "tarjetas",
    importerCorrelativeId: "10998",
    originCountryCode: "336",
    customsOfficeCode: "39",
    transportModeCode: "1",
    portCode: "906",
    limit: 25,
    offset: 10,
  });
});

test("ignores blank params", () => {
  assert.deepEqual(
    parseTradeRecordSearchParams({
      tradeFlow: "export",
      q: " ",
      limit: "",
    }),
    {
      tradeFlow: "export",
    },
  );
});

test("rejects invalid trade flow", () => {
  assert.throws(
    () => parseTradeRecordSearchParams({ tradeFlow: "both" }),
    TradeRecordSearchError,
  );
});

test("rejects invalid period and month values", () => {
  assert.throws(
    () => parseTradeRecordSearchParams({ periodFrom: "2026-13" }),
    TradeRecordSearchError,
  );
  assert.throws(
    () => parseTradeRecordSearchParams({ periodMonth: "13" }),
    TradeRecordSearchError,
  );
});

test("parses cursor params", () => {
  const after = encodeTradeRecordCursor({
    rawRowNumber: 100000,
    rawTradeRowId: "00000000-0000-4000-8000-000000000001",
  });

  assert.deepEqual(
    parseTradeRecordSearchParams({
      tradeFlow: "import",
      periodFrom: "2026-03",
      periodTo: "2026-03",
      after,
    }),
    {
      tradeFlow: "import",
      periodFrom: "2026-03",
      periodTo: "2026-03",
      afterCursor: {
        rawRowNumber: 100000,
        rawTradeRowId: "00000000-0000-4000-8000-000000000001",
      },
    },
  );
});

test("rejects unsupported cursor filters", () => {
  const after = encodeTradeRecordCursor({
    rawRowNumber: 100000,
    rawTradeRowId: "00000000-0000-4000-8000-000000000001",
  });

  assert.throws(
    () =>
      parseTradeRecordSearchParams({
        tradeFlow: "import",
        periodFrom: "2026-03",
        periodTo: "2026-03",
        q: "motor",
        after,
      }),
    TradeRecordSearchError,
  );
  assert.throws(
    () => parseTradeRecordSearchParams({ tradeFlow: "import", after }),
    TradeRecordSearchError,
  );
});

test("rejects invalid cursor usage", () => {
  assert.throws(
    () => parseTradeRecordSearchParams({ after: "bad-cursor" }),
    TradeRecordSearchError,
  );
  assert.throws(
    () =>
      parseTradeRecordSearchParams({
        tradeFlow: "import",
        periodFrom: "2026-03",
        periodTo: "2026-03",
        after: encodeTradeRecordCursor({
          rawRowNumber: 100000,
          rawTradeRowId: "00000000-0000-4000-8000-000000000001",
        }),
        offset: "25",
      }),
    TradeRecordSearchError,
  );
});
