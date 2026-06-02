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
import { loadReadinessDecisionFromStatuses } from "@/quality/load-readiness-helpers";
import { buildLoadReadinessAreas } from "@/quality/load-readiness-areas";
import { march2026ReportPeriod } from "@/quality/march-2026";

export {
  loadReadinessAreaStatusFromCounts,
  loadReadinessDecisionFromStatuses,
  loadReadinessDecisionLabel,
  loadReadinessDecisionSummary,
  loadReadinessStatusLabel,
  loadReadinessStatusRank,
  safeLoadReadinessLinks,
} from "@/quality/load-readiness-helpers";

const reportPeriod = march2026ReportPeriod;

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

export function buildLoadReadinessReport({
  codeTables,
  dataQuality,
  fieldMapping,
  remediation,
}: LoadReadinessSourceReports): LoadReadinessReport {
  const areas = buildLoadReadinessAreas({
    codeTables,
    dataQuality,
    fieldMapping,
    remediation,
  });
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
