const uppercasePreserveWords = new Set([
  "CIF",
  "FOB",
  "HS",
  "IVA",
  "RUT",
  "USD",
  "US$",
]);

const lowercaseUnitWords = new Set([
  "KG",
  "KGS",
  "G",
  "MT",
  "MTS",
  "M",
  "L",
  "LT",
  "LTS",
  "CM",
  "MM",
  "M2",
  "M3",
]);

const lowercaseDisplayWords = new Set([
  "a",
  "al",
  "con",
  "de",
  "del",
  "e",
  "el",
  "en",
  "la",
  "las",
  "lo",
  "los",
  "o",
  "para",
  "por",
  "sin",
  "u",
  "y",
]);

const weakSearchWords = new Set([
  ...lowercaseDisplayWords,
  "un",
  "una",
  "uno",
  "unos",
  "unas",
]);

const spanishAccentWords = new Map([
  ["algodon", "algodón"],
  ["articulo", "artículo"],
  ["articulos", "artículos"],
  ["azucar", "azúcar"],
  ["biberon", "biberón"],
  ["calzon", "calzón"],
  ["cafe", "café"],
  ["ceramica", "cerámica"],
  ["comun", "común"],
  ["confeccion", "confección"],
  ["cosmetico", "cosmético"],
  ["cosmeticos", "cosméticos"],
  ["demas", "demás"],
  ["cortauna", "cortaúña"],
  ["electronico", "electrónico"],
  ["electronicos", "electrónicos"],
  ["electrico", "eléctrico"],
  ["electricos", "eléctricos"],
  ["farmaceutico", "farmacéutico"],
  ["farmaceuticos", "farmacéuticos"],
  ["jabon", "jabón"],
  ["jardin", "jardín"],
  ["jugueteria", "juguetería"],
  ["lamina", "lámina"],
  ["laminas", "láminas"],
  ["maquina", "máquina"],
  ["maquinas", "máquinas"],
  ["mecanico", "mecánico"],
  ["mecanicos", "mecánicos"],
  ["medico", "médico"],
  ["medicos", "médicos"],
  ["metalico", "metálico"],
  ["metalicos", "metálicos"],
  ["magnetico", "magnético"],
  ["magneticos", "magnéticos"],
  ["pezon", "pezón"],
  ["plastico", "plástico"],
  ["plasticos", "plásticos"],
  ["poliester", "poliéster"],
  ["quimico", "químico"],
  ["quimicos", "químicos"],
  ["sintetico", "sintético"],
  ["sinteticos", "sintéticos"],
  ["sosten", "sostén"],
  ["tapiceria", "tapicería"],
  ["telefono", "teléfono"],
  ["telefonos", "teléfonos"],
  ["vehiculo", "vehículo"],
  ["vehiculos", "vehículos"],
]);

