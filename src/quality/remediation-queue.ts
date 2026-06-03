import type { DbClient } from "@/db/client";
import {
  getCodeTableRemediationReport,
} from "@/quality/code-table-remediation";
import {
  getDataQualityReport,
  type DataQualityReport,
  type DataQualityStatus,
} from "@/quality/data-quality";
import {
  getFieldMappingReport,
} from "@/quality/field-mapping";
import {
  dedupeRemediationQueueItems,
} from "@/quality/remediation-queue-ranking";
import {
  remediationQueueItemInputs,
  type RemediationQueueSourceReports,
} from "@/quality/remediation-queue-items";
import type { TradeFlow } from "@/trade/trade-records";
import {
  march2026ReportPeriod,
  type QualityReportPeriod,
} from "@/quality/march-2026";

export {
  dedupeRemediationQueueItems,
  remediationQueueScore,
  remediationQueueSort,
} from "@/quality/remediation-queue-ranking";

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
  period: QualityReportPeriod;
  items: RemediationQueueItem[];
  summary: {
    totalItems: number;
    warningItems: number;
    reviewItems: number;
    visibleMvpItems: number;
    affectedRecordSignals: number;
  };
};

export function buildDataQualityRemediationQueueReport({
  codeTables,
  dataQuality,
  fieldMapping,
}: RemediationQueueSourceReports): RemediationQueueReport {
  const period = dataQuality.period ?? march2026ReportPeriod;
  const scopedDataQuality = {
    ...dataQuality,
    period,
  };
  const items = dedupeRemediationQueueItems(
    remediationQueueItemInputs({
      codeTables,
      dataQuality: scopedDataQuality,
      fieldMapping,
    }),
  );

  return {
    period,
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
  return getRemediationQueueReport(db, march2026ReportPeriod);
}

export async function getRemediationQueueReport(
  db: DbClient,
  period: QualityReportPeriod = march2026ReportPeriod,
): Promise<RemediationQueueReport> {
  const [dataQuality, fieldMapping, codeTables] = await Promise.all([
    getDataQualityReport(db, period),
    getFieldMappingReport(db, period),
    getCodeTableRemediationReport(db, period),
  ]);

  return buildDataQualityRemediationQueueReport({
    codeTables,
    dataQuality,
    fieldMapping,
  });
}
