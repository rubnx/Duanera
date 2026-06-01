import type { DbClient } from "@/db/client";
import {
  getMarch2026CodeTableRemediationReport,
  type CodeTableRemediationReport,
} from "@/quality/code-table-remediation";
import {
  getMarch2026DataQualityReport,
  type DataQualityReport,
} from "@/quality/data-quality";
import {
  getMarch2026FieldMappingReport,
  type FieldMappingReport,
} from "@/quality/field-mapping";
import {
  buildDataQualityRemediationQueueReport,
  type RemediationQueueReport,
} from "@/quality/remediation-queue";

const reportPeriod = {
  year: 2026,
  month: 3,
  label: "2026-03",
};

export type LoadReadinessStatus = "ready" | "review" | "blocked";

export type LoadReadinessDecision = "go" | "review-first" | "no-go";

export type LoadReadinessAreaKey =
  | "source_archive_provenance"
  | "parser_field_counts"
  | "field_mapping"
  | "code_tables"
  | "payload_retention"
  | "query_performance"
  | "march_remediation";

export type LoadReadinessLink = {
  label: string;
  href?: string | null;
};

export type LoadReadinessEvidence = LoadReadinessLink & {
  value: string;
};

export type LoadReadinessAction = LoadReadinessLink & {
  required: boolean;
};

export type LoadReadinessArea = {
  key: LoadReadinessAreaKey;
  title: string;
  status: LoadReadinessStatus;
  summary: string;
  evidence: LoadReadinessEvidence[];
  actions: LoadReadinessAction[];
};

export type LoadReadinessReport = {
  period: typeof reportPeriod;
  decision: LoadReadinessDecision;
  summary: {
    readyAreas: number;
    reviewAreas: number;
    blockedAreas: number;
    totalAreas: number;
  };
  areas: LoadReadinessArea[];
};

export type LoadReadinessSourceReports = {
  dataQuality: DataQualityReport;
  fieldMapping: FieldMappingReport;
  codeTables: CodeTableRemediationReport;
  remediation: RemediationQueueReport;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-CL", {
    maximumFractionDigits: 0,
  }).format(value);
}

export function loadReadinessStatusRank(status: LoadReadinessStatus) {
  const ranks: Record<LoadReadinessStatus, number> = {
    blocked: 3,
    review: 2,
    ready: 1,
  };

  return ranks[status];
}

export function loadReadinessDecisionFromStatuses(
  statuses: LoadReadinessStatus[],
): LoadReadinessDecision {
  if (statuses.some((status) => status === "blocked")) {
    return "no-go";
  }

  if (statuses.some((status) => status === "review")) {
    return "review-first";
  }

  return "go";
}

export function loadReadinessAreaStatusFromCounts({
  blockers,
  warnings,
}: {
  blockers: number;
  warnings: number;
}): LoadReadinessStatus {
  if (blockers > 0) {
    return "blocked";
  }

  if (warnings > 0) {
    return "review";
  }

  return "ready";
}

function isSafeInternalHref(href: string | null | undefined) {
  if (!href) {
    return false;
  }

  if (!href.startsWith("/") || href.startsWith("//")) {
    return false;
  }

  const unsafeFragments = [
    "/Users/",
    "\\",
    "r2://",
    "http://",
    "https://",
    "storage_key",
    "storageKey",
    "bucket=",
    "secret",
    "token",
  ];

  return !unsafeFragments.some((fragment) => href.includes(fragment));
}

export function safeLoadReadinessLinks<T extends LoadReadinessLink>(
  links: T[],
): T[] {
  const seen = new Set<string>();
  const safeLinks: T[] = [];

  for (const link of links) {
    const href = link.href ?? undefined;

    if (href && !isSafeInternalHref(href)) {
      continue;
    }

    const dedupeKey = `${href ?? "plain"}:${link.label}`;
    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    safeLinks.push({ ...link, href });
  }

  return safeLinks;
}

