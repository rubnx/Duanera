import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalTradeParticipantDisplayName,
  countryCodeToFlagEmoji,
  isConfirmedLegalParticipantEntity,
  normalizeTradeParticipantName,
  participantDisplaySubtitle,
  participantDisplayNameWithFlag,
} from "@/trade/trade-participant-display";

test("normalizes A. Hartrodt Chile legal-entity variants", () => {
  const variants = [
    ["A. HARTRODT CHILE S.A.", "high"],
    ["A.HARTRODT CHILE S.A", "high"],
    ["A. HARTRODT CHILE S.", "medium"],
  ] as const;

  for (const [rawName, confidence] of variants) {
    const participant = normalizeTradeParticipantName(rawName);

    assert.ok(participant);
    assert.equal(participant.rawName, rawName);
    assert.equal(participant.displayName, "A. Hartrodt Chile S.A.");
    assert.equal(participant.normalizedLegalEntityName, "A. Hartrodt Chile S.A.");
    assert.equal(participant.normalizedGroupName, "a. hartrodt Group");
    assert.equal(participant.countryCode, "CL");
    assert.equal(participant.entityType, "logistics / freight forwarder");
    assert.equal(participant.confidence, confidence);
    assert.equal(participant.isAmbiguous, false);
    assert.equal(isConfirmedLegalParticipantEntity(participant), true);
    assert.equal(participantDisplaySubtitle(participant), "a. hartrodt Group");
  }
});

test("normalizes A. Hartrodt Deutschland GmbH", () => {
  const participant = normalizeTradeParticipantName("A. HARTRODT DEUTSCHLAND (GMBH)");

  assert.ok(participant);
  assert.equal(participant.displayName, "A. Hartrodt Deutschland GmbH");
  assert.equal(participant.normalizedLegalEntityName, "A. Hartrodt Deutschland GmbH");
  assert.equal(participant.normalizedGroupName, "a. hartrodt Group");
  assert.equal(participant.countryCode, "DE");
  assert.equal(participant.confidence, "high");
  assert.equal(participant.isAmbiguous, false);
});

test("normalizes A. Hartrodt Shanghai Logistics", () => {
  const participant = normalizeTradeParticipantName("A. HARTRODT SHANGHAI LOGISTICS");

  assert.ok(participant);
  assert.equal(participant.displayName, "A. Hartrodt Shanghai Logistics");
  assert.equal(participant.normalizedLegalEntityName, "A. Hartrodt Shanghai Logistics");
  assert.equal(participant.normalizedGroupName, "a. hartrodt Group");
  assert.equal(participant.countryCode, "CN");
  assert.equal(participant.confidence, "high");
  assert.equal(participant.isAmbiguous, false);
});

test("normalizes A. Hartrodt AG", () => {
  const participant = normalizeTradeParticipantName("A.HARTRODT AG");

  assert.ok(participant);
  assert.equal(participant.displayName, "A. Hartrodt AG");
  assert.equal(participant.normalizedLegalEntityName, "A. Hartrodt AG");
  assert.equal(participant.normalizedGroupName, "a. hartrodt Group");
  assert.equal(participant.countryCode, "DE");
  assert.equal(participant.confidence, "high");
  assert.equal(participant.isAmbiguous, false);
});

test("keeps ambiguous A. Hartrodt short forms at group level only", () => {
  for (const rawName of ["A.HARTRODT", "A. HARTRODT"]) {
    const participant = normalizeTradeParticipantName(rawName);

    assert.ok(participant);
    assert.equal(participant.displayName, "a. hartrodt");
    assert.equal(participant.normalizedLegalEntityName, null);
    assert.equal(participant.normalizedGroupName, "a. hartrodt Group");
    assert.equal(participant.countryCode, null);
    assert.equal(participant.confidence, "low");
    assert.equal(participant.isAmbiguous, true);
    assert.equal(isConfirmedLegalParticipantEntity(participant), false);
    assert.equal(
      participantDisplaySubtitle(participant),
      "Coincidencia de grupo · entidad legal no clara",
    );
    assert.match(participant.matchReason, /group name only/i);
  }
});

