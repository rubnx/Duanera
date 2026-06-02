const esClIntegerFormatter = new Intl.NumberFormat("es-CL", {
  maximumFractionDigits: 0,
});

const esClWholePercentFormatter = new Intl.NumberFormat("es-CL", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
});

const esClDecimalPercentFormatter = new Intl.NumberFormat("es-CL", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});

export function formatIntegerEsCl(value: number): string {
  return esClIntegerFormatter.format(value);
}

export function formatNullableIntegerEsCl(
  value: number | null | undefined,
  fallback = "No informado",
): string {
  if (value === null || value === undefined) {
    return fallback;
  }

  return formatIntegerEsCl(value);
}

export function formatPercentEsCl(value: number): string {
  return (value % 1 === 0 ? esClWholePercentFormatter : esClDecimalPercentFormatter).format(value);
}