function sourceArchiveProvenanceArea(
  report: DataQualityReport,
): LoadReadinessArea {
  const sources = new Set(report.sourceCoverage.map((row) => row.sourceFileId));
  const completedBatches = report.sourceCoverage.filter(
    (row) => row.batchStatus === "completed",
  ).length;
  const incompleteBatches = report.sourceCoverage.length - completedBatches;
  const countMismatchedBatches = report.sourceCoverage.filter(
    (row) => row.failedRows > 0 || row.rawRows !== row.tradeRecords,
  ).length;
  const blockers =
    report.totals.rawRows === 0 ||
    report.totals.tradeRecords === 0 ||
    report.sourceCoverage.length === 0 ||
    incompleteBatches > 0 ||
    countMismatchedBatches > 0
      ? 1
      : 0;
  const warnings = 0;
  const status = loadReadinessAreaStatusFromCounts({ blockers, warnings });

  return {
    key: "source_archive_provenance",
    title: "Archivo fuente y proveniencia",
    status,
    summary:
      status === "blocked"
        ? "Hay una brecha de proveniencia o de conteos fuente/lote que debe corregirse antes de cargar otro mes."
        : "La carga March 2026 mantiene trazabilidad fuente/lote para revisar otro mes en dev.",
    evidence: safeLoadReadinessLinks([
      {
        label: "Fuentes March 2026",
        value: formatNumber(sources.size),
        href: "/sources",
      },
      {
        label: "Lotes con filas",
        value: formatNumber(report.sourceCoverage.length),
        href: "/data-quality",
      },
      {
        label: "Lotes completos",
        value: formatNumber(completedBatches),
        href: "/sources",
      },
      {
        label: "Lotes con diferencia fuente/normalizado",
        value: formatNumber(countMismatchedBatches),
        href: "/data-quality/remediation",
      },
    ]),
    actions: safeLoadReadinessLinks([
      {
        label: "Corregir cualquier lote sin estado completed o con diferencia raw/trade antes de cargar otro mes.",
        href: "/data-quality/remediation",
        required: status === "blocked",
      },
      {
        label: "Confirmar que el archivo oficial del próximo mes esté preservado en R2 o archivo local documentado antes de ingerir.",
        required: true,
      },
    ]),
  };
}

function parserFieldCountArea(report: DataQualityReport): LoadReadinessArea {
  const flowWarnings = report.flows.filter((row) => row.status !== "ok").length;
  const blockers =
    report.totals.failedRows > 0 || report.totals.rawToTradeDelta !== 0 || flowWarnings > 0
      ? 1
      : 0;
  const warnings = report.totals.warningRows;
  const status = loadReadinessAreaStatusFromCounts({ blockers, warnings });

  return {
    key: "parser_field_counts",
    title: "Parser y conteos raw-normalizado",
    status,
    summary:
      status === "blocked"
        ? "Los conteos de parser o normalización no cierran; no conviene cargar otro mes hasta resolverlos."
        : "Los conteos March 2026 cierran para usar la misma ruta como validación dev, con vigilancia sobre advertencias.",
    evidence: safeLoadReadinessLinks([
      {
        label: "Filas raw",
        value: formatNumber(report.totals.rawRows),
        href: "/data-quality",
      },
      {
        label: "Registros normalizados",
        value: formatNumber(report.totals.tradeRecords),
        href: "/trade-records?periodYear=2026&periodMonth=3&limit=25",
      },
      {
        label: "Filas fallidas",
        value: formatNumber(report.totals.failedRows),
        href: "/data-quality/remediation",
      },
      {
        label: "Diferencia raw-normalizado",
        value: formatNumber(report.totals.rawToTradeDelta),
        href: "/data-quality",
      },
      {
        label: "Pruebas parser",
        value: "scripts/ingest/aduana-parser.test.ts",
      },
    ]),
    actions: safeLoadReadinessLinks([
      {
        label: "Ejecutar parser sobre una muestra real del próximo mes antes de ampliar límites.",
        required: true,
      },
      {
        label: "Resolver fallas o diferencias raw/trade si aparecen en la muestra.",
        href: "/data-quality/remediation",
        required: status === "blocked",
      },
    ]),
  };
}

