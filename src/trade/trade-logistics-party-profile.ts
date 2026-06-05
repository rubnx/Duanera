import {
  and,
  count,
  desc,
  eq,
  sql,
  type SQL,
} from "drizzle-orm";

import type { DbClient } from "@/db/client";
import {
  sourceLogisticsParties,
  tradeRecordLogisticsPartyLinks,
  tradeRecords,
} from "@/db/schema";
import { canonicalTradeParticipantDisplayName } from "@/trade/trade-participant-display";
import {
  tradeRecordCountryExpression,
  tradeRecordDecimalSumExpression,
  tradeRecordHsCodePrefixExpression,
  tradeRecordRelevantPortExpression,
  tradeRecordRelevantPortLabelExpression,
} from "@/trade/trade-record-expressions";
import { baseTradeRecordSummaryQuery } from "@/trade/trade-record-summary-query";
import { formatTradeRecordPeriodValue } from "@/trade/trade-record-periods";
import type {
  TradeRecordFilters,
  TradeRecordLogisticsRole,
  TradeRecordSummary,
} from "@/trade/trade-records";
import {
  buildTradeRecordWhere,
  type TradeRecordWhereOptions,
} from "@/trade/trade-record-where";

export type LogisticsPartyProfileRank = {
  code: string;
  labelRaw: string | null;
  records: number;
  importCifValue: string | null;
  exportFobValue: string | null;
};

export type LogisticsPartyProfileMonthlyActivity = {
  period: string;
  year: number;
  month: number;
  records: number;
  importCifValue: string | null;
  exportFobValue: string | null;
};

export type LogisticsPartyProfileRoleBreakdown = {
  role: TradeRecordLogisticsRole;
  records: number;
};

export type LogisticsPartyProfileFlowBreakdown = {
  tradeFlow: "import" | "export";
  records: number;
  value: string | null;
};

export type LogisticsPartyProfile = {
  id: string;
  title: string;
  rawNameRepresentative: string | null;
  normalizedGroupName: string | null;
  normalizedLegalEntityName: string | null;
  countryCode: string | null;
  entityType: string | null;
  confidence: string;
  isAmbiguous: boolean;
  matchReason: string | null;
  filters: TradeRecordFilters;
  totals: {
    records: number;
    activeMonths: number;
    importCifValue: string | null;
    exportFobValue: string | null;
  };
  roleBreakdown: LogisticsPartyProfileRoleBreakdown[];
  flowBreakdown: LogisticsPartyProfileFlowBreakdown[];
  monthlyActivity: LogisticsPartyProfileMonthlyActivity[];
  rankings: {
    hsGroups: LogisticsPartyProfileRank[];
    countries: LogisticsPartyProfileRank[];
    ports: LogisticsPartyProfileRank[];
    customsOffices: LogisticsPartyProfileRank[];
    participants: LogisticsPartyProfileRank[];
  };
  recentRecords: TradeRecordSummary[];
};

const rankLimit = 10;
const monthlyActivityLimit = 24;
const recentRecordsLimit = 25;

export function logisticsPartyProfileFilters(
  id: string,
  role?: TradeRecordLogisticsRole,
): TradeRecordFilters {
  return role ? { logisticsPartyId: id, logisticsRole: role } : { logisticsPartyId: id };
}

function importCifSumExpression(): SQL<string | null> {
  return sql<string | null>`sum(case when ${tradeRecords.tradeFlow} = 'import' then ${tradeRecords.itemCifValue} else null end)::text`;
}

function exportFobSumExpression(): SQL<string | null> {
  return sql<string | null>`sum(case when ${tradeRecords.tradeFlow} = 'export' then ${tradeRecords.itemFobValue} else null end)::text`;
}

function participantExpression(): SQL<string> {
  return sql<string>`case
    when ${tradeRecords.tradeFlow} = 'import' then ${tradeRecords.importerCorrelativeId}
    else coalesce(${tradeRecords.exporterPrimaryCorrelativeId}, ${tradeRecords.exporterSecondaryCorrelativeId})
  end`;
}

