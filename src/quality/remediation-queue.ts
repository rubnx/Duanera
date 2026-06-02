import type { DbClient } from "@/db/client";
import {
  getMarch2026CodeTableRemediationReport,
  type CodeTableRemediationPriority,
} from "@/quality/code-table-remediation";
import {
  getMarch2026DataQualityReport,
  type DataQualityFieldCoverage,
  type DataQualityIssueGroup,
  type DataQualityPayloadCoverage,
  type DataQualityReport,
  type DataQualitySourceBatchRemediation,
  type DataQualityStatus,
} from "@/quality/data-quality";
import {
  getMarch2026FieldMappingReport,
  type FieldMappingConfidence,
  type FieldMappingGroup,
} from "@/quality/field-mapping";
import type { TradeFlow } from "@/trade/trade-records";

const reportPeriod = {
  year: 2026,
  month: 3,
  label: "2026-03",
};

export type RemediationQueueIssueType =
  | "source_batch"
  | "field_coverage"
  | "code_table"
  | "field_mapping"
  | "payload_retention"
  | "qa_drilldown";

export type RemediationQueueImpact =
  | "visible_mvp"
  | "commercial_values"
  | "comparability"
  | "provenance"
  | "payload"
  | "internal_context";

export type RemediationQueueConfidence =
  | "verified_signal"
  | "inferred_signal"
  | "needs_review";

export type RemediationQueueLink = {
  href: string;
  label: string;
};

export type RemediationQueueItemInput = {
  id: string;
  issueType: RemediationQueueIssueType;
  title: string;
  description: string;
  status: DataQualityStatus;
  impact: RemediationQueueImpact;
  confidence: RemediationQueueConfidence;
  affectedRecords: number;
  tradeFlow: TradeFlow | "mixed" | null;
  sourceFileId?: string | null;
  importBatchId?: string | null;
  sourceLabel?: string | null;
  nextAction: string;
  links: RemediationQueueLink[];
  dedupeKey: string;
};

export type RemediationQueueItem = RemediationQueueItemInput & {
  score: number;
};

export type RemediationQueueReport = {
  period: typeof reportPeriod;
  items: RemediationQueueItem[];
  summary: {
    totalItems: number;
    warningItems: number;
    reviewItems: number;
    visibleMvpItems: number;
    affectedRecordSignals: number;
  };
};

type RemediationQueueSourceReports = {
  dataQuality: DataQualityReport;
  fieldMapping: Awaited<ReturnType<typeof getMarch2026FieldMappingReport>>;
  codeTables: Awaited<ReturnType<typeof getMarch2026CodeTableRemediationReport>>;
};

function safeLinks(links: RemediationQueueLink[]) {
  const seen = new Set<string>();
  return links.filter((link) => {
    if (!link.href || seen.has(link.href)) {
      return false;
    }

    seen.add(link.href);
    return true;
  });
}

function statusRank(status: DataQualityStatus) {
  const ranks: Record<DataQualityStatus, number> = {
    warning: 3,
    review: 2,
    ok: 1,
  };

  return ranks[status];
}

function impactRank(impact: RemediationQueueImpact) {
  const ranks: Record<RemediationQueueImpact, number> = {
    visible_mvp: 6,
    commercial_values: 5,
    comparability: 4,
    provenance: 3,
    payload: 2,
    internal_context: 1,
  };

  return ranks[impact];
}

function confidenceRank(confidence: RemediationQueueConfidence) {
  const ranks: Record<RemediationQueueConfidence, number> = {
    needs_review: 3,
    inferred_signal: 2,
    verified_signal: 1,
  };

  return ranks[confidence];
}

export function remediationQueueScore(item: RemediationQueueItemInput) {
  return (
    statusRank(item.status) * 1_000_000_000 +
    impactRank(item.impact) * 10_000_000 +
    Math.min(item.affectedRecords, 9_999_999) +
    confidenceRank(item.confidence) * 10_000
  );
}

export function remediationQueueSort(
  left: RemediationQueueItem,
  right: RemediationQueueItem,
) {
  if (left.score !== right.score) {
    return right.score - left.score;
  }

  return left.title.localeCompare(right.title);
}

export function dedupeRemediationQueueItems(
  items: RemediationQueueItemInput[],
): RemediationQueueItem[] {
  const byKey = new Map<string, RemediationQueueItemInput>();

  for (const item of items) {
    const existing = byKey.get(item.dedupeKey);
    if (!existing) {
      byKey.set(item.dedupeKey, { ...item, links: safeLinks(item.links) });
      continue;
    }

    const chosen = remediationQueueScore(item) > remediationQueueScore(existing)
      ? item
      : existing;
    byKey.set(item.dedupeKey, {
      ...chosen,
      affectedRecords: Math.max(existing.affectedRecords, item.affectedRecords),
      links: safeLinks([...existing.links, ...item.links]),
    });
  }

  return [...byKey.values()]
    .map((item) => ({
      ...item,
      links: safeLinks(item.links),
      score: remediationQueueScore(item),
    }))
    .sort(remediationQueueSort);
}

function issueImpact(group: DataQualityIssueGroup): RemediationQueueImpact {
  if (
    group.key === "missing_or_zero_item_value" ||
    group.key === "missing_or_zero_declaration_fob"
  ) {
    return "commercial_values";
  }

  if (group.key === "quantity_unit_value_review") {
    return "comparability";
  }

  if (
    group.key === "undecoded_customs_office" ||
    group.key === "undecoded_port" ||
    group.key === "undecoded_transport_mode"
  ) {
    return "visible_mvp";
  }

  return "commercial_values";
}

