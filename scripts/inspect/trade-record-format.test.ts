import assert from "node:assert/strict";
import test from "node:test";

import {
  formatTradeCodeLabel,
  formatTradeDecimal,
  formatTradeMoney,
  formatTradeQuantity,
  formatTradeSummaryValue,
} from "../../src/trade/trade-record-format";

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
});