function fieldMappingArea(report: FieldMappingReport): LoadReadinessArea {
  const highImpactReviewRows = report.rows.filter(
    (row) =>
      row.status === "warning" &&
      (row.group === "commercial_values" ||
        row.group === "quantity_weight" ||
        row.group === "geography_logistics" ||
        row.group === "hs_product"),
  );
  const status = loadReadinessAreaStatusFromCounts({
    blockers: highImpactReviewRows.length,
    warnings: report.summary.reviewMappings + report.summary.warningMappings,
  });

  return {
    key: "field_mapping",
    title: "Mapeo raw-normalizado",
    status,
    summary:
      status === "blocked"
        ? "Hay mapeos visibles de valor, producto, logística o cantidad en estado de riesgo."
        : "Los mapeos pueden usarse como evidencia March 2026, pero los campos inferidos deben vigilarse en el próximo mes.",
    evidence: safeLoadReadinessLinks([
      {
        label: "Mapeos totales",
        value: formatNumber(report.summary.totalMappings),
        href: "/data-quality/field-mapping",
      },
      {
        label: "Mapeos verificados",
        value: formatNumber(report.summary.verifiedMappings),
        href: "/data-quality/field-mapping",
      },
      {
        label: "Mapeos a revisar",
        value: formatNumber(report.summary.reviewMappings),
        href: "/data-quality/field-mapping",
      },
      {
        label: "Mapeos en riesgo",
        value: formatNumber(report.summary.warningMappings),
        href: "/data-quality/field-mapping",
      },
    ]),
    actions: safeLoadReadinessLinks([
      {
        label: "Revisar los mapeos de alto impacto antes de confiar en agregados del siguiente mes.",
        href: "/data-quality/field-mapping",
        required: status === "blocked",
      },
      {
        label: "Comparar ordinals/campos fuente del próximo mes contra las definiciones March 2026.",
        href: "/data-quality/field-mapping",
        required: true,
      },
    ]),
  };
}

function codeTablesArea(report: CodeTableRemediationReport): LoadReadinessArea {
  const status = loadReadinessAreaStatusFromCounts({
    blockers: report.summary.highPriorityGaps,
    warnings: report.summary.mediumPriorityGaps + report.summary.lowPriorityGaps,
  });

  return {
    key: "code_tables",
    title: "Tablas de códigos y diccionarios",
    status,
    summary:
      status === "blocked"
        ? "Hay brechas de etiquetas de alto impacto que pueden hacer confusos filtros y rankings comerciales."
        : "Las tablas cargadas dan contexto útil; cualquier código nuevo del próximo mes debe quedar visible como código fuente.",
    evidence: safeLoadReadinessLinks([
      {
        label: "Brechas alta prioridad",
        value: formatNumber(report.summary.highPriorityGaps),
        href: "/data-quality/code-tables",
      },
      {
        label: "Brechas prioridad media",
        value: formatNumber(report.summary.mediumPriorityGaps),
        href: "/data-quality/code-tables",
      },
      {
        label: "Registros con código sin etiqueta",
        value: formatNumber(report.summary.recordsWithUndecodedCodes),
        href: "/data-quality/code-tables",
      },
    ]),
    actions: safeLoadReadinessLinks([
      {
        label: "Corregir o documentar brechas de código de alto impacto con evidencia oficial antes de cargar otro mes.",
        href: "/data-quality/code-tables",
        required: status === "blocked",
      },
      {
        label: "No mutar tablas de códigos sin confirmar diccionario oficial o fuente Aduana.",
        href: "/data-quality/code-tables",
        required: true,
      },
    ]),
  };
}

