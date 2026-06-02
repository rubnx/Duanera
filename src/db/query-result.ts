export function queryResultRows<T>(
  result: unknown,
  context = "database query result",
): T[] {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new Error(`${context} must be an object with a rows array.`);
  }

  const rows = Object.getOwnPropertyDescriptor(result, "rows")?.value;
  if (!Array.isArray(rows)) {
    throw new Error(`${context} rows must be an array.`);
  }

  return rows as T[];
}
