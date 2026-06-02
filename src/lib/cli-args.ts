export function requiredCliValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }

  return value;
}

export function parsePositiveSafeIntegerCliValue(value: string, flag: string): number {
  if (!/^\d+$/.test(value)) {
    throw new Error(`${flag} must be a positive integer.`);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${flag} must be a positive safe integer.`);
  }

  return parsed;
}
