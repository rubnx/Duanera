import type { CodeTableRemediationReport } from "@/quality/code-table-remediation";
import type {
  DataQualityIssueGroup,
  DataQualityPayloadCoverage,
  DataQualityReport,
  DataQualitySourceBatchRemediation,
} from "@/quality/data-quality";
import type {
  RemediationQueueItemInput,
  RemediationQueueLink,
} from "@/quality/remediation-queue";
import {
  safeRemediationQueueLinks as safeLinks,
} from "@/quality/remediation-queue-ranking";
import type { FieldMappingReport } from "@/quality/field-mapping";
import {
  codeTableImpact,
  fieldCoverageImpact,
  fieldMappingImpact,
  issueImpact,
  mappingConfidence,
} from "@/quality/remediation-queue-classification";
import { qualityPeriodSearchParams } from "@/quality/march-2026";
import { buildTradeRecordSearchHref } from "@/trade/trade-record-links";
import type { TradeFlow } from "@/trade/trade-records";

export type RemediationQueueSourceReports = {
  dataQuality: DataQualityReport;
  fieldMapping: FieldMappingReport;
  codeTables: CodeTableRemediationReport;
};

function sourceLabel({
  importBatchId,
  sourceLabel,
}: {
  sourceLabel?: string | null;
  importBatchId?: string | null;
}) {
  if (!sourceLabel && !importBatchId) {
    return null;
  }

  return `${sourceLabel ?? "Fuente"}${importBatchId ? ` · lote ${importBatchId.slice(0, 8)}` : ""}`;
}

function flowFromIssueGroup(group: DataQualityIssueGroup): TradeFlow | "mixed" | null {
  const flows = new Set(group.samples.map((sample) => sample.tradeFlow));
  if (flows.size === 1) {
    return [...flows][0] ?? null;
  }

  return flows.size > 1 ? "mixed" : null;
}

function issueGroupItems(report: DataQualityReport): RemediationQueueItemInput[] {
  const dashboardHref = qualityScopedHref("/data-quality", report);
  return report.issueGroups
    .filter((group) => group.count > 0)
    .map((group) => {
      const sample = group.samples[0];
      return {
        id: `qa:${group.key}`,
        issueType: "qa_drilldown",
        title: group.title,
        description: group.description,
        status: group.status,
        impact: issueImpact(group),
        confidence: "verified_signal",
        affectedRecords: group.count,
        tradeFlow: flowFromIssueGroup(group),
        sourceFileId: sample?.sourceFileId ?? null,
        importBatchId: sample?.importBatchId ?? null,
        sourceLabel: sourceLabel({
          importBatchId: sample?.importBatchId,
          sourceLabel: sample?.sourceFilename,
        }),
        nextAction: group.description,
        links: safeLinks([
          { href: dashboardHref, label: "Ver dashboard QA" },
          { href: group.tradeRecordsHref, label: "Ver registros filtrados" },
          sample ? { href: sample.sourceHref, label: "Ver fuente/lote muestra" } : null,
          sample ? { href: sample.recordHref, label: "Ver registro muestra" } : null,
        ].filter((link): link is RemediationQueueLink => Boolean(link))),
        dedupeKey: `qa:${group.key}`,
      };
    });
}

function sourceBatchItems(report: DataQualityReport): RemediationQueueItemInput[] {
  const dashboardHref = qualityScopedHref("/data-quality", report);
  return report.sourceBatchRemediation
    .filter((row) => row.totalIssueSignals > 0)
    .map((row: DataQualitySourceBatchRemediation) => ({
      id: `source-batch:${row.sourceFileId}:${row.importBatchId}:${row.tradeFlow}`,
      issueType: "source_batch",
      title: `Lote con señales QA: ${row.filename}`,
      description: "Agrupa señales de cobertura, etiquetas y valores por fuente/lote.",
      status: row.status,
      impact: "provenance",
      confidence: "verified_signal",
      affectedRecords: row.totalIssueSignals,
      tradeFlow: row.tradeFlow,
      sourceFileId: row.sourceFileId,
      importBatchId: row.importBatchId,
      sourceLabel: sourceLabel({
        importBatchId: row.importBatchId,
        sourceLabel: row.filename,
      }),
      nextAction: row.nextStep,
      links: safeLinks([
        { href: row.sourceHref, label: "Ver fuente/lote" },
        row.tradeRecordsHref
          ? { href: row.tradeRecordsHref, label: "Ver registros del lote" }
          : null,
        { href: dashboardHref, label: "Ver dashboard QA" },
      ].filter((link): link is RemediationQueueLink => Boolean(link))),
      dedupeKey: `source-batch:${row.sourceFileId}:${row.importBatchId}:${row.tradeFlow}`,
    }));
}

function fieldCoverageItems(report: DataQualityReport): RemediationQueueItemInput[] {
  const periodParams = qualityPeriodSearchParams(report.period);
  const dashboardHref = qualityScopedHref("/data-quality", report);
  return report.fieldCoverage
    .filter((field) => field.status !== "ok")
    .map((field) => ({
      id: `field:${field.tradeFlow}:${field.key}`,
      issueType: "field_coverage",
      title: `Cobertura de campo: ${field.label}`,
      description: field.caveat,
      status: field.status,
      impact: fieldCoverageImpact(field),
      confidence: "verified_signal",
      affectedRecords: Math.max(field.total - field.covered, 0),
      tradeFlow: field.tradeFlow,
      sourceFileId: null,
      importBatchId: null,
      sourceLabel: null,
      nextAction: "Revisar mapeo y parser contra fuente oficial antes de cargar más meses.",
      links: [
        { href: dashboardHref, label: "Ver dashboard QA" },
        {
          href: buildTradeRecordSearchHref({
            ...periodParams,
            tradeFlow: field.tradeFlow,
            limit: "25",
          }),
          label: "Ver registros del flujo",
        },
      ],
      dedupeKey: `field:${field.tradeFlow}:${field.key}`,
    }));
}

