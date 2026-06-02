import { countValueToNumber, type CountValue } from "@/db/count-values";
import type { DataQualityStatus } from "@/quality/coverage";
import { isActionableUndecodedCode } from "@/quality/coverage";
import { dataQualitySourceBatchHref } from "@/quality/data-quality-issues";
import {
  sourceDisplayFilename,
  sourceTradeRecordsHref,
} from "@/sources/source-provenance";
import type { TradeFlow } from "@/trade/trade-records";

export type DataQualityRemediationIssueCounts = {
  missingImportGrossWeightItem: number;
  undecodedCustomsOffice: number;
  undecodedPort: number;
  undecodedTransportMode: number;
  missingOrZeroItemValue: number;
  missingOrZeroDeclarationFob: number;
  quantityUnitValueReview: number;
};

export type DataQualitySourceBatchRemediation = {
  sourceFileId: string;
  importBatchId: string;
  tradeFlow: TradeFlow;
  filename: string;
  parserName: string;
  parserVersion: string;
  batchStatus: string;
  tradeRecords: number;
  issueCounts: DataQualityRemediationIssueCounts;
  totalIssueSignals: number;
  status: DataQualityStatus;
  nextStep: string;
  sourceHref: string;
  tradeRecordsHref: string | null;
};

export type SourceBatchRemediationBaseRow = {
  sourceFileId: string;
  importBatchId: string;
  tradeFlow: string;
  originalFilename: string;
  normalizedRawFilename: string | null;
  parserName: string;
  parserVersion: string;
  batchStatus: string;
  tradeRecords: CountValue;
  missingImportGrossWeightItem: CountValue;
  missingOrZeroItemValue: CountValue;
  missingOrZeroDeclarationFob: CountValue;
  quantityUnitValueReview: CountValue;
};

export type SourceBatchCodeCountRow = {
  sourceFileId: string;
  importBatchId: string;
  tradeFlow: string;
  code: string | null;
  records: CountValue;
};

export function dataQualitySourceBatchKey({
  importBatchId,
  sourceFileId,
  tradeFlow,
}: {
  sourceFileId: string;
  importBatchId: string;
  tradeFlow: string;
}) {
  return `${sourceFileId}:${importBatchId}:${tradeFlow}`;
}

export function dataQualityRemediationTotal(
  counts: DataQualityRemediationIssueCounts,
) {
  return (
    counts.missingImportGrossWeightItem +
    counts.undecodedCustomsOffice +
    counts.undecodedPort +
    counts.undecodedTransportMode +
    counts.missingOrZeroItemValue +
    counts.missingOrZeroDeclarationFob +
    counts.quantityUnitValueReview
  );
}

export function dataQualityRemediationStatus(
  counts: DataQualityRemediationIssueCounts,
): DataQualityStatus {
  if (
    counts.missingImportGrossWeightItem > 0 ||
    counts.missingOrZeroItemValue > 0 ||
    counts.missingOrZeroDeclarationFob > 0
  ) {
    return "warning";
  }

  return dataQualityRemediationTotal(counts) > 0 ? "review" : "ok";
}

export function dataQualityRemediationNextStep(
  counts: DataQualityRemediationIssueCounts,
) {
  if (counts.missingOrZeroItemValue > 0 || counts.missingOrZeroDeclarationFob > 0) {
    return "Revisar mapeo de valores comerciales contra el archivo fuente antes de usar agregados.";
  }

  if (counts.missingImportGrossWeightItem > 0) {
    return "Revisar parser/mapeo de peso bruto item para importaciones; comparar contra peso total y metadatos fuente.";
  }

  if (
    counts.undecodedCustomsOffice > 0 ||
    counts.undecodedPort > 0 ||
    counts.undecodedTransportMode > 0
  ) {
    return "Validar tablas de códigos Aduana cargadas y confirmar si los códigos fuente son nuevos, especiales o mal normalizados.";
  }

  if (counts.quantityUnitValueReview > 0) {
    return "Revisar normalización de cantidad, unidad y precio unitario antes de comparar unidades.";
  }

  return "Sin señales QA priorizadas para este lote en marzo 2026.";
}

