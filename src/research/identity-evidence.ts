import { and, desc, eq, sql } from "drizzle-orm";

import type { DbClient } from "@/db/client";
import { countValueToNumber } from "@/db/count-values";
import { queryResultRows } from "@/db/query-result";
import { rawTradeRows, tradeRecords } from "@/db/schema";
import {
  groupParticipantExpression,
  itemValueExpression,
  itemValueNumericExpression,
  participantWhere,
  relevantCountryExpression,
  relevantPortExpression,
} from "@/research/identity-evidence-expressions";
import {
  extractIdentityEvidenceSignals,
  identityEvidenceSummary,
  identityEvidenceUsefulnessFromRecords,
} from "@/research/identity-evidence-signals";
import { buildTradeRecordSearchHref } from "@/trade/trade-record-links";
import type { TradeFlow } from "@/trade/trade-records";

export {
  extractIdentityEvidenceSignals,
  identityEvidenceRecordValue,
  isUsefulIdentityEvidenceValue,
  normalizeIdentityEvidenceValue,
} from "@/research/identity-evidence-signals";

export type IdentityEvidenceStrength = "direct_source_text" | "context" | "weak";

export type IdentityEvidenceSignal = {
  field: string;
  label: string;
  value: string;
  strength: IdentityEvidenceStrength;
  caveat: string;
};

export type IdentityEvidenceRecord = {
  id: string;
  tradeFlow: TradeFlow;
  declarationIdRaw: string | null;
  itemNumber: number | null;
  hsCodeNormalized: string | null;
  productDescriptionRaw: string | null;
  productAttributes: unknown;
  itemValue: string | null;
  countryCode: string | null;
  customsOfficeCode: string | null;
  relevantPortCode: string | null;
  sourceFileId: string;
  importBatchId: string;
  rawTradeRowId: string;
  rawRowNumber: number;
  rawValues: unknown;
  evidenceSignals: IdentityEvidenceSignal[];
};

export type IdentityEvidenceGroup = {
  tradeFlow: TradeFlow;
  participantRole: "importador" | "exportador";
  correlativeId: string;
  recordCount: number;
  declarationCount: number;
  hsCodeCount: number;
  countryCount: number;
  maxItemValue: string | null;
  tradeRecordsHref: string;
  evidenceUsefulness: IdentityEvidenceStrength;
  evidenceSummary: string;
  records: IdentityEvidenceRecord[];
};

type IdentityEvidenceGroupRow = {
  correlativeId: string;
  recordCount: number | string;
  declarationCount: number | string;
  hsCodeCount: number | string;
  countryCount: number | string;
  maxItemValue: string | null;
};

export type IdentityEvidenceOptions = {
  tradeFlow: TradeFlow;
  groupLimit?: number;
  sampleLimit?: number;
  minRecords?: number;
};

const toNumber = countValueToNumber;

function groupHref(tradeFlow: TradeFlow, correlativeId: string) {
  return buildTradeRecordSearchHref({
    tradeFlow,
    periodFrom: "2026-03",
    periodTo: "2026-03",
    limit: "25",
    ...(tradeFlow === "import"
      ? { importer: correlativeId }
      : { exporter: correlativeId }),
  });
}

async function listGroupRows(
  db: DbClient,
  options: Required<IdentityEvidenceOptions>,
) {
  const participantCode = groupParticipantExpression(options.tradeFlow);
  const countryCode = relevantCountryExpression(options.tradeFlow);
  const itemValue = itemValueNumericExpression(options.tradeFlow);

  if (options.tradeFlow === "export") {
    const result = await db.execute(sql`
      select
        participant."correlativeId" as "correlativeId",
        count(*)::int as "recordCount",
        count(distinct ${tradeRecords.declarationIdRaw})::int as "declarationCount",
        count(distinct ${tradeRecords.hsCodeNormalized})::int as "hsCodeCount",
        count(distinct ${countryCode})::int as "countryCount",
        max(${itemValue})::text as "maxItemValue"
      from ${tradeRecords}
      cross join lateral (
        select distinct participant_code as "correlativeId"
        from (
          values
            (${tradeRecords.exporterPrimaryCorrelativeId}),
            (${tradeRecords.exporterSecondaryCorrelativeId})
        ) as participant_values(participant_code)
        where participant_code is not null
          and participant_code <> ''
          and participant_code <> '0'
      ) as participant
      where ${tradeRecords.tradeFlow} = ${options.tradeFlow}
        and ${tradeRecords.periodYear} = 2026
        and ${tradeRecords.periodMonth} = 3
      group by participant."correlativeId"
      having count(*) >= ${options.minRecords}
      order by count(*) desc, participant."correlativeId" asc
      limit ${options.groupLimit};
    `);

    return queryResultRows<IdentityEvidenceGroupRow>(
      result,
      "export identity evidence group query result",
    );
  }

  const result = await db.execute(sql`
    select
      ${participantCode} as "correlativeId",
      count(*)::int as "recordCount",
      count(distinct ${tradeRecords.declarationIdRaw})::int as "declarationCount",
      count(distinct ${tradeRecords.hsCodeNormalized})::int as "hsCodeCount",
      count(distinct ${countryCode})::int as "countryCount",
      max(${itemValue})::text as "maxItemValue"
    from ${tradeRecords}
    where ${tradeRecords.tradeFlow} = ${options.tradeFlow}
      and ${tradeRecords.periodYear} = 2026
      and ${tradeRecords.periodMonth} = 3
      and ${participantCode} is not null
      and ${participantCode} <> ''
      and ${participantCode} <> '0'
    group by ${participantCode}
    having count(*) >= ${options.minRecords}
    order by count(*) desc, ${participantCode} asc
    limit ${options.groupLimit};
  `);

  return queryResultRows<IdentityEvidenceGroupRow>(
    result,
    "import identity evidence group query result",
  );
}

