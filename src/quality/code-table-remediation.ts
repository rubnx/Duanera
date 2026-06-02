import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
} from "drizzle-orm";

import type { DbClient } from "@/db/client";
import {
  codeTables,
  codeValues,
  sourceFiles,
  sourceLayoutFields,
  sourceLayouts,
  tradeRecords,
} from "@/db/schema";
import { sourceDisplayFilename, sourceTradeRecordsHref } from "@/sources/source-provenance";
import { buildTradeRecordSearchHref } from "@/trade/trade-record-links";
import type { TradeFlow } from "@/trade/trade-records";
import {
  remediationDefinitions,
  type CodeTableRemediationDefinition,
  type CodeTableRemediationDimension,
  type CodeTableRemediationFilterKind,
  type CodeTableRemediationPriority,
} from "@/quality/code-table-remediation-definitions";
import {
  coveragePercent,
  normalizeCodeForCoverage,
  type DataQualityStatus,
} from "@/quality/coverage";
import {
  march2026ReportPeriod,
  march2026TradeRecordsWhere,
  presentTrimmedTextCondition,
} from "@/quality/march-2026";
import { countValueToNumber, type CountValue } from "@/db/count-values";
import {
  codeTableCodeExpression,
  type SupportedNormalizedCodeField,
} from "@/quality/code-table-remediation-fields";

const reportPeriod = march2026ReportPeriod;

export {
  codeTableRemediationDimensionLabel,
  codeTableRemediationPriorityLabel,
  type CodeTableRemediationDefinition,
  type CodeTableRemediationDimension,
  type CodeTableRemediationFilterKind,
  type CodeTableRemediationPriority,
} from "@/quality/code-table-remediation-definitions";

export type CodeTableSourceField = {
  name: string;
  ordinal: number | null;
  isCoded: boolean;
  layoutCodeTableKey: string | null;
};

export type TopUndecodedCode = {
  code: string;
  normalizedCode: string;
  records: number;
  tradeRecordsHref: string;
};

export type CodeTableSourceContext = {
  sourceFileId: string;
  importBatchId: string;
  sourceLabel: string;
  sourceHref: string;
  tradeRecordsHref: string | null;
  records: number;
};

export type CodeTableDictionaryProvenance = {
  codeTableKey: string;
  tableName: string | null;
  sourceSheetName: string | null;
  reviewStatus: string;
  sourceLabel: string | null;
  sourceHref: string | null;
};

export type CodeTableRemediationRow = {
  id: string;
  tradeFlow: TradeFlow;
  dimension: CodeTableRemediationDimension;
  label: string;
  normalizedField: SupportedNormalizedCodeField;
  sourceFields: CodeTableSourceField[];
  codeTableKey: string;
  codeTableFound: boolean;
  priority: CodeTableRemediationPriority;
  status: DataQualityStatus;
  distinctCodes: number;
  decodedCodes: number;
  undecodedCodes: number;
  recordsWithCode: number;
  recordsWithDecodedCode: number;
  recordsWithSpecialSourceCode: number;
  recordsWithUndecodedCode: number;
  decodedPercent: number;
  topUndecodedCodes: TopUndecodedCode[];
  sourceSpecialCodeNote: string | null;
  sourceContext: CodeTableSourceContext | null;
  dictionaryProvenance: CodeTableDictionaryProvenance | null;
  fieldMappingHref: string;
  tradeRecordsHref: string;
  nextAction: string;
  commercialUse: string;
  unsupportedReason: string | null;
};

export type CodeTableRemediationReport = {
  period: typeof reportPeriod;
  rows: CodeTableRemediationRow[];
  summary: {
    totalDimensions: number;
    highPriorityGaps: number;
    mediumPriorityGaps: number;
    lowPriorityGaps: number;
    recordsWithUndecodedCodes: number;
  };
};

export type CodeTableCodeCountInput = {
  code: string | null;
  records: number | string | null | undefined;
};

type SourceCountRow = {
  sourceFileId: string;
  importBatchId: string;
  originalFilename: string;
  normalizedRawFilename: string | null;
  records: CountValue;
};

type LayoutFieldRow = {
  tradeFlow: string | null;
  sourceFieldName: string;
  fieldOrdinal: number;
  isCoded: boolean;
  codeTableKey: string | null;
};

type DictionaryRow = {
  codeTableKey: string;
  tableName: string | null;
  sourceSheetName: string | null;
  reviewStatus: string;
  sourceFileId: string | null;
  originalFilename: string | null;
  normalizedRawFilename: string | null;
};


const toNumber = countValueToNumber;
const marchTradeWhere = march2026TradeRecordsWhere;
const presentCondition = presentTrimmedTextCondition;

