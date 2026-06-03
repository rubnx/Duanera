import { formatIntegerEsCl } from "@/lib/format";
import type { CodeTableRemediationReport } from "@/quality/code-table-remediation";
import type { DataQualityReport } from "@/quality/data-quality";
import type { FieldMappingReport } from "@/quality/field-mapping";
import {
  loadReadinessAreaStatusFromCounts,
  safeLoadReadinessLinks,
} from "@/quality/load-readiness-helpers";
import type { LoadReadinessArea } from "@/quality/load-readiness";
import type { RemediationQueueReport } from "@/quality/remediation-queue";
import { qualityPeriodSearchParams } from "@/quality/march-2026";
import { buildTradeRecordSearchHref } from "@/trade/trade-record-links";

const formatNumber = formatIntegerEsCl;

function qualityHref(pathname: string, report: { period: DataQualityReport["period"] }) {
  const query = new URLSearchParams(qualityPeriodSearchParams(report.period));
  return `${pathname}?${query.toString()}`;
}

function tradeHref(report: { period: DataQualityReport["period"] }) {
  return buildTradeRecordSearchHref({
    ...qualityPeriodSearchParams(report.period),
    limit: "25",
  });
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
        : `El período ${report.period.label} mantiene trazabilidad fuente/lote para revisión dev.`,
    evidence: safeLoadReadinessLinks([
      {
        label: "Fuentes período evaluado",
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
    report.totals.failedRows > 0 ||
    report.totals.rawToTradeDelta !== 0 ||
    flowWarnings > 0
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
        : `Los conteos ${report.period.label} cierran para usar la misma ruta como validación dev, con vigilancia sobre advertencias.`,
    evidence: safeLoadReadinessLinks([
      {
        label: "Filas raw",
        value: formatNumber(report.totals.rawRows),
        href: "/data-quality",
      },
      {
        label: "Registros normalizados",
        value: formatNumber(report.totals.tradeRecords),
        href: tradeHref(report),
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
  const expectedSourceLimitations = report.rows.filter(
    (row) =>
      row.tradeFlow === "import" && row.normalizedField === "grossWeightItem",
  );
  const highImpactReviewRows = report.rows.filter((row) => {
    if (row.status !== "warning") {
      return false;
    }

    if (row.tradeFlow === "export" && row.normalizedField === "cifValue") {
      return false;
    }

    if (
      row.tradeFlow === "import" &&
      row.normalizedField === "grossWeightItem"
    ) {
      return false;
    }

    return (
      row.group === "commercial_values" ||
      row.group === "quantity_weight" ||
      row.group === "geography_logistics" ||
      row.group === "hs_product"
    );
  });
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
        : `La cobertura normalizada se evalúa para ${report.period.label}; las definiciones de layout siguen basadas en los DIN/DUS main conocidos.`,
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
      {
        label: "Limitaciones fuente esperadas",
        value: formatNumber(expectedSourceLimitations.length),
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
        label: "Comparar ordinals/campos fuente del próximo mes contra las definiciones DIN/DUS main conocidas y confirmar si DIN sigue sin peso bruto item.",
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
    .filter(
      (row) => row.retentionMode === "full_postgres" || row.storageKind === "postgres",
    )
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
        : `La retención payload se evalúa para ${report.period.label}; no debe escalarse sin pruebas reales con retención selectiva.`,
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
        label: "Mantener pruning como dry-run salvo confirmación explícita; no tocar payloads desde este gate.",
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
        label: "Registros período evaluado",
        value: formatNumber(dataQuality.totals.tradeRecords),
        href: tradeHref(dataQuality),
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

function remediationArea(report: RemediationQueueReport): LoadReadinessArea {
  const status = loadReadinessAreaStatusFromCounts({
    blockers: 0,
    warnings: report.summary.warningItems + report.summary.reviewItems,
  });
  const remediationHref = qualityHref("/data-quality/remediation", report);

  return {
    key: "march_remediation",
    title: "Remediación del período pendiente",
    status,
    summary:
      `La cola ${report.period.label} resume blockers y revisiones ya expuestos en las áreas anteriores; úsala como checklist operativo.`,
    evidence: safeLoadReadinessLinks([
      {
        label: "Items priorizados",
        value: formatNumber(report.summary.totalItems),
        href: remediationHref,
      },
      {
        label: "Items riesgo",
        value: formatNumber(report.summary.warningItems),
        href: remediationHref,
      },
      {
        label: "Items revisar",
        value: formatNumber(report.summary.reviewItems),
        href: remediationHref,
      },
      {
        label: "Señales afectadas",
        value: formatNumber(report.summary.affectedRecordSignals),
        href: remediationHref,
      },
    ]),
    actions: safeLoadReadinessLinks([
      {
        label: "Resolver o documentar los items de riesgo reales de la cola antes de cargar otro mes.",
        href: remediationHref,
        required: false,
      },
      {
        label: "Usar la cola como checklist durante la validación del siguiente mes.",
        href: remediationHref,
        required: true,
      },
    ]),
  };
}

export function buildLoadReadinessAreas({
  codeTables,
  dataQuality,
  fieldMapping,
  remediation,
}: {
  codeTables: CodeTableRemediationReport;
  dataQuality: DataQualityReport;
  fieldMapping: FieldMappingReport;
  remediation: RemediationQueueReport;
}): LoadReadinessArea[] {
  return [
    sourceArchiveProvenanceArea(dataQuality),
    parserFieldCountArea(dataQuality),
    fieldMappingArea(fieldMapping),
    codeTablesArea(codeTables),
    payloadRetentionArea(dataQuality),
    queryPerformanceArea({ dataQuality, remediation }),
    remediationArea(remediation),
  ];
}
