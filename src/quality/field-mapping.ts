import {
  and,
  asc,
  count,
  eq,
  sql,
  type SQL,
} from "drizzle-orm";

import type { DbClient } from "@/db/client";
import {
  rawTradeRows,
  sourceFiles,
  sourceLayoutFields,
  sourceLayouts,
  tradeRecords,
} from "@/db/schema";
import { sourceDisplayFilename } from "@/sources/source-provenance";
import {
  fieldMappingDefinitions,
  type FieldMappingConfidence,
  type FieldMappingDefinition,
  type FieldMappingGroup,
} from "@/quality/field-mapping-definitions";
import type { TradeFlow } from "@/trade/trade-records";
import { coveragePercent, type DataQualityStatus } from "@/quality/coverage";
import {
  march2026RawTradeRowsWhere,
  march2026ReportPeriod,
  march2026TradeRecordsWhere,
} from "@/quality/march-2026";
import { countValueToNumber, type CountValue } from "@/db/count-values";
import {
  normalizedPresentCondition,
  type NormalizedFieldKey,
} from "@/quality/field-mapping-normalized";
import {
  fieldMappingCoverageStatus,
  fieldMappingSearchHref,
} from "@/quality/field-mapping-helpers";
import {
  fieldMappingRawSampleCoverage,
  fieldMappingSampleValues,
  type FieldMappingRawSampleRow,
} from "@/quality/field-mapping-samples";

const reportPeriod = march2026ReportPeriod;

export {
  fieldMappingConfidenceLabel,
  fieldMappingGroupLabel,
  type FieldMappingConfidence,
  type FieldMappingDefinition,
  type FieldMappingGroup,
} from "@/quality/field-mapping-definitions";
export {
  fieldMappingCoverageStatus,
  fieldMappingSearchHref,
  fieldMappingSourceTradeHref,
  rawSampleValueRecord,
} from "@/quality/field-mapping-helpers";

export type FieldMappingRawField = {
  name: string;
  ordinal: number | null;
  isCoded: boolean;
  codeTableKey: string | null;
};

export type FieldMappingRow = {
  id: string;
  tradeFlow: TradeFlow;
  group: FieldMappingGroup;
  label: string;
  normalizedField: NormalizedFieldKey;
  rawFields: FieldMappingRawField[];
  confidence: FieldMappingConfidence;
  status: DataQualityStatus;
  note: string;
  totalRows: number;
  rawSampleRows: number;
  rawPresentRows: number;
  rawCoveragePercent: number;
  normalizedPresentRows: number;
  normalizedCoveragePercent: number;
  sampleValues: string[];
  tradeRecordsHref: string;
  sourceHref: string | null;
  sourceLabel: string | null;
};

export type FieldMappingReport = {
  period: typeof reportPeriod;
  rows: FieldMappingRow[];
  summary: {
    totalMappings: number;
    verifiedMappings: number;
    inferredMappings: number;
    reviewMappings: number;
    warningMappings: number;
  };
};

type LayoutFieldRow = {
  tradeFlow: string | null;
  sourceFieldName: string;
  fieldOrdinal: number;
  isCoded: boolean;
  codeTableKey: string | null;
};

type SourceContextRow = {
  tradeFlow: string | null;
  sourceFileId: string;
  importBatchId: string;
  originalFilename: string;
  normalizedRawFilename: string | null;
};

const toNumber = countValueToNumber;
const marchRawWhere = march2026RawTradeRowsWhere;
const marchTradeWhere = march2026TradeRecordsWhere;

function layoutFieldMap(rows: LayoutFieldRow[]) {
  const map = new Map<string, FieldMappingRawField>();

  for (const row of rows) {
    if (row.tradeFlow !== "import" && row.tradeFlow !== "export") {
      continue;
    }

    map.set(`${row.tradeFlow}:${row.sourceFieldName}`, {
      name: row.sourceFieldName,
      ordinal: row.fieldOrdinal,
      isCoded: row.isCoded,
      codeTableKey: row.codeTableKey,
    });
  }

  return map;
}

function rawFieldsForDefinition(
  definition: FieldMappingDefinition,
  fieldsByFlowAndName: Map<string, FieldMappingRawField>,
) {
  return definition.rawFields.map((fieldName) => (
    fieldsByFlowAndName.get(`${definition.tradeFlow}:${fieldName}`) ?? {
      name: fieldName,
      ordinal: null,
      isCoded: false,
      codeTableKey: null,
    }
  ));
}

