export type TradeParticipantNameConfidence = "high" | "medium" | "low";

export type TradeParticipantDisplay = {
  rawName: string;
  displayName: string;
  normalizedLegalEntityName: string | null;
  normalizedGroupName: string | null;
  countryCode: string | null;
  entityType: string | null;
  confidence: TradeParticipantNameConfidence;
  matchReason: string;
  isAmbiguous: boolean;
};

type ParticipantAlias = {
  pattern: RegExp;
  displayName: string;
  normalizedLegalEntityName: string | null;
  countryCode: string | null;
  confidence: TradeParticipantNameConfidence;
  matchReason: string;
  isAmbiguous?: boolean;
};

type ParticipantGroupRule = {
  normalizedGroupName: string;
  entityType: string;
  aliases: ParticipantAlias[];
};

const participantGroupRules: ParticipantGroupRule[] = [
  {
    normalizedGroupName: "a. hartrodt Group",
    entityType: "logistics / freight forwarder",
    aliases: [
      {
        pattern: /^A\.?\s*HARTRODT\s+CHILE\s+S\.?\s*A\.?$/i,
        displayName: "A. Hartrodt Chile S.A.",
        normalizedLegalEntityName: "A. Hartrodt Chile S.A.",
        countryCode: "CL",
        confidence: "high",
        matchReason: "Matched known Chile legal-entity alias.",
      },
      {
        pattern: /^A\.?\s*HARTRODT\s+CHILE\s+S\.?$/i,
        displayName: "A. Hartrodt Chile S.A.",
        normalizedLegalEntityName: "A. Hartrodt Chile S.A.",
        countryCode: "CL",
        confidence: "medium",
        matchReason: "Matched truncated Chile legal-entity alias.",
      },
      {
        pattern: /^A\.?\s*HARTRODT\s+DEUTSCHLAND\s+\(?GMBH\)?$/i,
        displayName: "A. Hartrodt Deutschland GmbH",
        normalizedLegalEntityName: "A. Hartrodt Deutschland GmbH",
        countryCode: "DE",
        confidence: "high",
        matchReason: "Matched known Deutschland legal-entity alias.",
      },
      {
        pattern: /^A\.?\s*HARTRODT\s+SHANGHAI\s+LOGISTICS$/i,
        displayName: "A. Hartrodt Shanghai Logistics",
        normalizedLegalEntityName: "A. Hartrodt Shanghai Logistics",
        countryCode: "CN",
        confidence: "high",
        matchReason: "Matched known Shanghai legal-entity alias.",
      },
      {
        pattern: /^A\.?\s*HARTRODT\s+AG$/i,
        displayName: "A. Hartrodt AG",
        normalizedLegalEntityName: "A. Hartrodt AG",
        countryCode: "DE",
        confidence: "high",
        matchReason: "Matched known AG legal-entity alias.",
      },
      {
        pattern: /^A\.?\s*HARTRODT$/i,
        displayName: "a. hartrodt",
        normalizedLegalEntityName: null,
        countryCode: null,
        confidence: "low",
        isAmbiguous: true,
        matchReason:
          "Matched known group name only; legal/local entity is unclear from the source value.",
      },
    ],
  },
  {
    normalizedGroupName: "Kuehne + Nagel Group",
    entityType: "logistics / freight forwarder",
    aliases: [
      {
        pattern: /^K(?:U|Ü)EHNE\s*(?:\+|&)\s*NAGEL\s+LTDA\.?$/i,
        displayName: "Kuehne + Nagel Ltda.",
        normalizedLegalEntityName: null,
        countryCode: null,
        confidence: "medium",
        matchReason: "Matched known logistics group alias with source legal suffix.",
      },
      {
        pattern: /^K(?:U|Ü)EHNE\s*(?:\+|&)\s*NAGEL$/i,
        displayName: "Kuehne + Nagel",
        normalizedLegalEntityName: null,
        countryCode: null,
        confidence: "low",
        isAmbiguous: true,
        matchReason:
          "Matched known logistics group name only; legal/local entity is unclear from the source value.",
      },
    ],
  },
  {
    normalizedGroupName: "Maersk Group",
    entityType: "carrier / logistics",
    aliases: [
      {
        pattern: /^MAERSK\s+CHILE\s+S\.?\s*A\.?$/i,
        displayName: "Maersk Chile S.A.",
        normalizedLegalEntityName: "Maersk Chile S.A.",
        countryCode: "CL",
        confidence: "high",
        matchReason: "Matched known Chile legal-entity alias.",
      },
      {
        pattern: /^MAERSK(?:\s+LINE)?$/i,
        displayName: "Maersk",
        normalizedLegalEntityName: null,
        countryCode: null,
        confidence: "low",
        isAmbiguous: true,
        matchReason:
          "Matched known carrier group name only; legal/local entity is unclear from the source value.",
      },
    ],
  },
  {
    normalizedGroupName: "MSC Group",
    entityType: "carrier / logistics",
    aliases: [
      {
        pattern: /^MEDITERRANEAN\s+SHIPPI(?:NG\s+COMPANY)?(?:\s+.*)?$/i,
        displayName: "MSC",
        normalizedLegalEntityName: null,
        countryCode: null,
        confidence: "medium",
        isAmbiguous: true,
        matchReason:
          "Matched truncated Mediterranean Shipping source value to carrier group only.",
      },
      {
        pattern: /^(?:MSC|MEDITERRANEAN\s+SHIPPING\s+COMPANY)(?:\s+.*)?$/i,
        displayName: "MSC",
        normalizedLegalEntityName: null,
        countryCode: null,
        confidence: "low",
        isAmbiguous: true,
        matchReason:
          "Matched known carrier group name only; legal/local entity is unclear from the source value.",
      },
    ],
  },
  {
    normalizedGroupName: "Hapag-Lloyd Group",
    entityType: "carrier / logistics",
    aliases: [
      {
        pattern: /^HAPAG[-\s]?LLOYD(?:\s+.*)?$/i,
        displayName: "Hapag-Lloyd",
        normalizedLegalEntityName: null,
        countryCode: null,
        confidence: "low",
        isAmbiguous: true,
        matchReason:
          "Matched known carrier group name only; legal/local entity is unclear from the source value.",
      },
    ],
  },
  {
    normalizedGroupName: "DHL Group",
    entityType: "logistics / freight forwarder",
    aliases: [
      {
        pattern: /^DHL(?:\s+.*)?$/i,
        displayName: "DHL",
        normalizedLegalEntityName: null,
        countryCode: null,
        confidence: "low",
        isAmbiguous: true,
        matchReason:
          "Matched known logistics group name only; legal/local entity is unclear from the source value.",
      },
    ],
  },
  {
    normalizedGroupName: "Ultramar Group",
    entityType: "logistics / port services",
    aliases: [
      {
        pattern: /^ULTRAMAR(?:\s+.*)?$/i,
        displayName: "Ultramar",
        normalizedLegalEntityName: null,
        countryCode: null,
        confidence: "low",
        isAmbiguous: true,
        matchReason:
          "Matched known logistics group name only; legal/local entity is unclear from the source value.",
      },
    ],
  },
  {
    normalizedGroupName: "Ian Taylor Group",
    entityType: "logistics / shipping agency",
    aliases: [
      {
        pattern: /^IAN\s+TAYLOR(?:\s+.*)?$/i,
        displayName: "Ian Taylor",
        normalizedLegalEntityName: null,
        countryCode: null,
        confidence: "low",
        isAmbiguous: true,
        matchReason:
          "Matched known logistics group name only; legal/local entity is unclear from the source value.",
      },
    ],
  },
  {
    normalizedGroupName: "COSCO Group",
    entityType: "carrier / logistics",
    aliases: [
      {
        pattern: /^COSCO(?:\s+.*)?$/i,
        displayName: "COSCO",
        normalizedLegalEntityName: null,
        countryCode: null,
        confidence: "low",
        isAmbiguous: true,
        matchReason:
          "Matched known carrier group name only; legal/local entity is unclear from the source value.",
      },
    ],
  },
  {
    normalizedGroupName: "CMA CGM Group",
    entityType: "carrier / logistics",
    aliases: [
      {
        pattern: /^CMA[-\s]+CGM(?:\s+(?:S\.?A\.?|SA))?(?:\s+.*)?$/i,
        displayName: "CMA CGM",
        normalizedLegalEntityName: null,
        countryCode: null,
        confidence: "low",
        isAmbiguous: true,
        matchReason:
          "Matched known carrier group name only; legal/local entity is unclear from the source value.",
      },
    ],
  },
];

