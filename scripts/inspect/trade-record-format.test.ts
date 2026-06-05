import assert from "node:assert/strict";
import test from "node:test";

import {
  formatTradeCodeLabel,
  formatTradeCurrencyLabel,
  formatTradeDecimal,
  formatTradeDisplayCodeLabel,
  formatTradeMoney,
  formatTradeMoneyDisplay,
  formatTradeQuantity,
  formatTradeQuantityDisplay,
  formatTradeQuantityUnitDisplay,
  formatTradeSummaryValue,
} from "../../src/trade/trade-record-format";
import {
  chileAduanaCountryIsoByCode,
  countryNameForFlagCode,
  normalizeCountryFlagCode,
} from "../../src/trade/country-codes";
import { cleanPublicReferenceLabel } from "../../src/text/reference-labels";

test("formats trade numeric values for Chilean Spanish display", () => {
  assert.equal(formatTradeDecimal("1234.56"), "1.234,56");
  assert.equal(formatTradeDecimal(1234, 0), "1.234");
  assert.equal(formatTradeDecimal("not-number"), "not-number");
  assert.equal(formatTradeSummaryValue("1234.56", "kg"), "1.234,56 kg");
});

test("formats trade money, code labels, and quantities with configurable fallbacks", () => {
  assert.equal(formatTradeMoney("100", "DOLAR"), "100 DOLAR");
  assert.equal(formatTradeMoney(null), "—");
  assert.equal(formatTradeMoney(null, undefined, "No informado"), "No informado");
  assert.equal(formatTradeCodeLabel("336", "México"), "336 · México");
  assert.equal(formatTradeCodeLabel(null, undefined, "No informado"), "No informado");
  assert.equal(formatTradeQuantity("10", "KG"), "10 KG");
  assert.equal(formatTradeQuantity("10", "KG", "Kilogramos"), "10 Kilogramos");
  assert.equal(formatTradeQuantity(null, "KG", "Kilogramos", "No informado"), "No informado");
  assert.equal(formatTradeCurrencyLabel("DOLAR"), "US$");
  assert.equal(formatTradeMoneyDisplay("1234.56", "DOLAR"), "1.234,56");
  assert.equal(formatTradeMoneyDisplay("1234.56", "DOLAR", { includeCurrency: true }), "1.234,56 US$");
  assert.equal(formatTradeQuantityDisplay("2693", "KN"), "2.693 kg netos");
  assert.equal(
    formatTradeQuantityDisplay("2693", "KN", undefined, "No informado", {
      compactNetWeightUnit: true,
    }),
    "2.693 kg",
  );
  assert.equal(
    formatTradeQuantityDisplay("70848", "U", undefined, "No informado", {
      compactNetWeightUnit: true,
    }),
    "70.848 unidades",
  );
  assert.equal(formatTradeQuantityDisplay("70848", "U"), "70.848 unidades");
  assert.equal(formatTradeQuantityUnitDisplay("KN"), "kg netos");
  assert.equal(formatTradeQuantityUnitDisplay(null, "KILOGRAMOS"), "kg");
});

test("formats source-coded values for business-readable primary UI", () => {
  assert.equal(
    formatTradeDisplayCodeLabel({
      code: "1",
      kind: "transportMode",
      label: "MARÍTIMA, FLUVIAL Y LACUSTRE",
    }),
    "Marítimo",
  );
  assert.equal(
    formatTradeDisplayCodeLabel({
      code: "336",
      kind: "country",
      label: "China",
    }),
    "China",
  );
  assert.equal(
    formatTradeDisplayCodeLabel({
      code: "9",
      kind: "transportMode",
      label: "TENDIDO ELÉCTRICO (Aéreo, Subterráneo)",
    }),
    "Tendido eléctrico",
  );
  assert.equal(
    formatTradeDisplayCodeLabel({
      code: "905",
      kind: "port",
      label: "VALPARAÍSO",
    }),
    "Valparaíso",
  );
  assert.equal(
    formatTradeDisplayCodeLabel({
      code: "999",
      kind: "customsOffice",
      fallback: "No informado",
    }),
    "Código 999",
  );
});