async function loadLayoutFields(db: DbClient) {
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

async function loadRawSamples(db: DbClient) {
  const rows: FieldMappingRawSampleRow[] = [];

  for (const tradeFlow of ["import", "export"] satisfies TradeFlow[]) {
    const flowRows = await db
      .select({
        tradeFlow: rawTradeRows.tradeFlow,
        rawValues: rawTradeRows.rawValues,
      })
      .from(rawTradeRows)
      .where(
        and(
          marchRawWhere(tradeFlow),
          eq(rawTradeRows.parseStatus, "parsed"),
          sql`${rawTradeRows.rawValues} is not null`,
        ),
      )
      .orderBy(asc(rawTradeRows.rowNumber))
      .limit(250);

    rows.push(...flowRows);
  }

  return rows;
}

async function loadSourceContexts(db: DbClient) {
  const contexts = new Map<TradeFlow, SourceContextRow>();

  for (const tradeFlow of ["import", "export"] satisfies TradeFlow[]) {
    const [row] = await db
      .select({
        tradeFlow: tradeRecords.tradeFlow,
        sourceFileId: tradeRecords.sourceFileId,
        importBatchId: tradeRecords.importBatchId,
        originalFilename: sourceFiles.originalFilename,
        normalizedRawFilename: sourceFiles.normalizedRawFilename,
      })
      .from(tradeRecords)
      .innerJoin(sourceFiles, eq(tradeRecords.sourceFileId, sourceFiles.id))
      .where(marchTradeWhere(tradeFlow))
      .orderBy(asc(sourceFiles.originalFilename), asc(tradeRecords.importBatchId))
      .limit(1);

    if (row.tradeFlow === "import" || row.tradeFlow === "export") {
      contexts.set(row.tradeFlow, row);
    }
  }

  return contexts;
}

async function loadNormalizedCoverage(
  db: DbClient,
  tradeFlow: TradeFlow,
  definitions: FieldMappingDefinition[],
) {
  const selectFields: Record<string, SQL<number>> = {
    total: count(),
  };

  for (const definition of definitions) {
    selectFields[definition.id] = sql<number>`count(*) filter (where ${normalizedPresentCondition(definition.normalizedField)})`;
  }

  const [row] = await db
    .select(selectFields)
    .from(tradeRecords)
    .where(marchTradeWhere(tradeFlow));

  return row ?? {};
}


export async function getMarch2026FieldMappingReport(
  db: DbClient,
): Promise<FieldMappingReport> {
  const [layoutFields, rawSamples, sourceContexts] = await Promise.all([
    loadLayoutFields(db),
    loadRawSamples(db),
    loadSourceContexts(db),
  ]);
  const fieldsByFlowAndName = layoutFieldMap(layoutFields);

  const rows: FieldMappingRow[] = [];

  for (const tradeFlow of ["import", "export"] satisfies TradeFlow[]) {
    const definitions = fieldMappingDefinitions.filter(
      (definition) => definition.tradeFlow === tradeFlow,
    );
    const normalizedCoverage = await loadNormalizedCoverage(db, tradeFlow, definitions);
    const totalRows = toNumber(normalizedCoverage.total);
    const sourceContext = sourceContexts.get(tradeFlow);

    for (const definition of definitions) {
      const rawSampleCoverage = fieldMappingRawSampleCoverage(definition, rawSamples);
      const rawPresentRows = rawSampleCoverage.presentRows;
      const normalizedPresentRows = toNumber(normalizedCoverage[definition.id]);
      const status = fieldMappingCoverageStatus({
        confidence: definition.confidence,
        normalizedTotalRows: totalRows,
        normalizedPresentRows,
        rawFields: definition.rawFields,
        rawSampleRows: rawSampleCoverage.sampleRows,
        rawPresentRows,
      });

      rows.push({
        id: definition.id,
        tradeFlow,
        group: definition.group,
        label: definition.label,
        normalizedField: definition.normalizedField,
        rawFields: rawFieldsForDefinition(definition, fieldsByFlowAndName),
        confidence: definition.confidence,
        status,
        note: definition.note,
        totalRows,
        rawSampleRows: rawSampleCoverage.sampleRows,
        rawPresentRows,
        rawCoveragePercent: coveragePercent(rawPresentRows, rawSampleCoverage.sampleRows),
        normalizedPresentRows,
        normalizedCoveragePercent: coveragePercent(normalizedPresentRows, totalRows),
        sampleValues: fieldMappingSampleValues(definition, rawSamples),
        tradeRecordsHref: fieldMappingSearchHref(tradeFlow),
        sourceHref: sourceContext
          ? `/sources/${sourceContext.sourceFileId}#batch-${sourceContext.importBatchId}`
          : null,
        sourceLabel: sourceContext
          ? sourceDisplayFilename({
              originalFilename: sourceContext.originalFilename,
              normalizedRawFilename: sourceContext.normalizedRawFilename,
            })
          : null,
      });
    }
  }

  return {
    period: reportPeriod,
    rows,
    summary: {
      totalMappings: rows.length,
      verifiedMappings: rows.filter((row) => row.confidence === "verified").length,
      inferredMappings: rows.filter((row) => row.confidence === "inferred").length,
      reviewMappings: rows.filter((row) => row.confidence === "needs_review").length,
      warningMappings: rows.filter((row) => row.status === "warning").length,
    },
  };
}
