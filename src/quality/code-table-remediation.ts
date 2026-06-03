import type { DbClient } from "@/db/client";
import type { TradeFlow } from "@/trade/trade-records";
import {
  remediationDefinitions,
  type CodeTableRemediationDimension,
  type CodeTableRemediationPriority,
} from "@/quality/code-table-remediation-definitions";
import { type DataQualityStatus } from "@/quality/coverage";
import {
  march2026ReportPeriod,
  type QualityReportPeriod,
} from "@/quality/march-2026";
import { type SupportedNormalizedCodeField } from "@/quality/code-table-remediation-fields";
import {
  codeCountsForDefinition,
  loadCodeTableValues,
  loadDictionaryProvenance,
  loadLayoutFields,
  sourceContextForDefinition,
} from "@/quality/code-table-remediation-loaders";
import {
  decodedCodeSet,
  dictionaryProvenanceFromRow,
  remediationRowFromCounts,
  sourceContextFromRow,
} from "@/quality/code-table-remediation-rows";
import {
  codeTableRemediationPriorityRank,
} from "@/quality/code-table-remediation-helpers";

export {
  codeTableRemediationDimensionLabel,
  codeTableRemediationPriorityLabel,
  type CodeTableRemediationDefinition,
  type CodeTableRemediationDimension,
  type CodeTableRemediationFilterKind,
  type CodeTableRemediationPriority,
} from "@/quality/code-table-remediation-definitions";
export {
  codeTableRemediationHref,
  codeTableRemediationNextAction,
  codeTableRemediationPriorityRank,
  codeTableRemediationStatus,
  codeTableTopUndecodedCodes,
} from "@/quality/code-table-remediation-helpers";

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
  period: QualityReportPeriod;
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

export async function getCodeTableRemediationReport(
  db: DbClient,
  period: QualityReportPeriod = march2026ReportPeriod,
): Promise<CodeTableRemediationReport> {
  const [layoutFields, codeValuesByKey, dictionaryRows] = await Promise.all([
    loadLayoutFields(db),
    loadCodeTableValues(db),
    loadDictionaryProvenance(db),
  ]);

  const rows = await Promise.all(
    remediationDefinitions.map(async (definition) => {
      const [codeRows, sourceRow] = await Promise.all([
        codeCountsForDefinition(db, definition, period),
        sourceContextForDefinition(db, definition, period),
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
        period,
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
    period,
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

export async function getMarch2026CodeTableRemediationReport(
  db: DbClient,
): Promise<CodeTableRemediationReport> {
  return getCodeTableRemediationReport(db, march2026ReportPeriod);
}