const acronymWords = new Set([
  "AG",
  "APL",
  "CMA",
  "CGM",
  "COSCO",
  "DHL",
  "GMBH",
  "HMM",
  "LTD",
  "MSC",
  "NYK",
  "OOCL",
  "PIL",
  "PTE",
  "RCL",
  "S",
  "S.A.",
  "SA",
  "SPA",
  "S.P.A.",
  "SITC",
  "USA",
  "U.S.A.",
  "ZIM",
]);

const accentWords = new Map([
  ["LOGISTICA", "Logística"],
  ["LOGISTICO", "Logístico"],
]);

function cleanWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeForMatch(value: string) {
  return cleanWhitespace(value)
    .replace(/\s*\.\s*/g, ".")
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function formatLegalSuffix(value: string) {
  const normalized = value.replace(/[^A-Z]/gi, "").toUpperCase();

  if (normalized === "SA") {
    return "S.A.";
  }

  if (normalized === "SPA") {
    return "SpA";
  }

  if (normalized === "LTDA") {
    return "Ltda.";
  }

  if (normalized === "LTD") {
    return "Ltd.";
  }

  return value;
}

function titleCaseUnknownName(value: string) {
  return cleanWhitespace(value)
    .split(" ")
    .map((word) => {
      const suffix = formatLegalSuffix(word);
      if (suffix !== word) {
        return suffix;
      }

      const normalized = word.replace(/[^A-Z]/gi, "").toUpperCase();
      const accented = accentWords.get(normalized);
      if (accented) {
        return accented;
      }

      if (
        acronymWords.has(normalized) ||
        /^(?:[A-Z]\.){2,}[A-Z]?\.?$/i.test(word)
      ) {
        return word
          .toUpperCase()
          .replace(/\.+$/, (dots) => dots.slice(0, 1));
      }

      return word
        .split("-")
        .map((part) =>
          part
            ? `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`
            : part,
        )
        .join("-");
    })
    .join(" ");
}

export function countryCodeToFlagEmoji(countryCode: string | null | undefined) {
  if (!countryCode) {
    return null;
  }

  const code = countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) {
    return null;
  }

  return Array.from(code)
    .map((letter) => String.fromCodePoint(letter.charCodeAt(0) + 127397))
    .join("");
}

