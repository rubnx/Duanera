import { countValueToNumber } from "@/db/count-values";
import { sourceDisplayFilename, sourceTradeRecordsHref } from "@/sources/source-provenance";
import type { TradeFlow } from "@/trade/trade-records";
import type {
  CodeTableCodeCountInput,
  CodeTableDictionaryProvenance,
  CodeTableRemediationRow,
  CodeTableSourceContext,
  CodeTableSourceField,
} from "@/quality/code-table-remediation";
import type { CodeTableRemediationDefinition } from "@/quality/code-table-remediation-definitions";
import {
  codeTableRemediationHref,
  codeTableRemediationNextAction,
  codeTableRemediationStatus,
  codeTableTopUndecodedCodes,
} from "@/quality/code-table-remediation-helpers";
import type {
  DictionaryRow,
  LayoutFieldRow,
  SourceCountRow,
} from "@/quality/code-table-remediation-loaders";
import {
  coveragePercent,
  normalizeCodeForCoverage,
} from "@/quality/coverage";

const toNumber = countValueToNumber;

export function decodedCodeSet(
  rows: Array<{ codeValue: string; labelEs: string | null }>,
) {
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

export function dictionaryProvenanceFromRow(
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

export function sourceContextFromRow(
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

export function remediationRowFromCounts({
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