export function cleanPublicTextPart(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function isPublicCodeLikeText(value: string) {
  const normalized = cleanPublicTextPart(value).toUpperCase();

  if (!normalized || /\s/.test(normalized)) {
    return false;
  }

  return (
    (/^[A-Z0-9-]{3,}$/.test(normalized) &&
      (/\d/.test(normalized) ||
        /^[A-Z0-9]{1,4}(?:-[A-Z0-9]{1,4})+$/.test(normalized))) ||
    /^(?:[A-Z]\.){2,}[A-Z]?(?:-[A-Z0-9]+)?$/.test(normalized)
  );
}

function restoreSpanishAccents(value: string) {
  return value.replace(/\b[A-Za-z]+\b/g, (word) => {
    const accented = spanishAccentWords.get(word.toLowerCase());
    if (!accented) {
      return word;
    }

    return /^[A-Z]/.test(word)
      ? `${accented.charAt(0).toUpperCase()}${accented.slice(1)}`
      : accented;
  });
}

function repairObviousSourceSplits(value: string) {
  return value
    .replace(/\bHILAD\s+OS\b/gi, "HILADOS")
    .replace(/\bCORTI\s+NAJES\b/gi, "CORTINAJES")
    .replace(/\bCONFE\s+CCION\b/gi, "CONFECCION")
    .replace(/\bTAPI\s+CERIA\b/gi, "TAPICERIA")
    .replace(/\bPOLI\s+ESTER\b/gi, "POLIESTER")
    .replace(/\bDISTIN\s+TOS\b/gi, "DISTINTOS")
    .replace(/\bBOTELLS\b/gi, "BOTELLAS");
}

function cleanUnits(value: string) {
  return value
    .replace(/(\d+(?:[.,]\d+)?)\s*MTS?\b/gi, "$1 m")
    .replace(/(\d+(?:[.,]\d+)?)\s*CMS?\b/gi, "$1 cm")
    .replace(/(\d+(?:[.,]\d+)?)\s*MMS?\b/gi, "$1 mm")
    .replace(/(\d+(?:[.,]\d+)?)\s*KGS?\b/gi, "$1 kg")
    .replace(/(\d+(?:[.,]\d+)?)\s*GRAMOS?\b/gi, "$1 gramos")
    .replace(/(\d+(?:[.,]\d+)?)\s*LTS?\b/gi, "$1 l")
    .replace(/(\d+(?:[.,]\d+)?)%\s*([A-ZÁÉÍÓÚÑ])/gi, "$1% $2")
    .replace(/\bCHO\s*:/gi, "ANCHO:")
    .replace(/\bMT\.?2\b/gi, "M2");
}

function displayWord(word: string, wordIndex: number) {
  const clean = word.trim();
  if (!clean) {
    return clean;
  }

  const upper = clean.toUpperCase();
  if (
    uppercasePreserveWords.has(upper) ||
    isPublicCodeLikeText(clean)
  ) {
    return upper;
  }

  if (lowercaseUnitWords.has(upper)) {
    return upper.toLowerCase();
  }

  if (wordIndex > 0 && lowercaseDisplayWords.has(upper.toLowerCase())) {
    return upper.toLowerCase();
  }

  const lower = upper.toLowerCase();
  return wordIndex === 0 ? `${lower.charAt(0).toUpperCase()}${lower.slice(1)}` : lower;
}

function isShortDescriptorModelToken(value: string) {
  return /^[A-Z0-9]{2,4}$/.test(value) && /[A-Z]/.test(value);
}

function descriptorDisplayWord(word: string, wordIndex: number) {
  const clean = word.trim();
  if (!clean) {
    return clean;
  }

  const upper = clean.toUpperCase();
  if (
    uppercasePreserveWords.has(upper) ||
    isPublicCodeLikeText(clean)
  ) {
    return upper;
  }

  if (lowercaseUnitWords.has(upper)) {
    return upper.toLowerCase();
  }

  if (wordIndex > 0 && lowercaseDisplayWords.has(upper.toLowerCase())) {
    return upper.toLowerCase();
  }

  if (isShortDescriptorModelToken(upper)) {
    return upper;
  }

  const lower = upper.toLowerCase();
  return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
}

function readableSentenceCase(value: string) {
  let wordIndex = 0;

  return value
    .split(/(\s+|\/)/)
    .map((part) => {
      if (/^\s+$/.test(part) || part === "/" || part === "-") {
        return part;
      }

      const text = displayWord(part, wordIndex);
      wordIndex += 1;
      return text;
    })
    .join("");
}

function readableDescriptorCase(value: string) {
  let wordIndex = 0;

  return value
    .split(/(\s+|\/)/)
    .map((part) => {
      if (/^\s+$/.test(part) || part === "/" || part === "-") {
        return part;
      }

      const text = descriptorDisplayWord(part, wordIndex);
      wordIndex += 1;
      return text;
    })
    .join("");
}

function preparePublicText(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return cleanUnits(repairObviousSourceSplits(cleanPublicTextPart(value)))
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function readablePublicText(value: string) {
  return value
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/([,.;:])(?!\d)([^\s])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizePublicSearchText(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function publicSearchTerms(value: string | null | undefined) {
  const normalized = normalizePublicSearchText(value);
  if (!normalized) {
    return [];
  }

  const terms = normalized
    .split(/[^a-z0-9_%$-]+/)
    .map((term) => term.trim())
    .filter(Boolean);

  const uniqueTerms = [...new Set(terms)];
  const strongTerms = uniqueTerms.filter((term) => !weakSearchWords.has(term));

  return strongTerms.length > 0 ? strongTerms : uniqueTerms;
}

export function cleanPublicText(value: string | null | undefined) {
  const prepared = preparePublicText(value);

  if (!prepared) {
    return "";
  }

  if (isPublicCodeLikeText(prepared)) {
    return prepared.toUpperCase();
  }

  const cleaned = readablePublicText(prepared);
  if (!cleaned) {
    return "";
  }

  return restoreSpanishAccents(readableSentenceCase(cleaned));
}

export function cleanPublicDescriptorText(value: string | null | undefined) {
  const prepared = preparePublicText(value);

  if (!prepared) {
    return "";
  }

  if (isPublicCodeLikeText(prepared)) {
    return prepared.toUpperCase();
  }

  const cleaned = readablePublicText(prepared);
  if (!cleaned) {
    return "";
  }

  return restoreSpanishAccents(readableDescriptorCase(cleaned));
}
