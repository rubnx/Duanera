import { cleanPublicReferenceLabel } from "@/text/reference-labels";
import {
  countryNameForFlagCode,
  normalizeCountryFlagCode,
} from "@/trade/country-codes";

export function formatTradeDecimal(
  value: string | number | null | undefined,
  fractionDigits = 2,
  fallback = "—",
) {
  if (value === null || value === undefined) {
    return fallback;
  }

  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue)) {
    return String(value);
  }

  return new Intl.NumberFormat("es-CL", {
    maximumFractionDigits: fractionDigits,
  }).format(numericValue);
}

export function formatTradeMoney(
  value: string | null,
  currency?: string,
  fallback = "—",
) {
  if (!value) {
    return fallback;
  }

  return currency ? `${value} ${currency}` : value;
}

export function formatTradeCurrencyLabel(currency?: string | null) {
  if (!currency) {
    return undefined;
  }

  const normalized = normalizeLookupValue(currency);

  if (
    normalized === "dolar" ||
    normalized === "dolares" ||
    normalized === "dolar usa" ||
    normalized === "dolar estadounidense"
  ) {
    return "US$";
  }

  return currency.trim();
}

export function formatTradeMoneyDisplay(
  value: string | null,
  currency?: string | null,
  {
    fallback = "No informado",
    includeCurrency = false,
  }: {
    fallback?: string;
    includeCurrency?: boolean;
  } = {},
) {
  if (!value) {
    return fallback;
  }

  const formattedValue = formatTradeDecimal(value, 2, value);
  const currencyLabel = includeCurrency ? formatTradeCurrencyLabel(currency) : undefined;

  return currencyLabel ? `${formattedValue} ${currencyLabel}` : formattedValue;
}

export function formatTradeSummaryValue(
  value: string | null,
  suffix?: string,
  fractionDigits = 2,
  fallback = "—",
) {
  if (!value) {
    return fallback;
  }

  const formattedValue = formatTradeDecimal(value, fractionDigits, fallback);
  return suffix ? `${formattedValue} ${suffix}` : formattedValue;
}

export function formatTradeCodeLabel(
  code: string | null,
  label?: string,
  fallback = "—",
) {
  if (!code && !label) {
    return fallback;
  }

  if (code && label) {
    return `${code} · ${label}`;
  }

  return code ?? label ?? fallback;
}

export type TradeDisplayCodeKind =
  | "cargoType"
  | "country"
  | "customsOffice"
  | "generic"
  | "port"
  | "transportMode";

const transportDisplayByCode = new Map<string, string>([
  ["1", "Marítimo"],
  ["4", "Aéreo"],
  ["5", "Postal"],
  ["6", "Ferroviario"],
  ["7", "Terrestre"],
  ["8", "Oleoducto / gasoducto"],
  ["9", "Tendido eléctrico"],
  ["10", "Otra vía"],
  ["11", "Courier aéreo"],
]);

