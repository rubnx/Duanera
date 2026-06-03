import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
} from "drizzle-orm";

import type { DbClient } from "@/db/client";
import { type CountValue } from "@/db/count-values";
import {
  codeTables,
  codeValues,
  sourceFiles,
  sourceLayoutFields,
  sourceLayouts,
  tradeRecords,
} from "@/db/schema";
import type { CodeTableRemediationDefinition } from "@/quality/code-table-remediation-definitions";
import { remediationDefinitions } from "@/quality/code-table-remediation-definitions";
import { codeTableCodeExpression } from "@/quality/code-table-remediation-fields";
import {
  march2026ReportPeriod,
  presentTrimmedTextCondition,
  qualityTradeRecordsWhere,
  type QualityReportPeriod,
} from "@/quality/march-2026";

const presentCondition = presentTrimmedTextCondition;

export type SourceCountRow = {
  sourceFileId: string;
  importBatchId: string;
  originalFilename: string;
  normalizedRawFilename: string | null;
  records: CountValue;
};

export type LayoutFieldRow = {
  tradeFlow: string | null;
  sourceFieldName: string;
  fieldOrdinal: number;
  isCoded: boolean;
  codeTableKey: string | null;
};

export type DictionaryRow = {
  codeTableKey: string;
  tableName: string | null;
  sourceSheetName: string | null;
  reviewStatus: string;
  sourceFileId: string | null;
  originalFilename: string | null;
  normalizedRawFilename: string | null;
};

export async function loadLayoutFields(db: DbClient) {
  return db
    .select({
      tradeFlow: sourceLayouts.tradeFlow,
      sourceFieldName: sourceLayoutFields.sourceFieldName,
      fieldOrdinal: sourceLayoutFields.fieldOrdinal,
      isCoded: sourceLayoutFields.isCoded,
      codeTableKey: sourceLayoutFields.codeTableKey,
    })
    .from(sourceLayoutFields)
    .innerJoin(sourceLayouts, eq(sourceLayoutFields.sourceLayoutId, sourceLayouts.id))
    .where(
      and(
        eq(sourceLayouts.countryCode, "CL"),
        eq(sourceLayouts.sourceSystem, "chile_aduana"),
        eq(sourceLayouts.sourceDomain, "datos.gob.cl"),
        eq(sourceLayouts.recordRole, "main_data"),
      ),
    )
    .orderBy(asc(sourceLayouts.tradeFlow), asc(sourceLayoutFields.fieldOrdinal));
}

export async function loadCodeTableValues(db: DbClient) {
  const keys = [...new Set(remediationDefinitions.map((definition) => definition.codeTableKey))];
  const rows = await db
    .select({
      codeTableKey: codeTables.codeTableKey,
      codeValue: codeValues.codeValue,
      labelEs: codeValues.labelEs,
    })
    .from(codeValues)
    .innerJoin(codeTables, eq(codeValues.codeTableId, codeTables.id))
    .where(inArray(codeTables.codeTableKey, keys));

  const rowsByKey = new Map<string, Array<{ codeValue: string; labelEs: string | null }>>();
  for (const row of rows) {
    const existing = rowsByKey.get(row.codeTableKey) ?? [];
    existing.push({ codeValue: row.codeValue, labelEs: row.labelEs });
    rowsByKey.set(row.codeTableKey, existing);
  }

  return rowsByKey;
}

export async function loadDictionaryProvenance(db: DbClient) {
  const keys = [...new Set(remediationDefinitions.map((definition) => definition.codeTableKey))];
  const rows = await db
    .select({
      codeTableKey: codeTables.codeTableKey,
      tableName: codeTables.tableName,
      sourceSheetName: codeTables.sourceSheetName,
      reviewStatus: codeTables.reviewStatus,
      sourceFileId: codeTables.sourceFileId,
      originalFilename: sourceFiles.originalFilename,
      normalizedRawFilename: sourceFiles.normalizedRawFilename,
    })
    .from(codeTables)
    .leftJoin(sourceFiles, eq(codeTables.sourceFileId, sourceFiles.id))
    .where(inArray(codeTables.codeTableKey, keys));

  return new Map(rows.map((row) => [row.codeTableKey, row]));
}

export async function codeCountsForDefinition(
  db: DbClient,
  definition: CodeTableRemediationDefinition,
  period: QualityReportPeriod = march2026ReportPeriod,
) {
  const expression = codeTableCodeExpression(definition.normalizedField);

  return db
    .select({
      code: expression,
      records: count(),
    })
    .from(tradeRecords)
    .where(and(qualityTradeRecordsWhere(period, definition.tradeFlow), presentCondition(expression)))
    .groupBy(expression);
}

export async function sourceContextForDefinition(
  db: DbClient,
  definition: CodeTableRemediationDefinition,
  period: QualityReportPeriod = march2026ReportPeriod,
) {
  const expression = codeTableCodeExpression(definition.normalizedField);
  const [row] = await db
    .select({
      sourceFileId: tradeRecords.sourceFileId,
      importBatchId: tradeRecords.importBatchId,
      originalFilename: sourceFiles.originalFilename,
      normalizedRawFilename: sourceFiles.normalizedRawFilename,
      records: count(),
    })
    .from(tradeRecords)
    .innerJoin(sourceFiles, eq(tradeRecords.sourceFileId, sourceFiles.id))
    .where(and(qualityTradeRecordsWhere(period, definition.tradeFlow), presentCondition(expression)))
    .groupBy(
      tradeRecords.sourceFileId,
      tradeRecords.importBatchId,
      sourceFiles.originalFilename,
      sourceFiles.normalizedRawFilename,
    )
    .orderBy(desc(count()))
    .limit(1);

  return row;
}
