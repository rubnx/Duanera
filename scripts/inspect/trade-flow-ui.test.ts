import test from "node:test";
import assert from "node:assert/strict";

import { tradeFlowUiConfig } from "../../src/trade/trade-flow-ui";

test("builds import Explorer UI semantics", () => {
  const config = tradeFlowUiConfig("import");

  assert.equal(config.flow, "import");
  assert.deepEqual(config.participant, {
    label: "ID importador",
    name: "importer",
  });
  assert.deepEqual(config.countryFilter, {
    label: "País origen",
    name: "originCountry",
  });
  assert.deepEqual(config.primaryPortFilter, {
    label: "Puerto desembarque",
    name: "disembarkPort",
  });
  assert.deepEqual(config.secondaryPortFilter, {
    label: "Puerto embarque ruta",
    name: "embarkPort",
  });
  assert.equal(config.itemValueLabel, "CIF");
  assert.deepEqual(config.grossWeightFilters, [
    {
      label: "Peso bruto total",
      maxName: "maxGrossWeightTotal",
      minName: "minGrossWeightTotal",
      name: "grossWeightTotal",
    },
  ]);
  assert.ok(config.incompatibleParams.includes("destinationCountry"));
  assert.ok(config.incompatibleParams.includes("minGrossWeightItem"));
});

test("builds export Explorer UI semantics", () => {
  const config = tradeFlowUiConfig("export");

  assert.equal(config.flow, "export");
  assert.deepEqual(config.participant, {
    label: "ID exportador",
    name: "exporter",
  });
  assert.deepEqual(config.countryFilter, {
    label: "País destino",
    name: "destinationCountry",
  });
  assert.deepEqual(config.primaryPortFilter, {
    label: "Puerto embarque",
    name: "embarkPort",
  });
  assert.deepEqual(config.secondaryPortFilter, {
    label: "Puerto desembarque destino",
    name: "disembarkPort",
  });
  assert.equal(config.itemValueLabel, "FOB");
  assert.deepEqual(
    config.grossWeightFilters.map((filter) => filter.name),
    ["grossWeightItem", "grossWeightTotal"],
  );
  assert.ok(config.incompatibleParams.includes("originCountry"));
  assert.ok(config.incompatibleParams.includes("importer"));
});