function normalizeLookupValue(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function toReadableSourceLabel(value: string) {
  return cleanPublicReferenceLabel(value);
}

function formatCountryDisplay(code: string | null, label?: string, fallback = "—") {
  const readableLabel = label ? toReadableSourceLabel(label) : "";
  const isoCode = normalizeCountryFlagCode(code, readableLabel);
  const countryName = readableLabel || countryNameForFlagCode(isoCode);

  if (countryName) {
    return countryName;
  }

  if (code) {
    return `Código ${code}`;
  }

  return fallback;
}

function formatTransportModeDisplay(code: string | null, label?: string, fallback = "—") {
  const mappedByCode = code ? transportDisplayByCode.get(code) : undefined;

  if (mappedByCode) {
    return mappedByCode;
  }

  if (!label) {
    return code ? `Código ${code}` : fallback;
  }

  const normalizedLabel = normalizeLookupValue(label);

  if (normalizedLabel.includes("maritima") || normalizedLabel.includes("fluvial")) {
    return "Marítimo";
  }

  if (normalizedLabel.includes("courier") && normalizedLabel.includes("aereo")) {
    return "Courier aéreo";
  }

  if (normalizedLabel.includes("aereo")) {
    return "Aéreo";
  }

  if (normalizedLabel.includes("carretero") || normalizedLabel.includes("terrestre")) {
    return "Terrestre";
  }

  if (normalizedLabel.includes("oleoductos") || normalizedLabel.includes("gasoductos")) {
    return "Oleoducto / gasoducto";
  }

  return toReadableSourceLabel(label);
}

export function formatTradeDisplayCodeLabel({
  code,
  fallback = "—",
  kind = "generic",
  label,
}: {
  code: string | null;
  fallback?: string;
  kind?: TradeDisplayCodeKind;
  label?: string;
}) {
  if (!code && !label) {
    return fallback;
  }

  if (kind === "country") {
    return formatCountryDisplay(code, label, fallback);
  }

  if (kind === "transportMode") {
    return formatTransportModeDisplay(code, label, fallback);
  }

  if (label) {
    return toReadableSourceLabel(label);
  }

  return code ? `Código ${code}` : fallback;
}

export function formatTradeQuantity(
  value: string | null,
  unitCode?: string | null,
  unitLabel?: string | null,
  fallback = "—",
) {
  if (!value) {
    return fallback;
  }

  const unit = unitLabel ?? unitCode;
  return unit ? `${value} ${unit}` : value;
}

const quantityUnitDisplayByCode = new Map<string, string>([
  ["KN", "kg netos"],
  ["KG", "kg"],
  ["KGS", "kg"],
  ["TON", "toneladas"],
  ["U", "unidades"],
  ["UN", "unidades"],
  ["UNI", "unidades"],
  ["PCS", "piezas"],
]);

function readableQuantityUnit(unitCode?: string | null, unitLabel?: string | null) {
  const code = unitCode?.trim().toUpperCase();
  const labelAsCode = unitLabel?.trim().toUpperCase();

  if (code && quantityUnitDisplayByCode.has(code)) {
    return quantityUnitDisplayByCode.get(code);
  }

  if (labelAsCode && quantityUnitDisplayByCode.has(labelAsCode)) {
    return quantityUnitDisplayByCode.get(labelAsCode);
  }

  if (!unitLabel) {
    return unitCode?.trim() || undefined;
  }

  const normalizedLabel = normalizeLookupValue(unitLabel);

  if (normalizedLabel === "kilogramos netos") {
    return "kg netos";
  }

  if (normalizedLabel === "kilogramos") {
    return "kg";
  }

  if (normalizedLabel === "unidades") {
    return "unidades";
  }

  if (normalizedLabel === "tonelada" || normalizedLabel === "toneladas") {
    return "toneladas";
  }

  return toReadableSourceLabel(unitLabel);
}

export function formatTradeQuantityUnitDisplay(
  unitCode?: string | null,
  unitLabel?: string | null,
  fallback = "No informado",
) {
  return readableQuantityUnit(unitCode, unitLabel) ?? fallback;
}

type TradeQuantityDisplayOptions = {
  compactNetWeightUnit?: boolean;
};

function compactQuantityUnit(unit: string | undefined, options: TradeQuantityDisplayOptions) {
  if (options.compactNetWeightUnit && unit === "kg netos") {
    return "kg";
  }

  return unit;
}

export function formatTradeQuantityDisplay(
  value: string | null,
  unitCode?: string | null,
  unitLabel?: string | null,
  fallback = "No informado",
  options: TradeQuantityDisplayOptions = {},
) {
  if (!value) {
    return fallback;
  }

  const unit = compactQuantityUnit(readableQuantityUnit(unitCode, unitLabel), options);
  return unit ? `${formatTradeDecimal(value, 2, value)} ${unit}` : formatTradeDecimal(value, 2, value);
}