export function codeTableRemediationPriorityRank(
  priority: CodeTableRemediationPriority,
) {
  const ranks: Record<CodeTableRemediationPriority, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };

  return ranks[priority];
}

export function codeTableRemediationStatus({
  codeTableFound = true,
  decodedCodes,
  distinctCodes,
  priority,
  recordsWithCode = 0,
}: {
  codeTableFound?: boolean;
  decodedCodes: number;
  distinctCodes: number;
  priority: CodeTableRemediationPriority;
  recordsWithCode?: number;
}): DataQualityStatus {
  if (!codeTableFound && recordsWithCode > 0) {
    return priority === "high" ? "warning" : "review";
  }

  if (distinctCodes <= 0) {
    return "review";
  }

  if (decodedCodes === distinctCodes) {
    return "ok";
  }

  return priority === "high" ? "warning" : "review";
}

export function codeTableRemediationNextAction({
  codeTableKey,
  codeTableFound = true,
  priority,
  recordsWithUndecodedCode,
  recordsWithSpecialSourceCode = 0,
  sourceSpecialCodeNote,
  unsupportedReason,
}: {
  codeTableKey: string;
  codeTableFound?: boolean;
  priority: CodeTableRemediationPriority;
  recordsWithUndecodedCode: number;
  recordsWithSpecialSourceCode?: number;
  sourceSpecialCodeNote?: string | null;
  unsupportedReason?: string;
}) {
  if (!codeTableFound && recordsWithUndecodedCode > 0) {
    return `Confirmar si la tabla oficial ${codeTableKey} fue cargada o si el campo fuente usa otro diccionario; no corregir valores sin evidencia oficial.`;
  }

  if (recordsWithUndecodedCode === 0) {
    if (recordsWithSpecialSourceCode > 0 && sourceSpecialCodeNote) {
      return `Sin brecha de etiqueta accionable para los códigos restantes. ${sourceSpecialCodeNote}`;
    }

    return unsupportedReason
      ? `Sin brecha de etiqueta detectada; mantener como contexto. ${unsupportedReason}`
      : "Sin brecha de etiqueta detectada en marzo 2026.";
  }

  const specialSuffix = recordsWithSpecialSourceCode > 0 && sourceSpecialCodeNote
    ? ` Mantener separado el valor especial: ${sourceSpecialCodeNote}`
    : "";

  if (priority === "high") {
    return `Priorizar contraste con diccionario/código oficial ${codeTableKey}; afecta filtros o rankings visibles.${specialSuffix}`;
  }

  if (priority === "medium") {
    return `Revisar ${codeTableKey} antes de comparar unidades, moneda o valores agregados.${specialSuffix}`;
  }

  return `Registrar brecha para limpieza posterior; impacto bajo en el MVP actual.${specialSuffix}`;
}

export function codeTableRemediationHref({
  code,
  definition,
}: {
  code?: string;
  definition: {
    filterKind?: CodeTableRemediationFilterKind;
    tradeFlow: TradeFlow;
  };
}) {
  const params: Record<string, string> = {
    tradeFlow: definition.tradeFlow,
    periodYear: String(reportPeriod.year),
    periodMonth: String(reportPeriod.month),
    limit: "25",
  };

  if (code && definition.filterKind) {
    params[definition.filterKind] = code;
  }

  return buildTradeRecordSearchHref(params);
}

export function codeTableTopUndecodedCodes({
  codeRows,
  codeSet,
  definition,
  ignoredSourceCodes = new Set<string>(),
  limit = 5,
}: {
  codeRows: CodeTableCodeCountInput[];
  codeSet: Set<string>;
  definition: {
    filterKind?: CodeTableRemediationFilterKind;
    tradeFlow: TradeFlow;
  };
  ignoredSourceCodes?: Set<string>;
  limit?: number;
}): TopUndecodedCode[] {
  const undecoded = new Map<string, TopUndecodedCode>();

  for (const row of codeRows) {
    const records = toNumber(row.records);
    const normalizedCode = normalizeCodeForCoverage(row.code);
    if (!normalizedCode || codeSet.has(normalizedCode) || ignoredSourceCodes.has(normalizedCode)) {
      continue;
    }

    const displayCode = row.code?.trim() || normalizedCode;
    const existing = undecoded.get(normalizedCode);
    if (existing) {
      existing.records += records;
      continue;
    }

    undecoded.set(normalizedCode, {
      code: displayCode,
      normalizedCode,
      records,
      tradeRecordsHref: codeTableRemediationHref({
        code: displayCode,
        definition,
      }),
    });
  }

  return [...undecoded.values()]
    .sort((a, b) => b.records - a.records || a.normalizedCode.localeCompare(b.normalizedCode))
    .slice(0, limit);
}

