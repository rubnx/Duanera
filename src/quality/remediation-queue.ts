import type { DbClient } from "@/db/client";
import {
  getMarch2026CodeTableRemediationReport,
} from "@/quality/code-table-remediation";
import {
  getMarch2026DataQualityReport,
  type DataQualityReport,
  type DataQualityStatus,
} from "@/quality/data-quality";
import {
  getMarch2026FieldMappingReport,
} from "@/quality/field-mapping";
import {
  dedupeRemediationQueueItems,
} from "@/quality/remediation-queue-ranking";
import {
  remediationQueueItemInputs,
  type RemediationQueueSourceReports,
} from "@/quality/remediation-queue-items";
import type { TradeFlow } from "@/trade/trade-records";

export {
  dedupeRemediationQueueItems,
  remediationQueueScore,
  remediationQueueSort,
} from "@/quality/remediation-queue-ranking";

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

export function buildDataQualityRemediationQueueReport({
  codeTables,
  dataQuality,
  fieldMapping,
}: RemediationQueueSourceReports): RemediationQueueReport {
  const items = dedupeRemediationQueueItems(
    remediationQueueItemInputs({ codeTables, dataQuality, fieldMapping }),
  );

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