async function loadParty(db: DbClient, id: string) {
  const [row] = await db
    .select({
      id: sourceLogisticsParties.id,
      displayName: sourceLogisticsParties.displayName,
      rawNameRepresentative: sourceLogisticsParties.rawNameRepresentative,
      normalizedGroupName: sourceLogisticsParties.normalizedGroupName,
      normalizedLegalEntityName: sourceLogisticsParties.normalizedLegalEntityName,
      countryCode: sourceLogisticsParties.countryCode,
      entityType: sourceLogisticsParties.entityType,
      confidence: sourceLogisticsParties.confidence,
      matchReason: sourceLogisticsParties.matchReason,
      isAmbiguous: sourceLogisticsParties.isAmbiguous,
    })
    .from(sourceLogisticsParties)
    .where(eq(sourceLogisticsParties.id, id))
    .limit(1);

  return row ?? null;
}

async function loadTotals(
  db: DbClient,
  filters: TradeRecordFilters,
  options: TradeRecordWhereOptions,
) {
  const where = buildTradeRecordWhere(filters, options);
  const [row] = await db
    .select({
      records: sql<number>`count(distinct ${tradeRecords.id})::int`,
      activeMonths: sql<number>`count(distinct (${tradeRecords.periodYear} * 100 + ${tradeRecords.periodMonth}))::int`,
      importCifValue: importCifSumExpression(),
      exportFobValue: exportFobSumExpression(),
    })
    .from(tradeRecords)
    .where(where);

  return {
    records: row?.records ?? 0,
    activeMonths: row?.activeMonths ?? 0,
    importCifValue: row?.importCifValue ?? null,
    exportFobValue: row?.exportFobValue ?? null,
  };
}

async function loadRoleBreakdown(
  db: DbClient,
  id: string,
  options: TradeRecordWhereOptions,
): Promise<LogisticsPartyProfileRoleBreakdown[]> {
  const productFacingWhere = buildTradeRecordWhere({}, options);
  const rows = await db
    .select({
      role: tradeRecordLogisticsPartyLinks.role,
      records: sql<number>`count(distinct ${tradeRecordLogisticsPartyLinks.tradeRecordId})::int`,
    })
    .from(tradeRecordLogisticsPartyLinks)
    .innerJoin(
      tradeRecords,
      eq(tradeRecordLogisticsPartyLinks.tradeRecordId, tradeRecords.id),
    )
    .where(and(eq(tradeRecordLogisticsPartyLinks.partyId, id), productFacingWhere))
    .groupBy(tradeRecordLogisticsPartyLinks.role)
    .orderBy(desc(sql<number>`count(distinct ${tradeRecordLogisticsPartyLinks.tradeRecordId})`));

  return rows
    .filter((row): row is { role: TradeRecordLogisticsRole; records: number } =>
      row.role === "issuer" || row.role === "carrier",
    )
    .map((row) => ({ role: row.role, records: row.records }));
}

async function loadFlowBreakdown(
  db: DbClient,
  filters: TradeRecordFilters,
  options: TradeRecordWhereOptions,
): Promise<LogisticsPartyProfileFlowBreakdown[]> {
  const where = buildTradeRecordWhere(filters, options);
  const rows = await db
    .select({
      tradeFlow: tradeRecords.tradeFlow,
      records: count(),
      value: tradeRecordDecimalSumExpression(sql`case when ${tradeRecords.tradeFlow} = 'import' then ${tradeRecords.itemCifValue} else ${tradeRecords.itemFobValue} end`),
    })
    .from(tradeRecords)
    .where(where)
    .groupBy(tradeRecords.tradeFlow)
    .orderBy(desc(sql<number>`count(*)`));

  return rows
    .filter((row): row is { tradeFlow: "import" | "export"; records: number; value: string | null } =>
      row.tradeFlow === "import" || row.tradeFlow === "export",
    )
    .map((row) => ({
      tradeFlow: row.tradeFlow,
      records: row.records,
      value: row.value,
    }));
}

async function loadMonthlyActivity(
  db: DbClient,
  filters: TradeRecordFilters,
  options: TradeRecordWhereOptions,
): Promise<LogisticsPartyProfileMonthlyActivity[]> {
  const where = buildTradeRecordWhere(filters, options);
  const rows = await db
    .select({
      year: tradeRecords.periodYear,
      month: tradeRecords.periodMonth,
      records: count(),
      importCifValue: importCifSumExpression(),
      exportFobValue: exportFobSumExpression(),
    })
    .from(tradeRecords)
    .where(where)
    .groupBy(tradeRecords.periodYear, tradeRecords.periodMonth)
    .orderBy(desc(tradeRecords.periodYear), desc(tradeRecords.periodMonth))
    .limit(monthlyActivityLimit);

  return rows.map((row) => ({
    period: formatTradeRecordPeriodValue(row.year, row.month),
    year: row.year,
    month: row.month,
    records: row.records,
    importCifValue: row.importCifValue,
    exportFobValue: row.exportFobValue,
  }));
}