test("falls back to cleaned source display for unknown names without fake normalization", () => {
  const participant = normalizeTradeParticipantName("  ACME LOGISTICS S.A.  ");

  assert.ok(participant);
  assert.equal(participant.rawName, "  ACME LOGISTICS S.A.  ");
  assert.equal(participant.displayName, "Acme Logistics S.A.");
  assert.equal(participant.normalizedLegalEntityName, null);
  assert.equal(participant.normalizedGroupName, null);
  assert.equal(participant.countryCode, null);
  assert.equal(participant.entityType, null);
  assert.equal(participant.confidence, "low");
  assert.equal(participant.isAmbiguous, false);
  assert.equal(isConfirmedLegalParticipantEntity(participant), false);
  assert.equal(
    participantDisplaySubtitle(participant),
    "Valor fuente limpio · sin normalización verificada",
  );
  assert.match(participant.matchReason, /No participant normalization rule matched/i);
});

test("normalizes common logistics carrier and issuer aliases conservatively", () => {
  const cases = [
    {
      rawName: "HAPAG LLOYD",
      displayName: "Hapag-Lloyd",
      groupName: "Hapag-Lloyd Group",
      entityType: "carrier / logistics",
      confidence: "low",
      ambiguous: true,
    },
    {
      rawName: "hapag lloyd",
      displayName: "Hapag-Lloyd",
      groupName: "Hapag-Lloyd Group",
      entityType: "carrier / logistics",
      confidence: "low",
      ambiguous: true,
    },
    {
      rawName: "KUEHNE & NAGEL LTDA.",
      displayName: "Kuehne + Nagel Ltda.",
      groupName: "Kuehne + Nagel Group",
      entityType: "logistics / freight forwarder",
      confidence: "medium",
      ambiguous: false,
    },
    {
      rawName: "CMA-CGM S.A.",
      displayName: "CMA CGM",
      groupName: "CMA CGM Group",
      entityType: "carrier / logistics",
      confidence: "low",
      ambiguous: true,
    },
    {
      rawName: "MEDITERRANEAN SHIPPI",
      displayName: "MSC",
      groupName: "MSC Group",
      entityType: "carrier / logistics",
      confidence: "medium",
      ambiguous: true,
    },
  ] as const;

  for (const expected of cases) {
    const participant = normalizeTradeParticipantName(expected.rawName);

    assert.ok(participant);
    assert.equal(participant.displayName, expected.displayName);
    assert.equal(participant.normalizedLegalEntityName, null);
    assert.equal(participant.normalizedGroupName, expected.groupName);
    assert.equal(participant.entityType, expected.entityType);
    assert.equal(participant.confidence, expected.confidence);
    assert.equal(participant.isAmbiguous, expected.ambiguous);
  }
});

test("formats unknown logistics names with legal suffixes and Spanish accents", () => {
  const participant = normalizeTradeParticipantName("cronos logistica ltda.");

  assert.ok(participant);
  assert.equal(participant.displayName, "Cronos Logística Ltda.");
  assert.equal(participant.normalizedLegalEntityName, null);
  assert.equal(participant.normalizedGroupName, null);
  assert.equal(participant.countryCode, null);
  assert.equal(participant.confidence, "low");
  assert.equal(participant.isAmbiguous, false);
});

test("canonicalizes stored logistics display names on read", () => {
  assert.equal(
    canonicalTradeParticipantDisplayName("KUEHNE & NAGEL LTDA."),
    "Kuehne + Nagel Ltda.",
  );
  assert.equal(canonicalTradeParticipantDisplayName("MEDITERRANEAN SHIPPI"), "MSC");
  assert.equal(canonicalTradeParticipantDisplayName(null), "");
});

test("formats participant country flags from reliable country codes", () => {
  assert.equal(countryCodeToFlagEmoji("CL"), "🇨🇱");
  assert.equal(countryCodeToFlagEmoji("de"), "🇩🇪");
  assert.equal(countryCodeToFlagEmoji(null), null);
  assert.equal(countryCodeToFlagEmoji("336"), null);

  const participant = normalizeTradeParticipantName("A. HARTRODT SHANGHAI LOGISTICS");

  assert.ok(participant);
  assert.equal(
    participantDisplayNameWithFlag(participant),
    "A. Hartrodt Shanghai Logistics 🇨🇳",
  );
});
