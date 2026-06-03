import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildTradeRecordExportCsv,
  buildTradeRecordExportHref,
  createTradeRecordExportPlan,
  csvSafeCell,
  hasTradeRecordExportExactPeriod,
  hasTradeRecordExportNarrowingFilter,
  sanitizeTradeRecordExportInput,
  tradeRecordExportColumnsForView,
  tradeRecordExportIdentityWarning,
  tradeRecordExportRowCap,
} from "../../src/trade/trade-record-export";
import type { TradeRecordFilters } from "../../src/trade/trade-records";

const safeFilters: TradeRecordFilters = {
  tradeFlow: "import",
  periodFrom: "2026-04",
  periodTo: "2026-04",
  hsCodePrefix: "2204",
};

describe("trade record export policy", () => {
  it("allows exact-month narrowed exports within the row cap", () => {
    const plan = createTradeRecordExportPlan({
      filters: safeFilters,
      totalRows: tradeRecordExportRowCap,
      view: "commercial",
    });

    assert.equal(plan.allowed, true);
    assert.equal(plan.estimatedRows, tradeRecordExportRowCap);
    assert.equal(plan.fileName, "duanera-registros-import-2026-04-commercial.csv");
    assert.deepEqual(
      plan.warnings.map((warning) => warning.code),
      [],
    );
    assert.ok(plan.caveats.includes(tradeRecordExportIdentityWarning));
  });

  it("blocks broad exports even when flow and period are present", () => {
    const plan = createTradeRecordExportPlan({
      filters: {
        tradeFlow: "export",
        periodFrom: "2026-04",
        periodTo: "2026-04",
      },
      totalRows: 100,
      view: "logistics",
    });

    assert.equal(plan.allowed, false);
    assert.deepEqual(
      plan.warnings.map((warning) => warning.code),
      ["broad_query"],
    );
  });

  it("supports blocked preview plans without counting broad result sets", () => {
    const plan = createTradeRecordExportPlan({
      filters: {
        tradeFlow: "export",
        periodFrom: "2026-04",
        periodTo: "2026-04",
      },
      totalRows: null,
      view: "logistics",
    });

    assert.equal(plan.allowed, false);
    assert.equal(plan.estimatedRows, null);
    assert.deepEqual(
      plan.warnings.map((warning) => warning.code),
      ["broad_query"],
    );
  });

  it("blocks range exports and exports above the row cap", () => {
    const plan = createTradeRecordExportPlan({
      filters: {
        tradeFlow: "import",
        periodFrom: "2026-03",
        periodTo: "2026-04",
        hsCodePrefix: "2204",
      },
      totalRows: tradeRecordExportRowCap + 1,
      view: "commercial",
    });

    assert.equal(plan.allowed, false);
    assert.deepEqual(
      plan.warnings.map((warning) => warning.code),
      ["missing_exact_period", "row_cap_exceeded"],
    );
  });

  it("recognizes exact period and narrowing filters separately", () => {
    assert.equal(hasTradeRecordExportExactPeriod(safeFilters), true);
    assert.equal(hasTradeRecordExportNarrowingFilter(safeFilters), true);
    assert.equal(
      hasTradeRecordExportExactPeriod({
        tradeFlow: "import",
        periodFrom: "2026-03",
        periodTo: "2026-04",
      }),
      false,
    );
    assert.equal(
      hasTradeRecordExportNarrowingFilter({
        tradeFlow: "import",
        periodFrom: "2026-04",
        periodTo: "2026-04",
      }),
      false,
    );
  });
});

describe("trade record export columns and links", () => {
  it("maps every table view to view-specific CSV columns", () => {
    const commercial = tradeRecordExportColumnsForView("commercial").map(
      (column) => column.key,
    );
    const provenance = tradeRecordExportColumnsForView("provenance").map(
      (column) => column.key,
    );

    assert.ok(commercial.includes("item_value"));
    assert.ok(commercial.includes("participant_correlative"));
    assert.ok(provenance.includes("source_file_id"));
    assert.ok(provenance.includes("payload_retention_mode"));
  });

  it("strips table pagination params from export routes", () => {
    const params = new URLSearchParams({
      tradeFlow: "import",
      periodFrom: "2026-04",
      periodTo: "2026-04",
      hsCodePrefix: "2204",
      view: "product",
      limit: "25",
      offset: "50",
      after: "cursor",
    });

    const clean = sanitizeTradeRecordExportInput(params);
    const href = buildTradeRecordExportHref(params, "/api/trade-records/export-preview");

    assert.equal(clean.limit, undefined);
    assert.equal(clean.offset, undefined);
    assert.equal(clean.after, undefined);
    assert.equal(
      href,
      "/api/trade-records/export-preview?tradeFlow=import&periodFrom=2026-04&periodTo=2026-04&hsCodePrefix=2204&view=product",
    );
  });
});

describe("trade record CSV safety", () => {
  it("quotes cells and neutralizes spreadsheet formulas", () => {
    assert.equal(csvSafeCell("normal"), '"normal"');
    assert.equal(csvSafeCell('a "quoted" value'), '"a ""quoted"" value"');
    assert.equal(csvSafeCell("=IMPORTXML(A1)"), "\"'=IMPORTXML(A1)\"");
    assert.equal(csvSafeCell("+SUM(1,1)"), "\"'+SUM(1,1)\"");
    assert.equal(csvSafeCell(" -10"), "\"' -10\"");
    assert.equal(csvSafeCell("@cmd"), "\"'@cmd\"");
  });

  it("writes metadata and headers even for an empty safe row set", () => {
    const plan = createTradeRecordExportPlan({
      filters: safeFilters,
      totalRows: 1,
      view: "product",
    });
    const csv = buildTradeRecordExportCsv({ plan, rows: [] });

    assert.ok(csv.startsWith("\ufeff"));
    assert.match(csv, /"Duanera exportación CSV"/);
    assert.match(csv, /"Advertencia identidad"/);
    assert.match(csv, /"Producto"/);
    assert.match(csv, /"Correlativo Aduana \(no identidad legal\)"/);
  });
});