test("normalizes country flag codes for flag-icons safely", () => {
  assert.equal(normalizeCountryFlagCode("CL"), "cl");
  assert.equal(normalizeCountryFlagCode("es"), "es");
  assert.equal(normalizeCountryFlagCode("US"), "us");
  assert.equal(normalizeCountryFlagCode("997", "Chile"), "cl");
  assert.equal(normalizeCountryFlagCode("336", "China"), "cn");
  assert.equal(normalizeCountryFlagCode("517", "España"), "es");
  assert.equal(normalizeCountryFlagCode("225", "Estados Unidos de América"), "us");
  assert.equal(normalizeCountryFlagCode("219", "Perú"), "pe");
  assert.equal(normalizeCountryFlagCode("317", "India"), "in");
  assert.equal(normalizeCountryFlagCode("563", "Alemania"), "de");
  assert.equal(normalizeCountryFlagCode("515", "Holanda"), "nl");
  assert.equal(normalizeCountryFlagCode("330", "Taiwán (Formosa)"), "tw");
  assert.equal(normalizeCountryFlagCode("156", "Seychelles"), "sc");
  assert.equal(normalizeCountryFlagCode("156", "China"), "sc");
  assert.equal(normalizeCountryFlagCode(null, "U.S.A."), "us");
  assert.equal(normalizeCountryFlagCode(null, "Holanda"), "nl");
  assert.equal(normalizeCountryFlagCode(null, "Taiwán (Formosa)"), "tw");
  assert.equal(normalizeCountryFlagCode("0", "Otros Orígenes Desconocidos"), null);
  assert.equal(normalizeCountryFlagCode("901", "Combustibles y lubricantes"), null);
  assert.equal(normalizeCountryFlagCode("ZZ"), null);
  assert.equal(normalizeCountryFlagCode("not-a-country"), null);
  assert.equal(countryNameForFlagCode("cl"), "Chile");
});

test("all mapped Chile Aduana country flags are supported by flag-icons", () => {
  for (const [aduanaCode, isoCode] of chileAduanaCountryIsoByCode) {
    assert.equal(
      normalizeCountryFlagCode(aduanaCode),
      isoCode.toLowerCase(),
      `Aduana country code ${aduanaCode} should map to ${isoCode}`,
    );
  }
});

test("cleans public reference labels without changing product text rules", () => {
  assert.equal(cleanPublicReferenceLabel("Tunez"), "Túnez");
  assert.equal(cleanPublicReferenceLabel("Libano"), "Líbano");
  assert.equal(
    cleanPublicReferenceLabel("Emiratos Arabes Unidos"),
    "Emiratos Árabes Unidos",
  );
  assert.equal(
    cleanPublicReferenceLabel("Otros Puertos De China No Especificados"),
    "Otros puertos de China no especificados",
  );
  assert.equal(cleanPublicReferenceLabel("Hong Kong"), "Hong Kong");
  assert.equal(
    cleanPublicReferenceLabel("Hong Kong (Region Administrativa Especial De China)"),
    "Hong Kong (Región administrativa especial de China)",
  );
  assert.equal(cleanPublicReferenceLabel("New York"), "New York");
  assert.equal(cleanPublicReferenceLabel("San Antonio"), "San Antonio");
});

test("formats rough reference code labels for public UI", () => {
  assert.equal(
    formatTradeDisplayCodeLabel({
      code: "212",
      kind: "country",
      label: "Tunez",
    }),
    "Túnez",
  );
  assert.equal(
    formatTradeDisplayCodeLabel({
      code: "784",
      kind: "country",
      label: "Emiratos Arabes Unidos",
    }),
    "Emiratos Árabes Unidos",
  );
  assert.equal(
    formatTradeDisplayCodeLabel({
      code: "1009",
      kind: "port",
      label: "Otros Puertos De China No Especificados",
    }),
    "Otros puertos de China no especificados",
  );
});