function payloadItems(report: DataQualityReport): RemediationQueueItemInput[] {
  const dashboardHref = qualityScopedHref("/data-quality", report);
  return report.payloadCoverage
    .filter((row) => {
      if (row.rows <= 0) {
        return false;
      }

      return !row.reconstructable || row.storageKind === "postgres";
    })
    .map((row: DataQualityPayloadCoverage) => ({
      id: `payload:${row.tradeFlow}:${row.retentionMode}:${row.storageKind}:${row.reconstructable}`,
      issueType: "payload_retention",
      title: `Retención payload: ${row.retentionMode}`,
      description:
        row.storageKind === "postgres"
          ? "Las filas conservan payload completo en Postgres; esto es útil en dev pero debe revisarse antes de cargar más meses."
          : "Revisar que el payload sea reconstruible desde fuente preservada o almacenamiento externo privado.",
      status: row.reconstructable ? "review" : "warning",
      impact: "payload",
      confidence: "verified_signal",
      affectedRecords: row.rows,
      tradeFlow: row.tradeFlow === "unknown" ? null : row.tradeFlow,
      sourceFileId: null,
      importBatchId: null,
      sourceLabel: null,
      nextAction:
        "Validar política de retención/pruning en una carga pequeña real antes de ampliar meses.",
      links: [{ href: dashboardHref, label: "Ver dashboard QA" }],
      dedupeKey: `payload:${row.tradeFlow}:${row.retentionMode}:${row.storageKind}:${row.reconstructable}`,
    }));
}

function fieldMappingItems(
  report: RemediationQueueSourceReports["fieldMapping"],
): RemediationQueueItemInput[] {
  const fieldMappingHref = qualityScopedHref("/data-quality/field-mapping", report);
  return report.rows
    .filter((row) => row.status !== "ok" || row.confidence === "needs_review")
    .map((row) => ({
      id: `mapping:${row.tradeFlow}:${row.normalizedField}`,
      issueType: "field_mapping",
      title: `Mapeo a revisar: ${row.label}`,
      description: row.note,
      status: row.status,
      impact: fieldMappingImpact(row.group),
      confidence: mappingConfidence(row.confidence),
      affectedRecords:
        row.confidence === "needs_review"
          ? row.totalRows
          : Math.max(row.totalRows - row.normalizedPresentRows, 0),
      tradeFlow: row.tradeFlow,
      sourceFileId: null,
      importBatchId: null,
      sourceLabel: row.sourceLabel,
      nextAction: "Contrastar campo fuente, parser y cobertura antes de usarlo como señal comercial.",
      links: safeLinks([
        { href: fieldMappingHref, label: "Ver mapeo de campos" },
        { href: row.tradeRecordsHref, label: "Ver registros del flujo" },
        row.sourceHref ? { href: row.sourceHref, label: "Ver fuente/lote muestra" } : null,
      ].filter((link): link is RemediationQueueLink => Boolean(link))),
      dedupeKey: `mapping:${row.tradeFlow}:${row.normalizedField}`,
    }));
}

function codeTableItems(
  report: RemediationQueueSourceReports["codeTables"],
): RemediationQueueItemInput[] {
  const codeTablesHref = qualityScopedHref("/data-quality/code-tables", report);
  return report.rows
    .filter((row) => row.status !== "ok" || row.recordsWithUndecodedCode > 0)
    .map((row) => ({
      id: `code-table:${row.tradeFlow}:${row.normalizedField}`,
      issueType: "code_table",
      title: `Etiqueta/diccionario: ${row.label}`,
      description: row.commercialUse,
      status: row.status,
      impact: codeTableImpact(row.priority),
      confidence: row.codeTableFound ? "verified_signal" : "needs_review",
      affectedRecords: row.recordsWithUndecodedCode,
      tradeFlow: row.tradeFlow,
      sourceFileId: row.sourceContext?.sourceFileId ?? null,
      importBatchId: row.sourceContext?.importBatchId ?? null,
      sourceLabel: sourceLabel({
        importBatchId: row.sourceContext?.importBatchId,
        sourceLabel: row.sourceContext?.sourceLabel,
      }),
      nextAction: row.nextAction,
      links: safeLinks([
        { href: codeTablesHref, label: "Ver tablas de códigos" },
        { href: row.tradeRecordsHref, label: "Ver registros del flujo" },
        row.sourceContext ? { href: row.sourceContext.sourceHref, label: "Ver fuente/lote" } : null,
      ].filter((link): link is RemediationQueueLink => Boolean(link))),
      dedupeKey: `code-table:${row.tradeFlow}:${row.normalizedField}`,
    }));
}

function qualityScopedHref(
  pathname: string,
  report: { period?: DataQualityReport["period"] },
) {
  if (!report.period) {
    return pathname;
  }

  const query = new URLSearchParams(qualityPeriodSearchParams(report.period));
  return `${pathname}?${query.toString()}`;
}

export function remediationQueueItemInputs({
  codeTables,
  dataQuality,
  fieldMapping,
}: RemediationQueueSourceReports): RemediationQueueItemInput[] {
  return [
    ...issueGroupItems(dataQuality),
    ...sourceBatchItems(dataQuality),
    ...fieldCoverageItems(dataQuality),
    ...payloadItems(dataQuality),
    ...fieldMappingItems(fieldMapping),
    ...codeTableItems(codeTables),
  ];
}
