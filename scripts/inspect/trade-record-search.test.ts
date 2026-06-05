import test from "node:test";
import assert from "node:assert/strict";
import { PgDialect } from "drizzle-orm/pg-core";

import {
  classifyTradeRecordPerformanceWarnings,
  parseTradeRecordSearchParams,
  shouldSkipTradeRecordComparison,
  shouldSkipTradeRecordSummary,
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
  formatTradeRecordPeriodScope,
  formatTradeRecordPeriodValue,
  latestProductTradeRecordPeriod,
} from "../../src/trade/trade-record-periods";
import {
  formatTradeRecordPeriodLabel,
  formatTradeRecordPeriodRangeLabel,
  tradeRecordLoadedYearRange,
} from "../../src/trade/trade-record-period-labels";
import {
  parseTradeRecordTableView,
  tradeRecordTableViews,
} from "../../src/trade/trade-record-table-views";
import { sourceOrderedRawListSegments } from "../../src/trade/trade-record-ordering";
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
import {
  buildTradeRecordWhere,
  escapeLikePattern,
  productFacingTradeRecordWhere,
} from "../../src/trade/trade-record-where";
import { publicSearchTerms } from "../../src/text/public-text";

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
    disembarkPort: "906",
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
    originCountryCodes: ["336"],
    customsOfficeCode: "39",
    transportModeCode: "1",
    disembarkPortCode: "906",
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