function decodedCodeSet(rows: Array<{ codeValue: string; labelEs: string | null }>) {
  const values = new Set<string>();

  for (const row of rows) {
    const normalizedCode = normalizeCodeForCoverage(row.codeValue);
    if (normalizedCode && row.labelEs?.trim()) {
      values.add(normalizedCode);
    }
  }

  return values;
}

function sourceFieldsForDefinition(
  definition: CodeTableRemediationDefinition,
  layoutFields: LayoutFieldRow[],
): CodeTableSourceField[] {
  return definition.rawFields.map((fieldName) => {
    const field = layoutFields.find(
      (row) => row.tradeFlow === definition.tradeFlow && row.sourceFieldName === fieldName,
    );

    return {
      name: fieldName,
      ordinal: field?.fieldOrdinal ?? null,
      isCoded: field?.isCoded ?? false,
      layoutCodeTableKey: field?.codeTableKey ?? null,
    };
  });
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

async function loadCodeTableValues(db: DbClient) {
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

async function loadDictionaryProvenance(db: DbClient) {
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

async function codeCountsForDefinition(
  db: DbClient,
  definition: CodeTableRemediationDefinition,
) {
  const expression = codeTableCodeExpression(definition.normalizedField);

  return db
    .select({
      code: expression,
      records: count(),
    })
    .from(tradeRecords)
    .where(and(marchTradeWhere(definition.tradeFlow), presentCondition(expression)))
    .groupBy(expression);
}

async function sourceContextForDefinition(
  db: DbClient,
  definition: CodeTableRemediationDefinition,
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
    .where(and(marchTradeWhere(definition.tradeFlow), presentCondition(expression)))
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

function dictionaryProvenanceFromRow(
  row: DictionaryRow | undefined,
): CodeTableDictionaryProvenance | null {
  if (!row) {
    return null;
  }

  return {
    codeTableKey: row.codeTableKey,
    tableName: row.tableName,
    sourceSheetName: row.sourceSheetName,
    reviewStatus: row.reviewStatus,
    sourceLabel: row.originalFilename
      ? sourceDisplayFilename({
          originalFilename: row.originalFilename,
          normalizedRawFilename: row.normalizedRawFilename,
        })
      : null,
    sourceHref: row.sourceFileId ? `/sources/${row.sourceFileId}` : null,
  };
}

function sourceContextFromRow(
  row: SourceCountRow | undefined,
  tradeFlow: TradeFlow,
): CodeTableSourceContext | null {
  if (!row) {
    return null;
  }

  return {
    sourceFileId: row.sourceFileId,
    importBatchId: row.importBatchId,
    sourceLabel: sourceDisplayFilename({
      originalFilename: row.originalFilename,
      normalizedRawFilename: row.normalizedRawFilename,
    }),
    sourceHref: `/sources/${row.sourceFileId}#batch-${row.importBatchId}`,
    tradeRecordsHref: sourceTradeRecordsHref({
      sourceFileId: row.sourceFileId,
      importBatchId: row.importBatchId,
      tradeFlow,
    }),
    records: toNumber(row.records),
  };
}

function remediationRowFromCounts({
  codeRows,
  codeSet,
  definition,
  dictionaryProvenance,
  layoutFields,
  sourceContext,
}: {
  codeRows: CodeTableCodeCountInput[];
  codeSet: Set<string>;
  definition: CodeTableRemediationDefinition;
  dictionaryProvenance: CodeTableDictionaryProvenance | null;
  layoutFields: LayoutFieldRow[];
  sourceContext: CodeTableSourceContext | null;
}): CodeTableRemediationRow {
  let decodedCodes = 0;
  let recordsWithCode = 0;
  let recordsWithDecodedCode = 0;
  let recordsWithSpecialSourceCode = 0;
  const specialCodeSet = new Set(
    (definition.sourceSpecialCodes?.codes ?? [])
      .map((code) => normalizeCodeForCoverage(code))
      .filter((code): code is string => Boolean(code)),
  );

  for (const row of codeRows) {
    const records = toNumber(row.records);
    recordsWithCode += records;
    const normalizedCode = normalizeCodeForCoverage(row.code);
    if (!normalizedCode) {
      continue;
    }

    if (specialCodeSet.has(normalizedCode)) {
      recordsWithSpecialSourceCode += records;
      continue;
    }

    if (codeSet.has(normalizedCode)) {
      decodedCodes += 1;
      recordsWithDecodedCode += records;
    }
  }

  const topUndecodedCodes = codeTableTopUndecodedCodes({
    codeRows,
    codeSet,
    definition,
    ignoredSourceCodes: specialCodeSet,
  });
  const distinctCodes = codeRows.filter((row) => {
    const normalizedCode = normalizeCodeForCoverage(row.code);
    return normalizedCode ? !specialCodeSet.has(normalizedCode) : true;
  }).length;
  const undecodedCodeSet = codeRows.reduce((set, row) => {
    const normalizedCode = normalizeCodeForCoverage(row.code);
    if (normalizedCode && !codeSet.has(normalizedCode) && !specialCodeSet.has(normalizedCode)) {
      set.add(normalizedCode);
    }
    return set;
  }, new Set<string>());
  const undecodedCodes = undecodedCodeSet.size;
  const recordsWithUndecodedCode =
    recordsWithCode - recordsWithDecodedCode - recordsWithSpecialSourceCode;
  const codeTableFound = dictionaryProvenance !== null;
  const status = codeTableRemediationStatus({
    codeTableFound,
    decodedCodes,
    distinctCodes,
    priority: definition.priority,
    recordsWithCode,
  });

  return {
    id: definition.id,
    tradeFlow: definition.tradeFlow,
    dimension: definition.dimension,
    label: definition.label,
    normalizedField: definition.normalizedField,
    sourceFields: sourceFieldsForDefinition(definition, layoutFields),
    codeTableKey: definition.codeTableKey,
    codeTableFound,
    priority: definition.priority,
    status,
    distinctCodes,
    decodedCodes,
    undecodedCodes,
    recordsWithCode,
    recordsWithDecodedCode,
    recordsWithSpecialSourceCode,
    recordsWithUndecodedCode,
    decodedPercent: coveragePercent(
      recordsWithDecodedCode,
      recordsWithCode - recordsWithSpecialSourceCode,
    ),
    topUndecodedCodes,
    sourceSpecialCodeNote: definition.sourceSpecialCodes?.note ?? null,
    sourceContext,
    dictionaryProvenance,
    fieldMappingHref: "/data-quality/field-mapping",
    tradeRecordsHref: codeTableRemediationHref({ definition }),
    nextAction: codeTableRemediationNextAction({
      codeTableKey: definition.codeTableKey,
      codeTableFound,
      priority: definition.priority,
      recordsWithUndecodedCode,
      recordsWithSpecialSourceCode,
      sourceSpecialCodeNote: definition.sourceSpecialCodes?.note,
      unsupportedReason: definition.unsupportedReason,
    }),
    commercialUse: definition.commercialUse,
    unsupportedReason: definition.unsupportedReason ?? null,
  };
}


export async function getMarch2026CodeTableRemediationReport(
  db: DbClient,
): Promise<CodeTableRemediationReport> {
  const [layoutFields, codeValuesByKey, dictionaryRows] = await Promise.all([
    loadLayoutFields(db),
    loadCodeTableValues(db),
    loadDictionaryProvenance(db),
  ]);

  const rows = await Promise.all(
    remediationDefinitions.map(async (definition) => {
      const [codeRows, sourceRow] = await Promise.all([
        codeCountsForDefinition(db, definition),
        sourceContextForDefinition(db, definition),
      ]);
      const codeSet = decodedCodeSet(codeValuesByKey.get(definition.codeTableKey) ?? []);

      return remediationRowFromCounts({
        codeRows,
        codeSet,
        definition,
        dictionaryProvenance: dictionaryProvenanceFromRow(
          dictionaryRows.get(definition.codeTableKey),
        ),
        layoutFields,
        sourceContext: sourceContextFromRow(sourceRow, definition.tradeFlow),
      });
    }),
  );

  const sortedRows = rows.sort((a, b) => {
    const priorityDelta =
      codeTableRemediationPriorityRank(a.priority) -
      codeTableRemediationPriorityRank(b.priority);
    if (priorityDelta !== 0) {
      return priorityDelta;
    }

    if (a.recordsWithUndecodedCode !== b.recordsWithUndecodedCode) {
      return b.recordsWithUndecodedCode - a.recordsWithUndecodedCode;
    }

    return a.label.localeCompare(b.label);
  });

  return {
    period: reportPeriod,
    rows: sortedRows,
    summary: {
      totalDimensions: sortedRows.length,
      highPriorityGaps: sortedRows.filter(
        (row) => row.priority === "high" && row.recordsWithUndecodedCode > 0,
      ).length,
      mediumPriorityGaps: sortedRows.filter(
        (row) => row.priority === "medium" && row.recordsWithUndecodedCode > 0,
      ).length,
      lowPriorityGaps: sortedRows.filter(
        (row) => row.priority === "low" && row.recordsWithUndecodedCode > 0,
      ).length,
      recordsWithUndecodedCodes: sortedRows.reduce(
        (total, row) => total + row.recordsWithUndecodedCode,
        0,
      ),
    },
  };
}
