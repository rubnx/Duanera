import {
  and,
  asc,
  count,
  eq,
  inArray,
  sql,
  type SQL,
} from "drizzle-orm";

import type { DbClient } from "@/db/client";
import { countValueToNumber } from "@/db/count-values";
import {
  rawTradeRows,
  sourceFiles,
  tradeRecords,
} from "@/db/schema";
import {
  isActionableUndecodedCode,
  normalizeCodeForCoverage,
  type DataQualityStatus,
} from "@/quality/coverage";
import { codeCountsForDimension } from "@/quality/code-value-sets";
import {
  dataQualityIssueSampleFromRow,
  dataQualityIssueSearchHref,
  dataQualityIssueStatus,
  type DataQualityIssueGroup,
  type DataQualityIssueKind,
  type DataQualityIssueSample,
} from "@/quality/data-quality-issues";
import {
  march2026ReportPeriod,
  qualityPeriodSearchParams,
  qualityTradeRecordsWhere,
  type QualityReportPeriod,
} from "@/quality/march-2026";
import type { TradeFlow, TradeRecordFilters } from "@/trade/trade-records";

const toNumber = countValueToNumber;
const issueSampleLimit = 8;

const issueSampleColumns = {
  id: tradeRecords.id,
  tradeFlow: tradeRecords.tradeFlow,
  periodYear: tradeRecords.periodYear,
  periodMonth: tradeRecords.periodMonth,
  declarationIdRaw: tradeRecords.declarationIdRaw,
  itemNumber: tradeRecords.itemNumber,
  hsCodeNormalized: tradeRecords.hsCodeNormalized,
  productDescriptionRaw: tradeRecords.productDescriptionRaw,
  quantity: tradeRecords.quantity,
  quantityUnitCode: tradeRecords.quantityUnitCode,
  grossWeightItem: tradeRecords.grossWeightItem,
  grossWeightTotal: tradeRecords.grossWeightTotal,
  itemCifValue: tradeRecords.itemCifValue,
  itemFobValue: tradeRecords.itemFobValue,
  declarationFobValue: tradeRecords.declarationFobValue,
  unitPriceValue: tradeRecords.unitPriceValue,
  customsOfficeCode: tradeRecords.customsOfficeCode,
  embarkPortCode: tradeRecords.embarkPortCode,
  disembarkPortCode: tradeRecords.disembarkPortCode,
  transportModeCode: tradeRecords.transportModeCode,
  sourceFileId: tradeRecords.sourceFileId,
  importBatchId: tradeRecords.importBatchId,
  originalFilename: sourceFiles.originalFilename,
  normalizedRawFilename: sourceFiles.normalizedRawFilename,
  rawRowNumber: rawTradeRows.rowNumber,
};

async function countIssue(db: DbClient, where: SQL): Promise<number> {
  const [row] = await db
    .select({
      total: count(),
    })
    .from(tradeRecords)
    .where(where);

  return toNumber(row?.total);
}

async function sampleIssue({
  db,
  evidence,
  limit = issueSampleLimit,
  where,
}: {
  db: DbClient;
  evidence: string;
  limit?: number;
  where: SQL;
}): Promise<DataQualityIssueSample[]> {
  const rows = await db
    .select(issueSampleColumns)
    .from(tradeRecords)
    .innerJoin(rawTradeRows, eq(tradeRecords.rawTradeRowId, rawTradeRows.id))
    .innerJoin(sourceFiles, eq(tradeRecords.sourceFileId, sourceFiles.id))
    .where(where)
    .orderBy(asc(tradeRecords.tradeFlow), asc(rawTradeRows.rowNumber), asc(tradeRecords.id))
    .limit(limit);

  return rows
    .map((row) => dataQualityIssueSampleFromRow(row, evidence))
    .filter((row): row is DataQualityIssueSample => Boolean(row));
}

export async function issueGroupFromWhere({
  db,
  description,
  evidence,
  key,
  statusWhenPresent = "review",
  title,
  tradeRecordsHref,
  where,
}: {
  db: DbClient;
  description: string;
  evidence: string;
  key: DataQualityIssueKind;
  statusWhenPresent?: DataQualityStatus;
  title: string;
  tradeRecordsHref: string;
  where: SQL;
}): Promise<DataQualityIssueGroup> {
  const [issueCount, samples] = await Promise.all([
    countIssue(db, where),
    sampleIssue({ db, evidence, where }),
  ]);

  return {
    key,
    title,
    description,
    status: dataQualityIssueStatus(issueCount, statusWhenPresent),
    count: issueCount,
    sampleLimit: issueSampleLimit,
    tradeRecordsHref,
    samples,
  };
}

export type UndecodedIssueConfig = {
  codeSet: Set<string>;
  description: string;
  key: DataQualityIssueKind;
  sampleEvidence: string;
  statusWhenPresent?: DataQualityStatus;
  title: string;
  period?: QualityReportPeriod;
  flows: Array<{
    tradeFlow: TradeFlow;
    expression: SQL<string>;
    ignoredSourceCodes?: Set<string>;
    whereExpression: SQL<unknown>;
    searchFilter: (code: string) => TradeRecordFilters;
  }>;
};

export async function undecodedIssueGroup(
  db: DbClient,
  config: UndecodedIssueConfig,
): Promise<DataQualityIssueGroup> {
  const period = config.period ?? march2026ReportPeriod;
  const flowResults = await Promise.all(
    config.flows.map(async (flow) => {
      const rows = await codeCountsForDimension(
        db,
        flow.tradeFlow,
        flow.expression,
        period,
      );
      const undecodedRows = rows.filter((row) => {
        return isActionableUndecodedCode({
          code: row.code,
          codeSet: config.codeSet,
          ignoredSourceCodes: flow.ignoredSourceCodes,
        });
      });

      return {
        ...flow,
        rows: undecodedRows,
        count: undecodedRows.reduce((total, row) => total + toNumber(row.records), 0),
      };
    }),
  );

  const samples: DataQualityIssueSample[] = [];
  for (const result of flowResults) {
    if (samples.length >= issueSampleLimit) {
      break;
    }

    const rawCodes = result.rows
      .map((row) => row.code)
      .filter((code): code is string => Boolean(code));

    if (rawCodes.length === 0) {
      continue;
    }

    const remainingLimit = issueSampleLimit - samples.length;
    const flowSamples = await sampleIssue({
      db,
      evidence: config.sampleEvidence,
      limit: remainingLimit,
      where: and(
        qualityTradeRecordsWhere(period, result.tradeFlow),
        inArray(result.whereExpression, rawCodes.slice(0, 200)),
      ) ?? sql`false`,
    });
    samples.push(...flowSamples);
  }

  const firstCode = flowResults.flatMap((result) =>
    result.rows.map((row) => ({
      code: normalizeCodeForCoverage(row.code),
      tradeFlow: result.tradeFlow,
      searchFilter: result.searchFilter,
    })),
  )[0];
  const tradeRecordsHref = firstCode?.code
    ? dataQualityIssueSearchHref(firstCode.searchFilter(firstCode.code))
    : dataQualityIssueSearchHref({
        ...qualityPeriodSearchParams(period),
        limit: 25,
      });

  const issueCount = flowResults.reduce((total, result) => total + result.count, 0);

  return {
    key: config.key,
    title: config.title,
    description: config.description,
    status: dataQualityIssueStatus(issueCount, config.statusWhenPresent ?? "review"),
    count: issueCount,
    sampleLimit: issueSampleLimit,
    tradeRecordsHref,
    samples,
  };
}
