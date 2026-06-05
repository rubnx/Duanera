import {
  and,
  count,
  desc,
  eq,
  inArray,
  sql,
  type SQL,
} from "drizzle-orm";

import type { DbClient } from "@/db/client";
import {
  codeTables,
  codeValues,
  rawTradeRows,
  tradeRecords,
} from "@/db/schema";
import {
  tradeRecordCountryExpression,
  tradeRecordDecimalSumExpression,
  tradeRecordHsCodePrefixExpression,
  tradeRecordItemValueExpression,
  tradeRecordRelevantPortExpression,
  tradeRecordRelevantPortLabelExpression,
} from "@/trade/trade-record-expressions";
import type { TradeParticipantProfileRole } from "@/trade/trade-record-links";
import { formatTradeRecordPeriodValue } from "@/trade/trade-record-periods";
import { baseTradeRecordSummaryQuery } from "@/trade/trade-record-summary-query";
import type {
  TradeFlow,
  TradeRecordFilters,
  TradeRecordSummary,
} from "@/trade/trade-records";
import {
  buildTradeRecordWhere,
  type TradeRecordWhereOptions,
} from "@/trade/trade-record-where";

export type {
  TradeParticipantProfileRole,
} from "@/trade/trade-record-links";

export type TradeParticipantProfileRank = {
  code: string;
  labelRaw: string | null;
  records: number;
  totalItemValue: string | null;
};

export type TradeParticipantProfileMonthlyActivity = {
  period: string;
  year: number;
  month: number;
  records: number;
  totalItemValue: string | null;
};

export type TradeParticipantProfile = {
  role: TradeParticipantProfileRole;
  id: string;
  tradeFlow: TradeFlow;
  title: string;
  participantLabel: string;
  valueLabel: "US$ CIF" | "US$ FOB";
  countryLabel: "País origen" | "País destino";
  portLabel: "Puerto desembarque" | "Puerto embarque";
  totals: {
    records: number;
    activeMonths: number;
    totalItemValue: string | null;
  };
  monthlyActivity: TradeParticipantProfileMonthlyActivity[];
  rankings: {
    hsGroups: TradeParticipantProfileRank[];
    countries: TradeParticipantProfileRank[];
    ports: TradeParticipantProfileRank[];
    customsOffices: TradeParticipantProfileRank[];
  };
  recentRecords: TradeRecordSummary[];
};

const rankLimit = 10;
const monthlyActivityLimit = 24;
const recentRecordsLimit = 25;

export function parseTradeParticipantProfileRole(
  value: string | null | undefined,
): TradeParticipantProfileRole | null {
  return value === "importer" || value === "exporter" ? value : null;
}

export function tradeParticipantProfileFilters(
  role: TradeParticipantProfileRole,
  id: string,
): TradeRecordFilters {
  return role === "importer"
    ? {
        tradeFlow: "import",
        importerCorrelativeId: id,
      }
    : {
        tradeFlow: "export",
        exporterCorrelativeId: id,
      };
}

export function tradeParticipantProfileLabels(
  role: TradeParticipantProfileRole,
  id: string,
) {
  if (role === "importer") {
    return {
      title: `Importador ID Aduana ${id}`,
      participantLabel: "ID importador Aduana",
      valueLabel: "US$ CIF" as const,
      countryLabel: "País origen" as const,
      portLabel: "Puerto desembarque" as const,
    };
  }

  return {
    title: `Exportador ID Aduana ${id}`,
    participantLabel: "ID exportador Aduana",
    valueLabel: "US$ FOB" as const,
    countryLabel: "País destino" as const,
    portLabel: "Puerto embarque" as const,
  };
}

async function loadProfileTotals(
  db: DbClient,
  filters: TradeRecordFilters,
  options: TradeRecordWhereOptions,
) {
  const where = buildTradeRecordWhere(filters, options);
  const itemValue = tradeRecordItemValueExpression(filters);
  const [row] = await db
    .select({
      records: count(),
      activeMonths: sql<number>`count(distinct (${tradeRecords.periodYear} * 100 + ${tradeRecords.periodMonth}))::int`,
      totalItemValue: tradeRecordDecimalSumExpression(itemValue),
    })
    .from(tradeRecords)
    .where(where);

  return {
    records: row?.records ?? 0,
    activeMonths: row?.activeMonths ?? 0,
    totalItemValue: row?.totalItemValue ?? null,
  };
}

async function loadMonthlyActivity(
  db: DbClient,
  filters: TradeRecordFilters,
  options: TradeRecordWhereOptions,
): Promise<TradeParticipantProfileMonthlyActivity[]> {
  const where = buildTradeRecordWhere(filters, options);
  const itemValue = tradeRecordItemValueExpression(filters);
  const rows = await db
    .select({
      year: tradeRecords.periodYear,
      month: tradeRecords.periodMonth,
      records: count(),
      totalItemValue: tradeRecordDecimalSumExpression(itemValue),
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
    totalItemValue: row.totalItemValue,
  }));
}

