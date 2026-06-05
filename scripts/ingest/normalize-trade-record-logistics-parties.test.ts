import assert from "node:assert/strict";
import test from "node:test";

import {
  extractLogisticsPartyEvidence,
  logisticsPartyRoleLabel,
  normalizeRawName,
  parseLogisticsPartyRole,
} from "./normalize-trade-record-logistics-parties";

test("extracts import carrier and transport-document issuer evidence", () => {
  const evidence = extractLogisticsPartyEvidence("import", {
    GNOM_CIA_T: "MAERSK LINE",
    CODPAISCIA: "208",
    NUMRUTCIA: "00000000",
    DIGVERCIA: "0",
    NOMEMISOR: "A. HARTRODT CHILE S.A.",
    NUMRUTEMI: "76123456",
    DIGVEREMI: "K",
  });

  assert.equal(evidence.length, 2);
  assert.deepEqual(
    evidence.map((entry) => [entry.role, entry.sourceField, entry.rawName]),
    [
      ["carrier", "GNOM_CIA_T", "MAERSK LINE"],
      ["issuer", "NOMEMISOR", "A. HARTRODT CHILE S.A."],
    ],
  );
  assert.equal(evidence[0]?.sourceRut, null);
  assert.equal(evidence[0]?.sourceCountryCode, "208");
  assert.equal(evidence[1]?.sourceRut, "76123456");
  assert.equal(evidence[1]?.sourceRutDv, "K");
  assert.equal(evidence[1]?.display.displayName, "A. Hartrodt Chile S.A.");
});

test("extracts export carrier and transport-document issuer evidence", () => {
  const evidence = extractLogisticsPartyEvidence("export", {
    NOMBRECIATRANSP: "KUEHNE + NAGEL",
    PAISCIATRANSP: "CL",
    RUTCIATRANSP: "96510930",
    DVRUTCIATRANSP: "4",
    NOMBREEMISORDOCTRANSP: "MAERSK CHILE S.A.",
    RUTEMISOR: "99555120",
    DVRUTEMISOR: "1",
  });

  assert.equal(evidence.length, 2);
  assert.deepEqual(
    evidence.map((entry) => [entry.role, entry.sourceField, entry.rawName]),
    [
      ["carrier", "NOMBRECIATRANSP", "KUEHNE + NAGEL"],
      ["issuer", "NOMBREEMISORDOCTRANSP", "MAERSK CHILE S.A."],
    ],
  );
  assert.equal(evidence[0]?.sourceCountryCode, "CL");
  assert.equal(evidence[1]?.sourceRut, "99555120");
});

test("applies canonical display names to logistics evidence", () => {
  const evidence = extractLogisticsPartyEvidence("import", {
    GNOM_CIA_T: "HAPAG LLOYD",
    NOMEMISOR: "cronos logistica ltda.",
  });

  assert.equal(evidence.length, 2);
  assert.equal(evidence[0]?.rawName, "HAPAG LLOYD");
  assert.equal(evidence[0]?.display.displayName, "Hapag-Lloyd");
  assert.equal(evidence[0]?.display.normalizedGroupName, "Hapag-Lloyd Group");
  assert.equal(evidence[0]?.display.isAmbiguous, true);
  assert.equal(evidence[1]?.rawName, "cronos logistica ltda.");
  assert.equal(evidence[1]?.display.displayName, "Cronos Logística Ltda.");
  assert.equal(evidence[1]?.display.normalizedGroupName, null);
  assert.equal(evidence[1]?.display.isAmbiguous, false);
});

test("normalizes logistics alias names for stable rollups", () => {
  assert.equal(normalizeRawName(" A. Härtrodt-Chile S.A. "), "A HARTRODT CHILE S A");
  assert.equal(normalizeRawName("a hartrodt chile s a"), "A HARTRODT CHILE S A");
});

test("ignores placeholder logistics names", () => {
  const evidence = extractLogisticsPartyEvidence("export", {
    NOMBRECIATRANSP: "NO EXISTE",
    NOMBREEMISORDOCTRANSP: "00000000",
  });

  assert.deepEqual(evidence, []);
});

test("parses and labels supported logistics roles", () => {
  assert.equal(parseLogisticsPartyRole("issuer"), "issuer");
  assert.equal(parseLogisticsPartyRole("carrier"), "carrier");
  assert.equal(parseLogisticsPartyRole("importer"), null);
  assert.equal(logisticsPartyRoleLabel("issuer"), "Emisor documento transporte");
  assert.equal(logisticsPartyRoleLabel("carrier"), "Compañía de transporte");
});
