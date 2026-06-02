import test from "node:test";
import assert from "node:assert/strict";

import {
  classifyTradeRecordPerformanceWarnings,
  parseTradeRecordSearchParams,
  shouldSkipTradeRecordComparison,
  TradeRecordSearchError,
} from "../../src/trade/trade-record-search";
import {
  buildTradeRecordSearchHref,
  filtersToTradeRecordSearchParams,
} from "../../src/trade/trade-record-links";
import {
  activeTradeRecordPresetId,
  buildTradeRecordPresetHref,
  tradeRecordPresets,
} from "../../src/trade/trade-record-presets";
import {
  buildTradeRecordRelatedGroupDefinitions,
  encodeTradeRecordCursor,
  type TradeRecordSummary,
} from "../../src/trade/trade-records";
import {
  formatPayloadRetainedReason,
  formatPayloadRetentionMode,
  formatPayloadStorageKind,
} from "../../src/trade/trade-record-provenance";

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

test("formats trade record provenance payload labels in Spanish", () => {
  assert.equal(
    formatPayloadRetentionMode("full_postgres"),
    "Completo en Postgres",
  );
  assert.equal(
    formatPayloadRetainedReason("pending_post_normalization_prune"),
    "Pendiente de poda posterior a normalización",
  );
  assert.equal(formatPayloadStorageKind("object_storage"), "Almacenamiento externo");
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

test("rejects invalid source and batch UUID filters", () => {
  assert.throws(
    () => parseTradeRecordSearchParams({ sourceFileId: "source-1" }),
    TradeRecordSearchError,
  );
  assert.throws(
    () => parseTradeRecordSearchParams({ importBatchId: "batch-1" }),
    TradeRecordSearchError,
  );

  assert.deepEqual(
    parseTradeRecordSearchParams({
      sourceFileId: "00000000-0000-4000-8000-0000000000AA",
      importBatchId: "00000000-0000-4000-8000-0000000000BB",
    }),
    {
      sourceFileId: "00000000-0000-4000-8000-0000000000aa",
      importBatchId: "00000000-0000-4000-8000-0000000000bb",
    },
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
        offset: "0",
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

test("skips comparison aggregation only for broad searches", () => {
  assert.equal(
    shouldSkipTradeRecordComparison({
      tradeFlow: "import",
      periodFrom: "2026-03",
      periodTo: "2026-03",
    }),
    true,
  );

  assert.equal(
    shouldSkipTradeRecordComparison({
      tradeFlow: "import",
      periodFrom: "2026-03",
      periodTo: "2026-03",
      hsCodePrefix: "020130",
    }),
    false,
  );

  assert.equal(
    shouldSkipTradeRecordComparison({
      tradeFlow: "export",
      periodFrom: "2026-03",
      periodTo: "2026-03",
      minItemValue: "1000",
    }),
    false,
  );
});

test("builds trade record drilldown links without pagination cursors", () => {
  const href = buildTradeRecordSearchHref(
    {
      tradeFlow: "import",
      periodFrom: "2026-03",
      periodTo: "2026-03",
      hsCodePrefix: "4011",
      sourceFileId: "source-1",
      importBatchId: "batch-1",
      originCountry: "336",
      limit: "25",
      after: "cursor",
      offset: "50",
    },
    { type: "country", code: "220" },
  );

  assert.equal(
    href,
    "/trade-records?tradeFlow=import&periodFrom=2026-03&periodTo=2026-03&sourceFileId=source-1&importBatchId=batch-1&hsCodePrefix=4011&originCountry=220&limit=25",
  );
});

test("maps export country drilldowns to destination country", () => {
  const href = buildTradeRecordSearchHref(
    {
      tradeFlow: "export",
      periodFrom: "2026-03",
      periodTo: "2026-03",
      originCountry: "336",
    },
    { type: "country", code: "840" },
  );

  assert.equal(
    href,
    "/trade-records?tradeFlow=export&periodFrom=2026-03&periodTo=2026-03&destinationCountry=840",
  );
});

test("converts related-record filters into search-link params", () => {
  assert.deepEqual(
    filtersToTradeRecordSearchParams({
      tradeFlow: "import",
      periodFrom: "2026-03",
      periodTo: "2026-03",
      sourceFileId: "source-1",
      importBatchId: "batch-1",
      hsCodePrefix: "220421",
      importerCorrelativeId: "10998",
      originCountryCode: "724",
      customsOfficeCode: "39",
      portCode: "906",
      limit: 25,
    }),
    {
      tradeFlow: "import",
      periodFrom: "2026-03",
      periodTo: "2026-03",
      sourceFileId: "source-1",
      importBatchId: "batch-1",
      hsCodePrefix: "220421",
      importer: "10998",
      originCountry: "724",
      customsOffice: "39",
      port: "906",
      limit: "25",
    },
  );
});

test("builds shareable trade record preset URLs with supported filters only", () => {
  assert.equal(
    buildTradeRecordPresetHref(tradeRecordPresets[0]),
    "/trade-records?tradeFlow=import&periodFrom=2026-03&periodTo=2026-03&minItemValue=50000&sort=item_value_desc&limit=25",
  );

  for (const preset of tradeRecordPresets) {
    const href = buildTradeRecordPresetHref(preset);
    const url = new URL(href, "https://duanera.test");
    const filters = parseTradeRecordSearchParams(url.searchParams);

    assert.equal(url.pathname, "/trade-records");
    assert.equal(url.searchParams.has("after"), false);
    assert.equal(url.searchParams.has("offset"), false);
    assert.equal(url.searchParams.has("importer"), false);
    assert.equal(url.searchParams.has("exporter"), false);
    assert.equal(filters.periodFrom, "2026-03");
    assert.equal(filters.periodTo, "2026-03");
    assert.ok(filters.tradeFlow === "import" || filters.tradeFlow === "export");
  }
});

test("matches active trade record presets only when filters are exact", () => {
  assert.equal(
    activeTradeRecordPresetId({
      tradeFlow: "import",
      periodFrom: "2026-03",
      periodTo: "2026-03",
      minItemValue: "50000",
      sort: "item_value_desc",
      limit: 25,
    }),
    "high-value-imports",
  );

  assert.equal(
    activeTradeRecordPresetId({
      tradeFlow: "import",
      periodFrom: "2026-03",
      periodTo: "2026-03",
      minItemValue: "50000",
      maxItemValue: "100000",
      sort: "item_value_desc",
      limit: 25,
    }),
    null,
  );
});

test("builds related-record group definitions from an import record", () => {
  const groups = buildTradeRecordRelatedGroupDefinitions(
    {
      id: "record-1",
      tradeFlow: "import",
      periodYear: 2026,
      periodMonth: 3,
      hsCodeNormalized: "220421",
      importerCorrelativeId: "10998",
      originCountryCode: "724",
      customsOfficeCode: "39",
      disembarkPortCode: "906",
    } as TradeRecordSummary,
    5,
  );

  assert.deepEqual(
    groups.map((group) => [group.key, group.filters]),
    [
      [
        "same_hs_flow",
        {
          tradeFlow: "import",
          periodFrom: "2026-03",
          periodTo: "2026-03",
          limit: 5,
          hsCodePrefix: "220421",
        },
      ],
      [
        "same_country_hs",
        {
          tradeFlow: "import",
          periodFrom: "2026-03",
          periodTo: "2026-03",
          limit: 5,
          hsCodePrefix: "220421",
          originCountryCode: "724",
        },
      ],
      [
        "same_participant",
        {
          tradeFlow: "import",
          periodFrom: "2026-03",
          periodTo: "2026-03",
          limit: 5,
          importerCorrelativeId: "10998",
        },
      ],
      [
        "same_customs_office",
        {
          tradeFlow: "import",
          periodFrom: "2026-03",
          periodTo: "2026-03",
          limit: 5,
          customsOfficeCode: "39",
        },
      ],
      [
        "same_relevant_port",
        {
          tradeFlow: "import",
          periodFrom: "2026-03",
          periodTo: "2026-03",
          limit: 5,
          portCode: "906",
        },
      ],
    ],
  );
});

test("builds export related-record groups with destination and embark port", () => {
  const groups = buildTradeRecordRelatedGroupDefinitions(
    {
      id: "record-2",
      tradeFlow: "export",
      periodYear: 2026,
      periodMonth: 3,
      hsCodeNormalized: "080610",
      exporterPrimaryCorrelativeId: "3904",
      destinationCountryCode: "840",
      customsOfficeCode: "34",
      embarkPortCode: "905",
    } as TradeRecordSummary,
    3,
  );

  assert.deepEqual(groups.find((group) => group.key === "same_country_hs")?.filters, {
    tradeFlow: "export",
    periodFrom: "2026-03",
    periodTo: "2026-03",
    limit: 3,
    hsCodePrefix: "080610",
    destinationCountryCode: "840",
  });
  assert.deepEqual(groups.find((group) => group.key === "same_participant")?.filters, {
    tradeFlow: "export",
    periodFrom: "2026-03",
    periodTo: "2026-03",
    limit: 3,
    exporterCorrelativeId: "3904",
  });
  assert.deepEqual(groups.find((group) => group.key === "same_relevant_port")?.filters, {
    tradeFlow: "export",
    periodFrom: "2026-03",
    periodTo: "2026-03",
    limit: 3,
    portCode: "905",
  });
});