async function loadRankedProfileSummary(
  db: DbClient,
  filters: TradeRecordFilters,
  codeExpression: SQL<string>,
  labelExpression: SQL<string | null> | undefined,
  options: TradeRecordWhereOptions,
): Promise<TradeParticipantProfileRank[]> {
  const where = buildTradeRecordWhere(filters, options);
  const codeNotEmpty = and(
    sql`${codeExpression} is not null`,
    sql`${codeExpression} <> ''`,
  );
  const itemValue = tradeRecordItemValueExpression(filters);
  const rows = await db
    .select({
      code: codeExpression,
      labelRaw: labelExpression ? sql<string | null>`min(${labelExpression})` : sql<null>`null`,
      records: count(),
      totalItemValue: tradeRecordDecimalSumExpression(itemValue),
    })
    .from(tradeRecords)
    .where(and(where, codeNotEmpty))
    .groupBy(codeExpression)
    .orderBy(desc(sql<number>`count(*)`), desc(sql<number>`sum(${itemValue})`))
    .limit(rankLimit);

  return rows.map((row) => ({
    code: row.code,
    labelRaw: row.labelRaw,
    records: row.records,
    totalItemValue: row.totalItemValue,
  }));
}

function normalizeCode(code: string | null | undefined) {
  const trimmed = code?.trim();
  if (!trimmed) {
    return null;
  }

  const numeric = Number.parseInt(trimmed, 10);
  if (/^\d+$/.test(trimmed) && Number.isFinite(numeric)) {
    return String(numeric);
  }

  return trimmed;
}

async function loadCodeLabels(
  db: DbClient,
  tableKey: string,
  ranks: TradeParticipantProfileRank[],
) {
  const codes = Array.from(
    new Set(ranks.map((rank) => normalizeCode(rank.code)).filter(Boolean)),
  ) as string[];

  if (codes.length === 0) {
    return new Map<string, string>();
  }

  const rows = await db
    .select({
      code: codeValues.codeValue,
      label: codeValues.labelEs,
    })
    .from(codeValues)
    .innerJoin(codeTables, eq(codeValues.codeTableId, codeTables.id))
    .where(
      and(
        eq(codeTables.codeTableKey, tableKey),
        inArray(codeValues.codeValue, codes),
      ),
    );

  return new Map(
    rows
      .map((row) => {
        const code = normalizeCode(row.code);
        return code && row.label ? [code, row.label] as const : null;
      })
      .filter((row): row is readonly [string, string] => Boolean(row)),
  );
}

function applyCodeLabels(
  ranks: TradeParticipantProfileRank[],
  labels: Map<string, string>,
) {
  return ranks.map((rank) => ({
    ...rank,
    labelRaw: rank.labelRaw ?? labels.get(normalizeCode(rank.code) ?? "") ?? null,
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
    .orderBy(
      desc(tradeRecords.periodYear),
      desc(tradeRecords.periodMonth),
      desc(rawTradeRows.rowNumber),
    )
    .limit(recentRecordsLimit);
}

export async function getTradeParticipantProfile(
  db: DbClient,
  {
    id,
    role,
  }: {
    id: string;
    role: TradeParticipantProfileRole;
  },
  options: TradeRecordWhereOptions = { productFacing: true },
): Promise<TradeParticipantProfile> {
  const labels = tradeParticipantProfileLabels(role, id);
  const filters = tradeParticipantProfileFilters(role, id);

  const [
    totals,
    monthlyActivity,
    hsGroups,
    countryRanks,
    portRanks,
    customsOfficeRanks,
    recentRecords,
  ] = await Promise.all([
    loadProfileTotals(db, filters, options),
    loadMonthlyActivity(db, filters, options),
    loadRankedProfileSummary(
      db,
      filters,
      tradeRecordHsCodePrefixExpression(),
      sql<string | null>`${tradeRecords.productDescriptionRaw}`,
      options,
    ),
    loadRankedProfileSummary(
      db,
      filters,
      tradeRecordCountryExpression(filters),
      role === "exporter"
        ? sql<string | null>`${tradeRecords.destinationCountryLabelRaw}`
        : undefined,
      options,
    ),
    loadRankedProfileSummary(
      db,
      filters,
      tradeRecordRelevantPortExpression(filters),
      tradeRecordRelevantPortLabelExpression(filters),
      options,
    ),
    loadRankedProfileSummary(
      db,
      filters,
      sql<string>`${tradeRecords.customsOfficeCode}`,
      undefined,
      options,
    ),
    loadRecentRecords(db, filters, options),
  ]);

  const [
    countryLabels,
    portLabels,
    customsOfficeLabels,
  ] = await Promise.all([
    loadCodeLabels(db, "chile_aduana:paises", countryRanks),
    loadCodeLabels(db, "chile_aduana:puertos", portRanks),
    loadCodeLabels(db, "chile_aduana:aduanas", customsOfficeRanks),
  ]);

  return {
    ...labels,
    id,
    role,
    tradeFlow: role === "importer" ? "import" : "export",
    totals,
    monthlyActivity,
    rankings: {
      hsGroups,
      countries: applyCodeLabels(countryRanks, countryLabels),
      ports: applyCodeLabels(portRanks, portLabels),
      customsOffices: applyCodeLabels(customsOfficeRanks, customsOfficeLabels),
    },
    recentRecords,
  };
}