test("ignores legacy relevant-port search param", () => {
  assert.deepEqual(
    parseTradeRecordSearchParams({
      tradeFlow: "import",
      port: "906",
      periodFrom: "2026-03",
      periodTo: "2026-03",
    }),
    {
      tradeFlow: "import",
      periodFrom: "2026-03",
      periodTo: "2026-03",
    },
  );
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

test("parses multi-country search params from comma and repeated values", () => {
  const params = new URLSearchParams();
  params.set("tradeFlow", "import");
  params.set("originCountry", "156 · China, 356 · India");
  params.append("originCountry", "604 · Perú");

  assert.deepEqual(parseTradeRecordSearchParams(params), {
    tradeFlow: "import",
    originCountryCode: "156",
    originCountryCodes: ["156", "356", "604"],
  });

  assert.deepEqual(
    parseTradeRecordSearchParams({
      tradeFlow: "export",
      destinationCountry: ["156", "356", "156"],
    }),
    {
      tradeFlow: "export",
      destinationCountryCode: "156",
      destinationCountryCodes: ["156", "356"],
    },
  );
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

test("normalizes product search accents to match stored search text", () => {
  assert.equal(
    parseTradeRecordSearchParams({ q: "Confección de Tapicería" }).productQuery,
    "confeccion de tapiceria",
  );
  assert.equal(
    parseTradeRecordSearchParams({ q: "confeccion de tapiceria" }).productQuery,
    "confeccion de tapiceria",
  );
  assert.equal(
    parseTradeRecordSearchParams({ q: "  POLIÉSTER   SINTÉTICO  " }).productQuery,
    "poliester sintetico",
  );
});

test("splits product search into useful accent-free terms", () => {
  assert.deepEqual(publicSearchTerms("Confección de Tapicería"), [
    "confeccion",
    "tapiceria",
  ]);
  assert.deepEqual(publicSearchTerms("  POLIÉSTER   SINTÉTICO  "), [
    "poliester",
    "sintetico",
  ]);
  assert.deepEqual(publicSearchTerms("de para con"), ["de", "para", "con"]);
  assert.deepEqual(publicSearchTerms("YFELPA2 100%_ALGODON"), [
    "yfelpa2",
    "100%_algodon",
  ]);
});

test("escapes product search sql wildcard characters", () => {
  assert.equal(escapeLikePattern("100%_algodon"), "100\\%\\_algodon");
  assert.equal(escapeLikePattern("a\\b"), "a\\\\b");
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
  assert.throws(
    () => parseTradeRecordSearchParams({ periodMonth: "0" }),
    TradeRecordSearchError,
  );
});

test("parses pagination integers with strict positive limits and zero offset", () => {
  assert.equal(parseTradeRecordSearchParams({ offset: "0" }).offset, 0);
  assert.throws(
    () => parseTradeRecordSearchParams({ limit: "0" }),
    TradeRecordSearchError,
  );
  assert.throws(
    () => parseTradeRecordSearchParams({ offset: "-1" }),
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

test("parses all supported table sort values", () => {
  const sortValues = [
    "source",
    "item_value_desc",
    "item_value_asc",
    "declaration_fob_desc",
    "declaration_fob_asc",
    "quantity_desc",
    "quantity_asc",
    "gross_weight_desc",
    "gross_weight_asc",
  ];

  for (const sort of sortValues) {
    assert.equal(parseTradeRecordSearchParams({ sort }).sort, sort);
  }
});

test("parses trade record table views with a commercial fallback", () => {
  assert.equal(parseTradeRecordTableView(undefined), "commercial");
  assert.equal(parseTradeRecordTableView("values"), "values");
  assert.equal(parseTradeRecordTableView("logistics"), "logistics");
  assert.equal(parseTradeRecordTableView("product"), "product");
  assert.equal(parseTradeRecordTableView("provenance"), "provenance");
  assert.equal(parseTradeRecordTableView("raw"), "commercial");
  assert.deepEqual(
    tradeRecordTableViews.map((view) => view.id),
    ["commercial", "values", "logistics", "product", "provenance"],
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
        logisticsRole: "carrier",
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
  assert.throws(
    () =>
      parseTradeRecordSearchParams({
        after: encodeTradeRecordCursor({
          rawRowNumber: 0,
          rawTradeRowId: "00000000-0000-4000-8000-000000000001",
        }),
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

  assert.deepEqual(
    classifyTradeRecordPerformanceWarnings({
      filters: {
        periodFrom: "2025-12",
        periodTo: "2026-04",
      },
      pagination: {
        paginationMode: "offset",
        total: 2545196,
      },
      summaryMs: 0,
      summaryBounded: true,
    }).map((warning) => warning.code),
    ["offset_pagination", "broad_result_set", "summary_bounded"],
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

test("bounds summary aggregation only for unfiltered multi-period searches", () => {
  assert.equal(
    shouldSkipTradeRecordSummary({
      tradeFlow: "import",
      periodFrom: "2026-04",
      periodTo: "2026-04",
    }),
    false,
  );

  assert.equal(
    shouldSkipTradeRecordSummary({
      periodFrom: "2025-12",
      periodTo: "2026-04",
    }),
    true,
  );

  assert.equal(
    shouldSkipTradeRecordSummary({
      periodFrom: "2025-12",
      periodTo: "2026-04",
      hsCodePrefix: "8471",
    }),
    false,
  );
});

test("builds source-ordered raw list segments newest period and export first", () => {
  assert.deepEqual(
    sourceOrderedRawListSegments({
      periodFrom: "2025-12",
      periodTo: "2026-02",
    }),
    [
      { tradeFlow: "export", year: 2026, month: 2, value: "2026-02" },
      { tradeFlow: "import", year: 2026, month: 2, value: "2026-02" },
      { tradeFlow: "export", year: 2026, month: 1, value: "2026-01" },
      { tradeFlow: "import", year: 2026, month: 1, value: "2026-01" },
      { tradeFlow: "export", year: 2025, month: 12, value: "2025-12" },
      { tradeFlow: "import", year: 2025, month: 12, value: "2025-12" },
    ],
  );

  assert.deepEqual(
    sourceOrderedRawListSegments({
      tradeFlow: "import",
      periodFrom: "2025-12",
      periodTo: "2026-01",
      productQuery: "textiles",
    }),
    [],
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
      view: "logistics",
      after: "cursor",
      offset: "50",
    },
    { type: "country", code: "220" },
  );

  assert.equal(
    href,
    "/trade-records?tradeFlow=import&periodFrom=2026-03&periodTo=2026-03&hsCodePrefix=4011&originCountry=220&limit=25&view=logistics",
  );

  assert.equal(
    buildTradeRecordSearchHref({
      sourceFileId: "00000000-0000-4000-8000-0000000000AA",
      importBatchId: "00000000-0000-4000-8000-0000000000BB",
    }),
    "/trade-records?sourceFileId=00000000-0000-4000-8000-0000000000aa&importBatchId=00000000-0000-4000-8000-0000000000bb",
  );

  assert.equal(
    buildTradeRecordSearchHref({
      tradeFlow: "import",
      port: "906",
      embarkPort: "905",
      disembarkPort: "906",
    }),
    "/trade-records?tradeFlow=import&embarkPort=905&disembarkPort=906",
  );
});

test("builds trade record view links with safe view params only", () => {
  assert.equal(
    buildTradeRecordSearchHref({
      tradeFlow: "export",
      periodFrom: "2026-04",
      periodTo: "2026-04",
      view: "provenance",
      after: "stale-cursor",
      offset: "25",
    }),
    "/trade-records?tradeFlow=export&periodFrom=2026-04&periodTo=2026-04&view=provenance",
  );

  assert.equal(
    buildTradeRecordSearchHref({
      tradeFlow: "export",
      periodFrom: "2026-04",
      periodTo: "2026-04",
      view: "raw",
    }),
    "/trade-records?tradeFlow=export&periodFrom=2026-04&periodTo=2026-04",
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
      disembarkPortCode: "906",
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
      disembarkPort: "906",
      limit: "25",
    },
  );
});

test("serializes multi-country filters into shareable search params", () => {
  assert.deepEqual(
    filtersToTradeRecordSearchParams({
      tradeFlow: "import",
      periodFrom: "2026-04",
      periodTo: "2026-04",
      originCountryCode: "156",
      originCountryCodes: ["156", "356"],
    }),
    {
      tradeFlow: "import",
      periodFrom: "2026-04",
      periodTo: "2026-04",
      originCountry: "156,356",
    },
  );

  assert.equal(
    buildTradeRecordSearchHref({
      tradeFlow: "import",
      originCountry: ["156", "356"],
    }),
    "/trade-records?tradeFlow=import&originCountry=156%2C356",
  );
});

test("builds shareable trade record preset URLs with supported filters only", () => {
  const defaultPeriod = {
    periodFrom: "2026-04",
    periodTo: "2026-04",
  };

  assert.equal(
    buildTradeRecordPresetHref(tradeRecordPresets[0], defaultPeriod),
    "/trade-records?tradeFlow=import&periodFrom=2026-04&periodTo=2026-04&minItemValue=50000&sort=item_value_desc&limit=25",
  );

  for (const preset of tradeRecordPresets) {
    const href = buildTradeRecordPresetHref(preset, defaultPeriod);
    const url = new URL(href, "https://duanera.test");
    const filters = parseTradeRecordSearchParams(url.searchParams);

    assert.equal(url.pathname, "/trade-records");
    assert.equal(url.searchParams.has("after"), false);
    assert.equal(url.searchParams.has("offset"), false);
    assert.equal(url.searchParams.has("importer"), false);
    assert.equal(url.searchParams.has("exporter"), false);
    assert.equal(filters.periodFrom, "2026-04");
    assert.equal(filters.periodTo, "2026-04");
    assert.ok(filters.tradeFlow === "import" || filters.tradeFlow === "export");
  }
});

test("matches active trade record presets only when filters are exact", () => {
  const defaultPeriod = {
    periodFrom: "2026-04",
    periodTo: "2026-04",
  };

  assert.equal(
    activeTradeRecordPresetId(
      {
        tradeFlow: "import",
        periodFrom: "2026-04",
        periodTo: "2026-04",
        minItemValue: "50000",
        sort: "item_value_desc",
        limit: 25,
      },
      defaultPeriod,
    ),
    "high-value-imports",
  );

  assert.equal(
    activeTradeRecordPresetId(
      {
        tradeFlow: "import",
        periodFrom: "2026-04",
        periodTo: "2026-04",
        minItemValue: "50000",
        maxItemValue: "100000",
        sort: "item_value_desc",
        limit: 25,
      },
      defaultPeriod,
    ),
    null,
  );
});

test("formats trade record period values and loaded scope labels", () => {
  assert.equal(formatTradeRecordPeriodValue(2026, 4), "2026-04");
  assert.equal(formatTradeRecordPeriodLabel("2026-04"), "Abr 2026");
  assert.equal(formatTradeRecordPeriodRangeLabel("2026-04", "2026-04"), "Abr 2026");
  assert.equal(
    formatTradeRecordPeriodRangeLabel("2026-02", "2026-03"),
    "Feb 2026 → Mar 2026",
  );
  assert.equal(formatTradeRecordPeriodRangeLabel("2025-01", "2025-12"), "Todo 2025");
  assert.deepEqual(
    tradeRecordLoadedYearRange(["2025-06", "2025-07", "2025-12"], 2025),
    { isCompleteYear: false, periodFrom: "2025-06", periodTo: "2025-12" },
  );
  assert.deepEqual(
    tradeRecordLoadedYearRange(
      Array.from({ length: 12 }, (_, index) =>
        formatTradeRecordPeriodValue(2024, index + 1),
      ),
      2024,
    ),
    { isCompleteYear: true, periodFrom: "2024-01", periodTo: "2024-12" },
  );
  assert.equal(formatTradeRecordPeriodScope([]), "Sin períodos cargados");
  assert.equal(
    formatTradeRecordPeriodScope([
      { year: 2026, month: 4, value: "2026-04", records: 1 },
      { year: 2026, month: 3, value: "2026-03", records: 1 },
    ]),
    "2026-03 a 2026-04",
  );
});

test("selects the latest product-facing period without future test data", () => {
  const referenceDate = new Date("2026-06-03T00:00:00.000Z");
  const periods = [
    {
      year: 2099,
      month: 1,
      value: "2099-01",
      records: 1,
      sourceCategory: "test",
    },
    {
      year: 2026,
      month: 4,
      value: "2026-04",
      records: 408027,
      sourceCategory: "dataset_resource",
    },
    {
      year: 2027,
      month: 1,
      value: "2027-01",
      records: 10,
      sourceCategory: "dataset_resource",
    },
    {
      year: 2026,
      month: 3,
      value: "2026-03",
      records: 439353,
      sourceCategory: "dataset_resource",
    },
  ];

  assert.equal(
    latestProductTradeRecordPeriod(periods, { referenceDate })?.value,
    "2026-04",
  );
});

test("keeps internal period candidates available outside product-facing selection", () => {
  const referenceDate = new Date("2026-06-03T00:00:00.000Z");
  const periods = [
    {
      year: 2099,
      month: 1,
      value: "2099-01",
      records: 1,
      sourceCategory: "test",
    },
    {
      year: 2026,
      month: 4,
      value: "2026-04",
      records: 408027,
      sourceCategory: "dataset_resource",
    },
  ];

  assert.equal(periods.some((period) => period.value === "2099-01"), true);
  assert.equal(
    [...periods].sort((a, b) => b.value.localeCompare(a.value))[0]?.value,
    "2099-01",
  );
  assert.equal(
    latestProductTradeRecordPeriod(periods, { referenceDate })?.value,
    "2026-04",
  );
});

test("builds product-facing trade record predicates without changing generic queries", () => {
  const dialect = new PgDialect();
  const genericWhere = buildTradeRecordWhere({});
  const productFacingWhere = buildTradeRecordWhere(
    {},
    { productFacing: true, referenceDate: new Date("2026-06-03T00:00:00.000Z") },
  );
  const rendered = dialect.sqlToQuery(
    productFacingTradeRecordWhere({
      referenceDate: new Date("2026-06-03T00:00:00.000Z"),
    }),
  );

  assert.equal(genericWhere, undefined);
  assert.ok(productFacingWhere);
  assert.match(rendered.sql, /from "source_files"/);
  assert.match(rendered.sql, /source_category/);
  assert.match(
    rendered.sql,
    /not in \('test', 'internal', 'qa', 'smoke', 'fixture'\)/,
  );
  assert.match(rendered.sql, /period_year", "trade_records"."period_month/);
  assert.deepEqual(rendered.params, [2021, 1, 2026, 6]);
});

test("builds product search predicates for every useful word", () => {
  const dialect = new PgDialect();
  const where = buildTradeRecordWhere({
    productQuery: "confeccion de tapiceria 100%_algodon",
  });

  assert.ok(where);

  const rendered = dialect.sqlToQuery(where);
  const ilikeCount = rendered.sql.match(/product_search_text" ilike/g)?.length ?? 0;

  assert.equal(ilikeCount, 3);
  assert.equal(rendered.sql.match(/ escape /g)?.length ?? 0, 3);
  assert.deepEqual(rendered.params, [
    "%confeccion%",
    "%tapiceria%",
    "%100\\%\\_algodon%",
  ]);
});

test("builds OR predicates inside multi-country filters", () => {
  const dialect = new PgDialect();
  const where = buildTradeRecordWhere({
    tradeFlow: "import",
    hsCodePrefix: "5407",
    originCountryCodes: ["156", "356"],
  });

  assert.ok(where);

  const rendered = dialect.sqlToQuery(where);
  assert.match(rendered.sql, /origin_country_code" in \(\$3, \$4\)/);
  assert.deepEqual(rendered.params, ["import", "5407%", "156", "356"]);
});

test("keeps phrase-only product searches compatible when no strong words exist", () => {
  const dialect = new PgDialect();
  const where = buildTradeRecordWhere({ productQuery: "de para con" });

  assert.ok(where);

  const rendered = dialect.sqlToQuery(where);
  assert.deepEqual(rendered.params, ["%de%", "%para%", "%con%"]);
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
          disembarkPortCode: "906",
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
    embarkPortCode: "905",
  });
});