async function loadRankedSummary(
  db: DbClient,
  filters: TradeRecordFilters,
  codeExpression: SQL<string>,
  labelExpression: SQL<string | null> | undefined,
  options: TradeRecordWhereOptions,
): Promise<LogisticsPartyProfileRank[]> {
  const where = buildTradeRecordWhere(filters, options);
  const codeNotEmpty = and(
    sql`${codeExpression} is not null`,
    sql`${codeExpression} <> ''`,
  );
  const rows = await db
    .select({
      code: codeExpression,
      labelRaw: labelExpression ? sql<string | null>`min(${labelExpression})` : sql<null>`null`,
      records: count(),
      importCifValue: importCifSumExpression(),
      exportFobValue: exportFobSumExpression(),
    })
    .from(tradeRecords)
    .where(and(where, codeNotEmpty))
    .groupBy(codeExpression)
    .orderBy(desc(sql<number>`count(*)`))
    .limit(rankLimit);

  return rows.map((row) => ({
    code: row.code,
    labelRaw: row.labelRaw,
    records: row.records,
    importCifValue: row.importCifValue,
    exportFobValue: row.exportFobValue,
  }));
}

async function loadRecentRecords(
  db: DbClient,
  filters: TradeRecordFilters,
  options: TradeRecordWhereOptions,
) {
  const where = buildTradeRecordWhere(filters, options);
  return baseTradeRecordSummaryQuery(db)
    .where(where)
    .orderBy(desc(tradeRecords.periodYear), desc(tradeRecords.periodMonth), desc(tradeRecords.acceptanceDate))
    .limit(recentRecordsLimit);
}

export async function getLogisticsPartyProfile(
  db: DbClient,
  id: string,
  role: TradeRecordLogisticsRole | undefined,
  options: TradeRecordWhereOptions = {},
): Promise<LogisticsPartyProfile | null> {
  const filters = logisticsPartyProfileFilters(id, role);
  const party = await loadParty(db, id);
  if (!party) {
    return null;
  }

  const [
    totals,
    roleBreakdown,
    flowBreakdown,
    monthlyActivity,
    hsGroups,
    countries,
    ports,
    customsOffices,
    participants,
    recentRecords,
  ] = await Promise.all([
    loadTotals(db, filters, options),
    loadRoleBreakdown(db, id, options),
    loadFlowBreakdown(db, filters, options),
    loadMonthlyActivity(db, filters, options),
    loadRankedSummary(db, filters, tradeRecordHsCodePrefixExpression(), undefined, options),
    loadRankedSummary(db, filters, tradeRecordCountryExpression(filters), undefined, options),
    loadRankedSummary(
      db,
      filters,
      tradeRecordRelevantPortExpression(filters),
      tradeRecordRelevantPortLabelExpression(filters),
      options,
    ),
    loadRankedSummary(
      db,
      filters,
      sql<string>`${tradeRecords.customsOfficeCode}`,
      undefined,
      options,
    ),
    loadRankedSummary(db, filters, participantExpression(), undefined, options),
    loadRecentRecords(db, filters, options),
  ]);

  if (options.productFacing && totals.records === 0) {
    return null;
  }

  return {
    id: party.id,
    title: canonicalTradeParticipantDisplayName(party.displayName),
    rawNameRepresentative: party.rawNameRepresentative,
    normalizedGroupName: party.normalizedGroupName,
    normalizedLegalEntityName: party.normalizedLegalEntityName,
    countryCode: party.countryCode,
    entityType: party.entityType,
    confidence: party.confidence,
    matchReason: party.matchReason,
    isAmbiguous: party.isAmbiguous,
    filters,
    totals,
    roleBreakdown,
    flowBreakdown,
    monthlyActivity,
    rankings: {
      hsGroups,
      countries,
      ports,
      customsOffices,
      participants,
    },
    recentRecords,
  };
}