function fieldCoverageImpact(field: DataQualityFieldCoverage): RemediationQueueImpact {
  if (
    field.key.includes("itemValue") ||
    field.key.includes("declarationFob") ||
    field.key.includes("grossWeight")
  ) {
    return "commercial_values";
  }

  if (field.key.includes("quantity") || field.key.includes("unitPrice")) {
    return "comparability";
  }

  if (
    field.key.includes("Country") ||
    field.key.includes("customs") ||
    field.key.includes("Port") ||
    field.key.includes("transport")
  ) {
    return "visible_mvp";
  }

  return "internal_context";
}

function fieldMappingImpact(group: FieldMappingGroup): RemediationQueueImpact {
  const impacts: Record<FieldMappingGroup, RemediationQueueImpact> = {
    anonymous_correlative: "internal_context",
    commercial_values: "commercial_values",
    geography_logistics: "visible_mvp",
    hs_product: "visible_mvp",
    provenance: "provenance",
    quantity_weight: "comparability",
  };

  return impacts[group];
}

function mappingConfidence(confidence: FieldMappingConfidence) {
  if (confidence === "verified") {
    return "verified_signal" satisfies RemediationQueueConfidence;
  }

  if (confidence === "inferred") {
    return "inferred_signal" satisfies RemediationQueueConfidence;
  }

  return "needs_review" satisfies RemediationQueueConfidence;
}

function codeTableImpact(priority: CodeTableRemediationPriority): RemediationQueueImpact {
  if (priority === "high") {
    return "visible_mvp";
  }

  if (priority === "medium") {
    return "comparability";
  }

  return "internal_context";
}

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
          { href: "/data-quality", label: "Ver dashboard QA" },
          { href: group.tradeRecordsHref, label: "Ver registros filtrados" },
          sample ? { href: sample.sourceHref, label: "Ver fuente/lote muestra" } : null,
          sample ? { href: sample.recordHref, label: "Ver registro muestra" } : null,
        ].filter((link): link is RemediationQueueLink => Boolean(link))),
        dedupeKey: `qa:${group.key}`,
      };
    });
}

function sourceBatchItems(report: DataQualityReport): RemediationQueueItemInput[] {
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
        { href: "/data-quality", label: "Ver dashboard QA" },
      ].filter((link): link is RemediationQueueLink => Boolean(link))),
      dedupeKey: `source-batch:${row.sourceFileId}:${row.importBatchId}:${row.tradeFlow}`,
    }));
}

function fieldCoverageItems(report: DataQualityReport): RemediationQueueItemInput[] {
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
        { href: "/data-quality", label: "Ver dashboard QA" },
        {
          href: `/trade-records?tradeFlow=${field.tradeFlow}&periodYear=2026&periodMonth=3&limit=25`,
          label: "Ver registros del flujo",
        },
      ],
      dedupeKey: `field:${field.tradeFlow}:${field.key}`,
    }));
}

function payloadItems(report: DataQualityReport): RemediationQueueItemInput[] {
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
      links: [{ href: "/data-quality", label: "Ver dashboard QA" }],
      dedupeKey: `payload:${row.tradeFlow}:${row.retentionMode}:${row.storageKind}:${row.reconstructable}`,
    }));
}

function fieldMappingItems(
  report: RemediationQueueSourceReports["fieldMapping"],
): RemediationQueueItemInput[] {
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
        { href: "/data-quality/field-mapping", label: "Ver mapeo de campos" },
        { href: row.tradeRecordsHref, label: "Ver registros del flujo" },
        row.sourceHref ? { href: row.sourceHref, label: "Ver fuente/lote muestra" } : null,
      ].filter((link): link is RemediationQueueLink => Boolean(link))),
      dedupeKey: `mapping:${row.tradeFlow}:${row.normalizedField}`,
    }));
}

function codeTableItems(
  report: RemediationQueueSourceReports["codeTables"],
): RemediationQueueItemInput[] {
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
        { href: "/data-quality/code-tables", label: "Ver tablas de códigos" },
        { href: row.tradeRecordsHref, label: "Ver registros del flujo" },
        row.sourceContext ? { href: row.sourceContext.sourceHref, label: "Ver fuente/lote" } : null,
      ].filter((link): link is RemediationQueueLink => Boolean(link))),
      dedupeKey: `code-table:${row.tradeFlow}:${row.normalizedField}`,
    }));
}

export function buildDataQualityRemediationQueueReport({
  codeTables,
  dataQuality,
  fieldMapping,
}: RemediationQueueSourceReports): RemediationQueueReport {
  const items = dedupeRemediationQueueItems([
    ...issueGroupItems(dataQuality),
    ...sourceBatchItems(dataQuality),
    ...fieldCoverageItems(dataQuality),
    ...payloadItems(dataQuality),
    ...fieldMappingItems(fieldMapping),
    ...codeTableItems(codeTables),
  ]);

  return {
    period: reportPeriod,
    items,
    summary: {
      totalItems: items.length,
      warningItems: items.filter((item) => item.status === "warning").length,
      reviewItems: items.filter((item) => item.status === "review").length,
      visibleMvpItems: items.filter((item) => item.impact === "visible_mvp").length,
      affectedRecordSignals: items.reduce(
        (total, item) => total + item.affectedRecords,
        0,
      ),
    },
  };
}

export async function getMarch2026RemediationQueueReport(
  db: DbClient,
): Promise<RemediationQueueReport> {
  const [dataQuality, fieldMapping, codeTables] = await Promise.all([
    getMarch2026DataQualityReport(db),
    getMarch2026FieldMappingReport(db),
    getMarch2026CodeTableRemediationReport(db),
  ]);

  return buildDataQualityRemediationQueueReport({
    codeTables,
    dataQuality,
    fieldMapping,
  });
}
