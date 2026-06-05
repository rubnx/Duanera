import { cleanPublicTextPart } from "@/text/public-text";

const lowercaseReferenceWords = new Set([
  "a",
  "administrativa",
  "al",
  "de",
  "del",
  "e",
  "el",
  "en",
  "la",
  "las",
  "lo",
  "los",
  "no",
  "o",
  "otras",
  "otros",
  "por",
  "puerto",
  "puertos",
  "especial",
  "sin",
  "u",
  "y",
  "especificado",
  "especificados",
  "identificado",
  "identificados",
]);

const uppercaseReferenceWords = new Set(["F", "R", "RF", "S", "A", "M", "C", "I"]);

const referenceAccentWords = new Map([
  ["africa", "áfrica"],
  ["arabes", "árabes"],
  ["america", "américa"],
  ["atlantico", "atlántico"],
  ["aereo", "aéreo"],
  ["aerodromo", "aeródromo"],
  ["asiatico", "asiático"],
  ["asiaticos", "asiáticos"],
  ["belgica", "bélgica"],
  ["cadiz", "cádiz"],
  ["cordoba", "córdoba"],
  ["genova", "génova"],
  ["libano", "líbano"],
  ["madrid", "madrid"],
  ["maritimo", "marítimo"],
  ["maritimos", "marítimos"],
  ["mexico", "méxico"],
  ["napoles", "nápoles"],
  ["o'higgins", "o'higgins"],
  ["panama", "panamá"],
  ["paraiso", "paraíso"],
  ["pacifico", "pacífico"],
  ["peru", "perú"],
  ["region", "región"],
  ["tunez", "túnez"],
  ["turquia", "turquía"],
  ["valparaiso", "valparaíso"],
]);

function normalizeReferenceWord(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es-CL");
}

function lowerReferenceWord(value: string) {
  const normalized = normalizeReferenceWord(value);
  return referenceAccentWords.get(normalized) ?? value.toLocaleLowerCase("es-CL");
}

function titleReferenceWord(value: string) {
  const lower = lowerReferenceWord(value);
  return `${lower.charAt(0).toLocaleUpperCase("es-CL")}${lower.slice(1)}`;
}

export function cleanPublicReferenceLabel(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  let wordIndex = 0;
  return cleanPublicTextPart(value)
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/\s+/g, " ")
    .replace(/\p{L}+(?:'\p{L}+)*/gu, (word) => {
      const normalized = normalizeReferenceWord(word);
      const upper = word.toUpperCase();
      const shouldLower =
        wordIndex > 0 && lowercaseReferenceWords.has(normalized);
      wordIndex += 1;

      if (uppercaseReferenceWords.has(upper)) {
        return upper;
      }

      return shouldLower ? lowerReferenceWord(word) : titleReferenceWord(word);
    })
    .trim();
}
