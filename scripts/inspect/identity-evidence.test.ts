import test from "node:test";
import assert from "node:assert/strict";

import {
  extractIdentityEvidenceSignals,
  isUsefulIdentityEvidenceValue,
  normalizeIdentityEvidenceValue,
} from "../../src/research/identity-evidence";

test("normalizes and filters identity evidence text conservatively", () => {
  assert.equal(normalizeIdentityEvidenceValue("  AQUACHILE   S.A.  "), "AQUACHILE S.A.");
  assert.equal(isUsefulIdentityEvidenceValue("AQUACHILE S.A."), true);
  assert.equal(isUsefulIdentityEvidenceValue("SIN-CODIGO"), false);
  assert.equal(isUsefulIdentityEvidenceValue("0000000115"), false);
  assert.equal(isUsefulIdentityEvidenceValue(" "), false);
});

test("extracts product attributes as unverified source-text signals", () => {
  const signals = extractIdentityEvidenceSignals({
    tradeFlow: "export",
    productDescriptionRaw: "23935 ~FILETE SALMON DEL ATLANTICO",
    productAttributes: {
      attribute1: "AQUACHILE-F",
      attribute2: "CRUDO CONGELADO IQF",
    },
    rawValues: {
      NOMBRECIATRANSP: "MAERSK LINE",
      NOMBREEMISORDOCTRANSP: "MAERSK LINE",
    },
  });

  assert.equal(
    signals.some(
      (signal) =>
        signal.value === "AQUACHILE-F" &&
        signal.strength === "direct_source_text" &&
        signal.caveat.includes("no identidad legal verificada"),
    ),
    true,
  );
  assert.equal(
    signals.some(
      (signal) =>
        signal.value === "MAERSK LINE" &&
        signal.strength === "weak" &&
        signal.caveat.includes("No debe tratarse como importador/exportador"),
    ),
    true,
  );
});
