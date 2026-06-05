import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOperationalFieldsCoverageReport,
  operationalFieldRecommendation,
  parseOperationalFieldsCoverageArgs,
} from "./operational-fields-coverage-report";
import { emptyOperationalCodeLabelMaps } from "../../src/trade/trade-record-operational-code-labels";

test("parses operational fields coverage report arguments", () => {
  assert.deepEqual(parseOperationalFieldsCoverageArgs([]), {
    json: false,
    periodFrom: null,
    periodTo: null,
    sampleSize: 500,
    tradeFlow: null,
  });

  assert.deepEqual(
    parseOperationalFieldsCoverageArgs([
      "--period-from=2026-03",
      "--period-to",
      "2026-04",
      "--trade-flow=export",
      "--sample-size=25",
      "--json",
    ]),
    {
      json: true,
      periodFrom: "2026-03",
      periodTo: "2026-04",
      sampleSize: 25,
      tradeFlow: "export",
    },
  );

  assert.equal(
    parseOperationalFieldsCoverageArgs(["--sample-size=5000"]).sampleSize,
    2000,
  );
  assert.throws(
    () => parseOperationalFieldsCoverageArgs(["--period-from=2026-13"]),
    /YYYY-MM/,
  );
  assert.throws(
    () => parseOperationalFieldsCoverageArgs(["--trade-flow=both"]),
    /import or export/,
  );
  assert.throws(
    () => parseOperationalFieldsCoverageArgs(["--sample-size=0"]),
    /positive/,
  );
});

test("classifies operational field recommendations", () => {
  assert.equal(
    operationalFieldRecommendation({
      coveragePercent: 95,
      examples: ["CMA CGM"],
      field: { key: "transportCompany", sourceField: "GNOM_CIA_T" },
    }),
    "show_now",
  );

  assert.equal(
    operationalFieldRecommendation({
      coveragePercent: 35,
      examples: ["MAERSK"],
      field: { key: "transportCompany", sourceField: "NOMBRECIATRANSP" },
    }),
    "detail_only",
  );

  assert.equal(
    operationalFieldRecommendation({
      coveragePercent: 95,
      examples: ["11"],
      field: { key: "paymentForm", sourceField: "FORM_PAGO" },
    }),
    "needs_cleanup",
  );

  assert.equal(
    operationalFieldRecommendation({
      coveragePercent: 95,
      examples: ["7 · Costo y flete"],
      field: { key: "saleClause", sourceField: "CLAUSULAVENTA" },
    }),
    "show_now",
  );

  assert.equal(
    operationalFieldRecommendation({
      coveragePercent: 95,
      examples: ["7"],
      field: { key: "saleClause", sourceField: "CLAUSULAVENTA" },
    }),
    "needs_cleanup",
  );

  assert.equal(
    operationalFieldRecommendation({
      coveragePercent: 3,
      examples: ["PARTICULAR"],
      field: { key: "warehouse", sourceField: "ALMACEN" },
    }),
    "do_not_use_yet",
  );
});

test("builds import operational coverage from reviewed samples", () => {
  const labelMaps = emptyOperationalCodeLabelMaps();
  labelMaps["chile_aduana:paises"].set("250", "Martinica");
  labelMaps["chile_aduana:clausulas_de_compra_venta"].set(
    "11",
    "TRANSPORTE PAGADO HASTA",
  );

  const report = buildOperationalFieldsCoverageReport({
    labelMaps,
    periodFrom: "2026-04",
    periodTo: "2026-04",
    sampleSize: 2,
    tradeFlow: "import",
    samples: [
      {
        id: "record-1",
        reconstructionStatus: "postgres",
        tradeFlow: "import",
        rawValues: {
          GNOM_CIA_T: "CMA CGM",
          CODPAISCIA: "250",
          NUM_MANIF: "266301",
          FEC_MANIF: "25012026",
          NUM_CONOC: "ABC123",
          FEC_CONOC: "26012026",
          NOMEMISOR: "CMA CGM CHILE",
          FORM_PAGO: "11",
          CL_COMPRA: "11",
          TOT_BULTOS: "32",
          ID_BULTOS: "CONTENEDOR",
          TPO_BUL1: "32",
          CANT_BUL1: "2",
          ALMACEN: "PARTICULAR",
        },
      },
      {
        id: "record-2",
        reconstructionStatus: "local",
        tradeFlow: "import",
        rawValues: {
          GNOM_CIA_T: "MAERSK LINE",
          FORM_PAGO: "11",
          TOT_BULTOS: "9",
        },
      },
      {
        id: "record-3",
        reconstructionStatus: "unavailable",
        tradeFlow: "import",
        rawValues: null,
      },
    ],
  });

  assert.equal(report.totals.recordsSampled, 3);
  assert.equal(report.totals.rowsReviewed, 2);
  assert.deepEqual(report.totals.reconstructionStatusCounts, {
    hash_mismatch: 0,
    local: 1,
    postgres: 1,
    r2: 0,
    unavailable: 1,
  });

  const transportCompany = report.fields.find(
    (field) => field.fieldKey === "transportCompany",
  );
  assert.equal(transportCompany?.sampledRows, 2);
  assert.equal(transportCompany?.rowsWithValue, 2);
  assert.equal(transportCompany?.coveragePercent, 100);
  assert.equal(transportCompany?.recommendation, "show_now");
  assert.deepEqual(transportCompany?.exampleLinks, [
    "/trade-records/record-1",
    "/trade-records/record-2",
  ]);

  const payment = report.fields.find((field) => field.fieldKey === "paymentForm");
  assert.equal(payment?.recommendation, "needs_cleanup");
  assert.deepEqual(payment?.examples, ["Código Aduana 11"]);

  const saleClause = report.fields.find((field) => field.fieldKey === "saleClause");
  assert.equal(saleClause?.recommendation, "detail_only");
  assert.deepEqual(saleClause?.examples, ["11 · Transporte pagado hasta"]);

  const country = report.fields.find(
    (field) => field.fieldKey === "transportCompanyCountry",
  );
  assert.equal(country?.recommendation, "detail_only");
  assert.deepEqual(country?.examples, ["250 · Martinica"]);
});

test("keeps export logistics labels away from importer/exporter identity claims", () => {
  const report = buildOperationalFieldsCoverageReport({
    periodFrom: "2026-04",
    periodTo: "2026-04",
    sampleSize: 1,
    tradeFlow: "export",
    samples: [
      {
        id: "export-1",
        reconstructionStatus: "postgres",
        tradeFlow: "export",
        rawValues: {
          NOMBRECIATRANSP: "MAERSK LINE",
          PAISCIATRANSP: "208",
          NOMBREEMISORDOCTRANSP: "MAERSK CHILE S.A.",
          FORMAPAGO: "1",
          CLAUSULAVENTA: "FOB",
          TOTALBULTOS: "10",
        },
      },
    ],
  });

  for (const field of report.fields) {
    assert.doesNotMatch(field.label, /importador|exportador/i);
    assert.doesNotMatch(field.groupTitle, /importador|exportador/i);
  }
});
