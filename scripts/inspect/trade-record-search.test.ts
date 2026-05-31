import test from "node:test";
import assert from "node:assert/strict";

import {
  classifyTradeRecordPerformanceWarnings,
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
    minItemValue: "1000,50",
    maxItemValue: "50000.75",
    minDeclarationFob: "100",
    maxDeclarationFob: "90000",
    minQuantity: "2",
    maxQuantity: "100",
    minGrossWeightItem: "1",
    maxGrossWeightItem: "200",
    minGrossWeightTotal: "10",
    maxGrossWeightTotal: "1000",
    sort: "item_value_desc",
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
    minItemValue: "1000.50",
    maxItemValue: "50000.75",
    minDeclarationFob: "100",
    maxDeclarationFob: "90000",
    minQuantity: "2",
    maxQuantity: "100",
    minGrossWeightItem: "1",
    maxGrossWeightItem: "200",
    minGrossWeightTotal: "10",
    maxGrossWeightTotal: "1000",
    sort: "item_value_desc",
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

test("rejects invalid numeric filters and ranges", () => {
  assert.throws(
    () => parseTradeRecordSearchParams({ minItemValue: "-1" }),
    TradeRecordSearchError,
  );
  assert.throws(
    () => parseTradeRecordSearchParams({ minQuantity: "abc" }),
    TradeRecordSearchError,
  );
  assert.throws(
    () => parseTradeRecordSearchParams({ minItemValue: "20", maxItemValue: "10" }),
    TradeRecordSearchError,
  );
});

test("rejects unsupported sort values", () => {
  assert.throws(
    () => parseTradeRecordSearchParams({ sort: "company_name" }),
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
      sort: "source",
      after,
    }),
    {
      tradeFlow: "import",
      periodFrom: "2026-03",
      periodTo: "2026-03",
      sort: "source",
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
    () =>
      parseTradeRecordSearchParams({
        tradeFlow: "import",
        periodFrom: "2026-03",
        periodTo: "2026-03",
        minItemValue: "1000",
        after,
      }),
    TradeRecordSearchError,
  );
  assert.throws(
    () =>
      parseTradeRecordSearchParams({
        tradeFlow: "import",
        periodFrom: "2026-03",
        periodTo: "2026-03",
        sort: "item_value_desc",
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

test("classifies trade search performance warnings", () => {
  assert.deepEqual(
    classifyTradeRecordPerformanceWarnings({
      filters: {
        tradeFlow: "import",
        periodFrom: "2026-03",
        periodTo: "2026-03",
        hsCodePrefix: "4011",
      },
      pagination: {
        paginationMode: "cursor",
        total: 1000,
      },
      summaryMs: 100,
    }),
    [],
  );

  assert.deepEqual(
    classifyTradeRecordPerformanceWarnings({
      filters: {
        tradeFlow: "import",
        periodFrom: "2026-03",
        periodTo: "2026-03",
      },
      pagination: {
        paginationMode: "cursor",
        total: 439353,
      },
      summaryMs: 100,
    }).map((warning) => warning.code),
    ["broad_result_set"],
  );

  assert.deepEqual(
    classifyTradeRecordPerformanceWarnings({
      filters: {
        tradeFlow: "export",
        periodFrom: "2026-03",
        periodTo: "2026-03",
        minQuantity: "10",
        sort: "quantity_desc",
      },
      pagination: {
        paginationMode: "offset",
        total: 25834,
      },
      summaryMs: 1500,
    }).map((warning) => warning.code),
    ["offset_pagination", "slow_summary"],
  );
});
