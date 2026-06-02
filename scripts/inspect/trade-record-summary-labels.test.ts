import assert from "node:assert/strict";
import test from "node:test";

import {
  tradeRecordSummaryCodeLabel,
  tradeRecordSummaryCountryTitle,
  tradeRecordSummaryPortTitle,
} from "../../src/trade/trade-record-summary-labels";

const countryOptions = [
  {
    value: "336",
    label: "México",
    displayLabel: "336 · México",
  },
];

test("formats decoded summary code labels with raw fallbacks", () => {
  assert.equal(tradeRecordSummaryCodeLabel(countryOptions, "336"), "336 · México");
  assert.equal(
    tradeRecordSummaryCodeLabel(countryOptions, "999", "País fuente"),
    "999 · País fuente",
  );
  assert.equal(tradeRecordSummaryCodeLabel(countryOptions, null, "Sin código"), "Sin código");
  assert.equal(tradeRecordSummaryCodeLabel(countryOptions, null, null), "—");
});

test("uses flow-aware summary ranking titles", () => {
  assert.equal(tradeRecordSummaryCountryTitle({ tradeFlow: "import" }), "Top países origen");
  assert.equal(tradeRecordSummaryCountryTitle({ tradeFlow: "export" }), "Top países destino");
  assert.equal(tradeRecordSummaryCountryTitle({}), "Top países");
  assert.equal(tradeRecordSummaryPortTitle({ tradeFlow: "import" }), "Top puertos desembarque");
  assert.equal(tradeRecordSummaryPortTitle({ tradeFlow: "export" }), "Top puertos embarque");
  assert.equal(tradeRecordSummaryPortTitle({}), "Top puertos relevantes");
});