async function sampleRecordsForGroup(
  db: DbClient,
  tradeFlow: TradeFlow,
  correlativeId: string,
  limit: number,
) {
  const itemValue = itemValueExpression(tradeFlow);
  const itemValueNumeric = itemValueNumericExpression(tradeFlow);
  const countryCode = relevantCountryExpression(tradeFlow);
  const portCode = relevantPortExpression(tradeFlow);
  const where = and(
    eq(tradeRecords.tradeFlow, tradeFlow),
    eq(tradeRecords.periodYear, 2026),
    eq(tradeRecords.periodMonth, 3),
    participantWhere(tradeFlow, correlativeId),
  );

  const rows = await db
    .select({
      id: tradeRecords.id,
      tradeFlow: tradeRecords.tradeFlow,
      declarationIdRaw: tradeRecords.declarationIdRaw,
      itemNumber: tradeRecords.itemNumber,
      hsCodeNormalized: tradeRecords.hsCodeNormalized,
      productDescriptionRaw: tradeRecords.productDescriptionRaw,
      productAttributes: tradeRecords.productAttributes,
      itemValue,
      countryCode,
      customsOfficeCode: tradeRecords.customsOfficeCode,
      relevantPortCode: portCode,
      sourceFileId: tradeRecords.sourceFileId,
      importBatchId: tradeRecords.importBatchId,
      rawTradeRowId: tradeRecords.rawTradeRowId,
      rawRowNumber: rawTradeRows.rowNumber,
      rawValues: rawTradeRows.rawValues,
    })
    .from(tradeRecords)
    .innerJoin(rawTradeRows, eq(tradeRecords.rawTradeRowId, rawTradeRows.id))
    .where(where)
    .orderBy(desc(itemValueNumeric))
    .limit(limit);

  return rows.map((row) => ({
    ...row,
    tradeFlow: row.tradeFlow as TradeFlow,
    evidenceSignals: extractIdentityEvidenceSignals({
      tradeFlow: row.tradeFlow as TradeFlow,
      productDescriptionRaw: row.productDescriptionRaw,
      productAttributes: row.productAttributes,
      rawValues: row.rawValues,
    }),
  }));
}

export async function listIdentityEvidenceGroups(
  db: DbClient,
  options: IdentityEvidenceOptions,
): Promise<IdentityEvidenceGroup[]> {
  const normalizedOptions: Required<IdentityEvidenceOptions> = {
    tradeFlow: options.tradeFlow,
    groupLimit: Math.min(Math.max(Math.trunc(options.groupLimit ?? 8), 1), 20),
    sampleLimit: Math.min(Math.max(Math.trunc(options.sampleLimit ?? 4), 1), 8),
    minRecords: Math.min(Math.max(Math.trunc(options.minRecords ?? 50), 1), 10000),
  };

  const groups = await listGroupRows(db, normalizedOptions);
  const recordsByGroup = await Promise.all(
    groups.map((group) =>
      sampleRecordsForGroup(
        db,
        normalizedOptions.tradeFlow,
        group.correlativeId,
        normalizedOptions.sampleLimit,
      ),
    ),
  );

  return groups.map((group, index) => {
    const records = recordsByGroup[index] ?? [];
    const evidenceUsefulness = identityEvidenceUsefulnessFromRecords(records);

    return {
      tradeFlow: normalizedOptions.tradeFlow,
      participantRole:
        normalizedOptions.tradeFlow === "import" ? "importador" : "exportador",
      correlativeId: group.correlativeId,
      recordCount: toNumber(group.recordCount),
      declarationCount: toNumber(group.declarationCount),
      hsCodeCount: toNumber(group.hsCodeCount),
      countryCount: toNumber(group.countryCount),
      maxItemValue: group.maxItemValue,
      tradeRecordsHref: groupHref(normalizedOptions.tradeFlow, group.correlativeId),
      evidenceUsefulness,
      evidenceSummary: identityEvidenceSummary(evidenceUsefulness),
      records,
    };
  });
}