function payloadRetentionArea(report: DataQualityReport): LoadReadinessArea {
  const nonReconstructableRows = report.payloadCoverage
    .filter((row) => !row.reconstructable)
    .reduce((total, row) => total + row.rows, 0);
  const fullPostgresRows = report.payloadCoverage
    .filter((row) => row.retentionMode === "full_postgres" || row.storageKind === "postgres")
    .reduce((total, row) => total + row.rows, 0);
  const status = loadReadinessAreaStatusFromCounts({
    blockers: nonReconstructableRows,
    warnings: fullPostgresRows,
  });

  return {
    key: "payload_retention",
    title: "Payload raw y política de pruning",
    status,
    summary:
      status === "blocked"
        ? "Hay filas no reconstruibles; cargar más meses sin resolverlo debilita la trazabilidad."
        : "March 2026 conserva payload completo en Postgres; es útil para dev, pero no debe escalarse sin una prueba real con retención selectiva.",
    evidence: safeLoadReadinessLinks([
      {
        label: "Filas no reconstruibles",
        value: formatNumber(nonReconstructableRows),
        href: "/data-quality",
      },
      {
        label: "Filas con payload en Postgres",
        value: formatNumber(fullPostgresRows),
        href: "/data-quality",
      },
      {
        label: "Script pruning dev",
        value: "scripts/ingest/prune-raw-trade-row-payloads.ts",
      },
      {
        label: "Pruebas retención raw",
        value: "scripts/ingest/raw-row-retention.test.ts",
      },
    ]),
    actions: safeLoadReadinessLinks([
      {
        label: "Hacer la próxima validación pequeña con RAW_ROW_PAYLOAD_RETENTION=errors_and_warnings antes de una carga amplia.",
        required: true,
      },
      {
        label: "Mantener pruning como dry-run salvo confirmación explícita; no tocar payloads March 2026 en este flujo.",
        required: true,
      },
    ]),
  };
}

function queryPerformanceArea({
  dataQuality,
  remediation,
}: {
  dataQuality: DataQualityReport;
  remediation: RemediationQueueReport;
}): LoadReadinessArea {
  const broadQaItemCount = remediation.items.filter(
    (item) => item.impact === "visible_mvp" || item.impact === "commercial_values",
  ).length;
  const status = loadReadinessAreaStatusFromCounts({
    blockers: 0,
    warnings:
      dataQuality.totals.tradeRecords > 500_000 || broadQaItemCount > 0 ? 1 : 0,
  });

  return {
    key: "query_performance",
    title: "Riesgo de consulta y performance",
    status,
    summary:
      "Postgres es suficiente para el MVP dev con guardrails, pero otro mes aumentará costos de conteos, agregados y dashboards internos.",
    evidence: safeLoadReadinessLinks([
      {
        label: "Registros March 2026",
        value: formatNumber(dataQuality.totals.tradeRecords),
        href: "/trade-records?periodYear=2026&periodMonth=3&limit=25",
      },
      {
        label: "Items QA visibles/comerciales",
        value: formatNumber(broadQaItemCount),
        href: "/data-quality/remediation",
      },
      {
        label: "Guardrails búsqueda",
        value: "timing metadata, cursor/offset y avisos de performance activos",
        href: "/trade-records",
      },
    ]),
    actions: safeLoadReadinessLinks([
      {
        label: "Validar tiempos API/UI con muestra del próximo mes antes de ampliar a carga completa.",
        href: "/trade-records",
        required: true,
      },
      {
        label: "Si consultas amplias se vuelven lentas de forma sostenida, revisar índices/materialización antes de considerar ClickHouse.",
        required: false,
      },
    ]),
  };
}

