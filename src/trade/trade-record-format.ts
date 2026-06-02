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

export function formatTradeQuantity(
  value: string | null,
  unit?: string | null,
  fallback = "—",
) {
  if (!value) {
    return fallback;
  }

  return unit ? `${value} ${unit}` : value;
}