const emptyRemediationCounts: DataQualityRemediationIssueCounts = {
  missingImportGrossWeightItem: 0,
  undecodedCustomsOffice: 0,
  undecodedPort: 0,
  undecodedTransportMode: 0,
  missingOrZeroItemValue: 0,
  missingOrZeroDeclarationFob: 0,
  quantityUnitValueReview: 0,
};

export function remediationCountsFromRow(
  row: SourceBatchRemediationBaseRow,
): DataQualityRemediationIssueCounts {
  return {
    ...emptyRemediationCounts,
    missingImportGrossWeightItem: countValueToNumber(row.missingImportGrossWeightItem),
    missingOrZeroItemValue: countValueToNumber(row.missingOrZeroItemValue),
    missingOrZeroDeclarationFob: countValueToNumber(row.missingOrZeroDeclarationFob),
    quantityUnitValueReview: countValueToNumber(row.quantityUnitValueReview),
  };
}

export function sourceBatchRemediationFromRow(
  row: SourceBatchRemediationBaseRow,
): DataQualitySourceBatchRemediation | null {
  if (row.tradeFlow !== "import" && row.tradeFlow !== "export") {
    return null;
  }

  const issueCounts = remediationCountsFromRow(row);
  const totalIssueSignals = dataQualityRemediationTotal(issueCounts);

  return {
    sourceFileId: row.sourceFileId,
    importBatchId: row.importBatchId,
    tradeFlow: row.tradeFlow,
    filename: sourceDisplayFilename({
      originalFilename: row.originalFilename,
      normalizedRawFilename: row.normalizedRawFilename,
    }),
    parserName: row.parserName,
    parserVersion: row.parserVersion,
    batchStatus: row.batchStatus,
    tradeRecords: countValueToNumber(row.tradeRecords),
    issueCounts,
    totalIssueSignals,
    status: dataQualityRemediationStatus(issueCounts),
    nextStep: dataQualityRemediationNextStep(issueCounts),
    sourceHref: dataQualitySourceBatchHref(row.sourceFileId, row.importBatchId),
    tradeRecordsHref: sourceTradeRecordsHref({
      sourceFileId: row.sourceFileId,
      importBatchId: row.importBatchId,
      tradeFlow: row.tradeFlow,
    }),
  };
}

export function addUndecodedSourceBatchCounts({
  codeSet,
  field,
  ignoredSourceCodes = new Set<string>(),
  remediationByKey,
  rows,
}: {
  codeSet: Set<string>;
  field: keyof Pick<
    DataQualityRemediationIssueCounts,
    "undecodedCustomsOffice" | "undecodedPort" | "undecodedTransportMode"
  >;
  ignoredSourceCodes?: Set<string>;
  remediationByKey: Map<string, DataQualitySourceBatchRemediation>;
  rows: SourceBatchCodeCountRow[];
}) {
  for (const row of rows) {
    if (
      !isActionableUndecodedCode({
        code: row.code,
        codeSet,
        ignoredSourceCodes,
      })
    ) {
      continue;
    }

    const remediation = remediationByKey.get(dataQualitySourceBatchKey(row));
    if (!remediation) {
      continue;
    }

    remediation.issueCounts[field] += countValueToNumber(row.records);
  }
}

export function finalizeSourceBatchRemediationRows(
  rows: DataQualitySourceBatchRemediation[],
) {
  return rows
    .map((row) => {
      const totalIssueSignals = dataQualityRemediationTotal(row.issueCounts);
      return {
        ...row,
        totalIssueSignals,
        status: dataQualityRemediationStatus(row.issueCounts),
        nextStep: dataQualityRemediationNextStep(row.issueCounts),
      };
    })
    .filter((row) => row.totalIssueSignals > 0)
    .sort((a, b) => {
      if (a.totalIssueSignals !== b.totalIssueSignals) {
        return b.totalIssueSignals - a.totalIssueSignals;
      }

      return a.filename.localeCompare(b.filename);
    });
}
