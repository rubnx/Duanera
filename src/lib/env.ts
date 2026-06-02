export function positiveIntegerEnvValue(
  name: string,
  raw: string | undefined,
  defaultValue: number,
): number {
  if (!raw) {
    return defaultValue;
  }

  if (!/^\d+$/.test(raw)) {
    throw new Error(`${name} must be a positive integer, got ${raw}.`);
  }

  const parsed = Number.parseInt(raw, 10);
  if (parsed <= 0) {
    throw new Error(`${name} must be a positive integer, got ${raw}.`);
  }

  return parsed;
}