function marchRemediationArea(report: RemediationQueueReport): LoadReadinessArea {
  const status = loadReadinessAreaStatusFromCounts({
    blockers: report.summary.warningItems,
    warnings: report.summary.reviewItems,
  });

  return {
    key: "march_remediation",
    title: "Remediación March 2026 pendiente",
    status,
    summary:
      status === "blocked"
        ? "La cola March 2026 aún contiene items de riesgo; deben revisarse antes de usar otro mes como señal comercial."
        : "La cola March 2026 no muestra blockers, pero las señales de revisión siguen siendo contexto operativo.",
    evidence: safeLoadReadinessLinks([
      {
        label: "Items priorizados",
        value: formatNumber(report.summary.totalItems),
        href: "/data-quality/remediation",
      },
      {
        label: "Items riesgo",
        value: formatNumber(report.summary.warningItems),
        href: "/data-quality/remediation",
      },
      {
        label: "Items revisar",
        value: formatNumber(report.summary.reviewItems),
        href: "/data-quality/remediation",
      },
      {
        label: "Señales afectadas",
        value: formatNumber(report.summary.affectedRecordSignals),
        href: "/data-quality/remediation",
      },
    ]),
    actions: safeLoadReadinessLinks([
      {
        label: "Resolver o documentar los items de riesgo en la cola de remediación antes de cargar otro mes.",
        href: "/data-quality/remediation",
        required: status === "blocked",
      },
      {
        label: "Usar la cola como checklist durante la validación del siguiente mes.",
        href: "/data-quality/remediation",
        required: true,
      },
    ]),
  };
}

export function buildLoadReadinessReport({
  codeTables,
  dataQuality,
  fieldMapping,
  remediation,
}: LoadReadinessSourceReports): LoadReadinessReport {
  const areas: LoadReadinessArea[] = [
    sourceArchiveProvenanceArea(dataQuality),
    parserFieldCountArea(dataQuality),
    fieldMappingArea(fieldMapping),
    codeTablesArea(codeTables),
    payloadRetentionArea(dataQuality),
    queryPerformanceArea({ dataQuality, remediation }),
    marchRemediationArea(remediation),
  ];
  const statuses = areas.map((area) => area.status);
  const readyAreas = statuses.filter((status) => status === "ready").length;
  const reviewAreas = statuses.filter((status) => status === "review").length;
  const blockedAreas = statuses.filter((status) => status === "blocked").length;

  return {
    period: reportPeriod,
    decision: loadReadinessDecisionFromStatuses(statuses),
    summary: {
      readyAreas,
      reviewAreas,
      blockedAreas,
      totalAreas: areas.length,
    },
    areas,
  };
}

export function loadReadinessDecisionLabel(decision: LoadReadinessDecision) {
  const labels: Record<LoadReadinessDecision, string> = {
    go: "Go dev",
    "no-go": "No-go",
    "review-first": "Revisar primero",
  };

  return labels[decision];
}

export function loadReadinessStatusLabel(status: LoadReadinessStatus) {
  const labels: Record<LoadReadinessStatus, string> = {
    blocked: "Bloqueado",
    ready: "Listo",
    review: "Revisar",
  };

  return labels[status];
}

export function loadReadinessDecisionSummary(decision: LoadReadinessDecision) {
  const summaries: Record<LoadReadinessDecision, string> = {
    go: "No hay blockers detectados en la evidencia March 2026 para una carga dev controlada.",
    "no-go":
      "Hay al menos un blocker. Corrige o documenta esas brechas antes de intentar otro mes.",
    "review-first":
      "No hay blockers, pero quedan puntos relevantes que deben revisarse durante la carga dev.",
  };

  return summaries[decision];
}

export async function getMarch2026LoadReadinessReport(
  db: DbClient,
): Promise<LoadReadinessReport> {
  const [dataQuality, fieldMapping, codeTables] = await Promise.all([
    getMarch2026DataQualityReport(db),
    getMarch2026FieldMappingReport(db),
    getMarch2026CodeTableRemediationReport(db),
  ]);
  const remediation = buildDataQualityRemediationQueueReport({
    codeTables,
    dataQuality,
    fieldMapping,
  });

  return buildLoadReadinessReport({
    codeTables,
    dataQuality,
    fieldMapping,
    remediation,
  });
}
