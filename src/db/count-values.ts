export type CountValue = number | string | null | undefined;

export function countValueToNumber(value: CountValue): number {
  if (value === null || value === undefined) {
    return 0;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}
