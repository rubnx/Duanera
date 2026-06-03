import type { DbClient } from "@/db/client";
import {
  getCodeTableRemediationReport,
  type CodeTableRemediationReport,
} from "@/quality/code-table-remediation";
import {
  getDataQualityReport,
  type DataQualityReport,
} from "@/quality/data-quality";
import {
  getFieldMappingReport,
  type FieldMappingReport,
} from "@/quality/field-mapping";
import {
  buildDataQualityRemediationQueueReport,
  type RemediationQueueReport,
} from "@/quality/remediation-queue";
import { loadReadinessDecisionFromStatuses } from "@/quality/load-readiness-helpers";
import { buildLoadReadinessAreas } from "@/quality/load-readiness-areas";
import {
  march2026ReportPeriod,
  type QualityReportPeriod,
} from "@/quality/march-2026";

export {
  loadReadinessAreaStatusFromCounts,
  loadReadinessDecisionFromStatuses,
  loadReadinessDecisionLabel,
  loadReadinessDecisionSummary,
  loadReadinessStatusLabel,
  loadReadinessStatusRank,
  safeLoadReadinessLinks,
} from "@/quality/load-readiness-helpers";

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
  period: QualityReportPeriod;
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

export function buildLoadReadinessReport({
  codeTables,
  dataQuality,
  fieldMapping,
  remediation,
}: LoadReadinessSourceReports): LoadReadinessReport {
  const period = dataQuality.period ?? march2026ReportPeriod;
  const scopedDataQuality = {
    ...dataQuality,
    period,
  };
  const scopedFieldMapping = {
    ...fieldMapping,
    period: fieldMapping.period ?? period,
  };
  const scopedRemediation = {
    ...remediation,
    period: remediation.period ?? period,
  };
  const areas = buildLoadReadinessAreas({
    codeTables,
    dataQuality: scopedDataQuality,
    fieldMapping: scopedFieldMapping,
    remediation: scopedRemediation,
  });
  const statuses = areas.map((area) => area.status);
  const readyAreas = statuses.filter((status) => status === "ready").length;
  const reviewAreas = statuses.filter((status) => status === "review").length;
  const blockedAreas = statuses.filter((status) => status === "blocked").length;

  return {
    period,
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

export async function getMarch2026LoadReadinessReport(
  db: DbClient,
): Promise<LoadReadinessReport> {
  return getLoadReadinessReport(db, march2026ReportPeriod);
}

export async function getLoadReadinessReport(
  db: DbClient,
  period: QualityReportPeriod = march2026ReportPeriod,
): Promise<LoadReadinessReport> {
  const [dataQuality, fieldMapping, codeTables] = await Promise.all([
    getDataQualityReport(db, period),
    getFieldMappingReport(db, period),
    getCodeTableRemediationReport(db, period),
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