export function participantDisplayNameWithFlag(
  participant: Pick<TradeParticipantDisplay, "displayName" | "countryCode">,
) {
  const flag = countryCodeToFlagEmoji(participant.countryCode);
  return flag ? `${participant.displayName} ${flag}` : participant.displayName;
}

export function isConfirmedLegalParticipantEntity(
  participant: Pick<
    TradeParticipantDisplay,
    "isAmbiguous" | "normalizedLegalEntityName"
  >,
) {
  return Boolean(participant.normalizedLegalEntityName && !participant.isAmbiguous);
}

export function participantDisplaySubtitle(
  participant: Pick<
    TradeParticipantDisplay,
    "isAmbiguous" | "normalizedGroupName" | "normalizedLegalEntityName"
  >,
) {
  if (participant.isAmbiguous) {
    return "Coincidencia de grupo · entidad legal no clara";
  }

  if (participant.normalizedGroupName) {
    return participant.normalizedGroupName;
  }

  if (participant.normalizedLegalEntityName) {
    return "Entidad normalizada";
  }

  return "Valor fuente limpio · sin normalización verificada";
}

export function normalizeTradeParticipantName(
  rawName: string | null | undefined,
): TradeParticipantDisplay | null {
  if (rawName === null || rawName === undefined) {
    return null;
  }

  const cleanedRawName = cleanWhitespace(rawName);
  if (!cleanedRawName) {
    return null;
  }

  const comparableName = normalizeForMatch(cleanedRawName);

  for (const groupRule of participantGroupRules) {
    const alias = groupRule.aliases.find((candidate) =>
      candidate.pattern.test(comparableName),
    );

    if (!alias) {
      continue;
    }

    return {
      rawName,
      displayName: alias.displayName,
      normalizedLegalEntityName: alias.normalizedLegalEntityName,
      normalizedGroupName: groupRule.normalizedGroupName,
      countryCode: alias.countryCode,
      entityType: groupRule.entityType,
      confidence: alias.confidence,
      matchReason: alias.matchReason,
      isAmbiguous: alias.isAmbiguous ?? false,
    };
  }

  return {
    rawName,
    displayName: titleCaseUnknownName(cleanedRawName),
    normalizedLegalEntityName: null,
    normalizedGroupName: null,
    countryCode: null,
    entityType: null,
    confidence: "low",
    matchReason:
      "No participant normalization rule matched; showing cleaned source value.",
    isAmbiguous: false,
  };
}

export function canonicalTradeParticipantDisplayName(
  rawName: string | null | undefined,
) {
  const participant = normalizeTradeParticipantName(rawName);
  if (participant) {
    return participant.displayName;
  }

  return rawName ? cleanWhitespace(rawName) : "";
}
