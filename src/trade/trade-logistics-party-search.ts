import { and, desc, eq, sql, type SQL } from "drizzle-orm";

import type { DbClient } from "@/db/client";
import {
  sourceLogisticsParties,
  sourceLogisticsPartyAliases,
} from "@/db/schema";
import { buildLogisticsPartyProfileHref } from "@/trade/trade-record-links";
import type { TradeRecordWhereOptions } from "@/trade/trade-record-where";

export type LogisticsPartySearchResult = {
  displayName: string;
  href: string;
  id: string;
  normalizedGroupName: string | null;
  recordCount: number;
};

const defaultLimit = 20;
const maxLimit = 50;

function clampLimit(value: string | null): number {
  if (!value?.trim()) {
    return defaultLimit;
  }

  const parsed = Number.parseInt(value, 10);
  if (!/^\d+$/.test(value.trim()) || parsed < 1) {
    return defaultLimit;
  }

  return Math.min(parsed, maxLimit);
}

export function logisticsPartySearchInput(params: URLSearchParams): {
  limit: number;
  query: string;
} {
  return {
    limit: clampLimit(params.get("limit")),
    query: (params.get("q") ?? "").trim(),
  };
}

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function searchPattern(query: string) {
  return `%${escapeLikePattern(query)}%`;
}

function rowToSearchResult(row: {
  displayName: string;
  id: string;
  normalizedGroupName: string | null;
  recordCount: number;
}): LogisticsPartySearchResult {
  return {
    displayName: row.displayName,
    href: buildLogisticsPartyProfileHref(row.id),
    id: row.id,
    normalizedGroupName: row.normalizedGroupName,
    recordCount: row.recordCount,
  };
}

export function logisticsPartyMatchingRecordCountSql(
  tradeRecordWhere: SQL,
): SQL<number> {
  return sql<number>`(
    select count(distinct trl.trade_record_id)::int
    from trade_record_logistics_party_links trl
    inner join trade_records
      on trl.trade_record_id = trade_records.id
    where trl.party_id = source_logistics_parties.id
      and ${tradeRecordWhere}
  )`;
}

export async function searchLogisticsParties(
  db: DbClient,
  input: { limit?: number; query?: string },
  _options: TradeRecordWhereOptions = { productFacing: true },
): Promise<LogisticsPartySearchResult[]> {
  const limit = Math.min(Math.max(input.limit ?? defaultLimit, 1), maxLimit);
  const query = input.query?.trim() ?? "";
  const hasSearch = query.length >= 2;
  const pattern = searchPattern(query);
  const where = hasSearch
    ? and(
        sql`${sourceLogisticsParties.recordCount} > 0`,
        sql`(
          ${sourceLogisticsParties.displayName} ilike ${pattern} escape '\\'
          or ${sourceLogisticsParties.rawNameRepresentative} ilike ${pattern} escape '\\'
          or ${sourceLogisticsParties.normalizedLegalEntityName} ilike ${pattern} escape '\\'
          or ${sourceLogisticsParties.normalizedGroupName} ilike ${pattern} escape '\\'
          or exists (
            select 1
            from ${sourceLogisticsPartyAliases}
            where ${sourceLogisticsPartyAliases.partyId} = ${sourceLogisticsParties.id}
              and ${sourceLogisticsPartyAliases.rawValue} ilike ${pattern} escape '\\'
          )
        )`,
      )
    : sql`${sourceLogisticsParties.recordCount} > 0`;

  const rows = await db
    .select({
      id: sourceLogisticsParties.id,
      displayName: sourceLogisticsParties.displayName,
      normalizedGroupName: sourceLogisticsParties.normalizedGroupName,
      recordCount: sourceLogisticsParties.recordCount,
    })
    .from(sourceLogisticsParties)
    .where(where)
    .orderBy(
      desc(sourceLogisticsParties.recordCount),
      sourceLogisticsParties.displayName,
    )
    .limit(limit);

  return rows.map(rowToSearchResult);
}

export async function getLogisticsPartySearchResultById(
  db: DbClient,
  id: string,
): Promise<LogisticsPartySearchResult | null> {
  const [row] = await db
    .select({
      id: sourceLogisticsParties.id,
      displayName: sourceLogisticsParties.displayName,
      normalizedGroupName: sourceLogisticsParties.normalizedGroupName,
      recordCount: sourceLogisticsParties.recordCount,
    })
    .from(sourceLogisticsParties)
    .where(eq(sourceLogisticsParties.id, id))
    .limit(1);

  return row ? rowToSearchResult(row) : null;
}
