import type { FieldMappingDefinition } from "@/quality/field-mapping-definitions";
import { rawSampleValueRecord } from "@/quality/field-mapping-helpers";

export type FieldMappingRawSampleRow = {
  tradeFlow: string | null;
  rawValues: unknown;
};

export function fieldMappingSampleValues(
  definition: FieldMappingDefinition,
  rawSamples: FieldMappingRawSampleRow[],
): string[] {
  const values: string[] = [];
  const seen = new Set<string>();

  for (const row of rawSamples) {
    const rawValues = rawSampleValueRecord(row.rawValues);
    if (row.tradeFlow !== definition.tradeFlow || !rawValues) {
      continue;
    }

    for (const fieldName of definition.rawFields) {
      const rawValue = rawValues[fieldName];
      const value = typeof rawValue === "string" ? rawValue.trim() : "";
      if (!value) {
        continue;
      }

      const displayValue = definition.rawFields.length > 1
        ? `${fieldName}: ${value}`
        : value;
      if (seen.has(displayValue)) {
        continue;
      }

      seen.add(displayValue);
      values.push(displayValue);
      if (values.length >= 3) {
        return values;
      }
    }
  }

  return values;
}

export function fieldMappingRawSampleCoverage(
  definition: FieldMappingDefinition,
  rawSamples: FieldMappingRawSampleRow[],
): { sampleRows: number; presentRows: number } {
  let sampleRows = 0;
  let presentRows = 0;

  for (const row of rawSamples) {
    const rawValues = rawSampleValueRecord(row.rawValues);
    if (row.tradeFlow !== definition.tradeFlow || !rawValues) {
      continue;
    }

    sampleRows += 1;
    const hasPresentValue = definition.rawFields.some((fieldName) => {
      const rawValue = rawValues[fieldName];
      return typeof rawValue === "string" && rawValue.trim().length > 0;
    });

    if (hasPresentValue) {
      presentRows += 1;
    }
  }

  return { sampleRows, presentRows };
}
