import { asc, eq } from "drizzle-orm";

import type { DbClient } from "@/db/client";
import {
  sourceLogisticsParties,
  tradeRecordLogisticsPartyLinks,
} from "@/db/schema";
import { canonicalTradeParticipantDisplayName } from "@/trade/trade-participant-display";
import { buildLogisticsPartyProfileHref } from "@/trade/trade-record-links";
import type { TradeRecordLogisticsRole } from "@/trade/trade-records";

export type TradeRecordLogisticsPartyLink = {
  role: TradeRecordLogisticsRole;
  sourceField: string;
  rawValue: string;
  partyId: string;
  displayName: string;
  href: string;
};

export async function loadTradeRecordLogisticsPartyLinks(
  db: DbClient,
  tradeRecordId: string,
): Promise<TradeRecordLogisticsPartyLink[]> {
  const rows = await db
    .select({
      role: tradeRecordLogisticsPartyLinks.role,
      sourceField: tradeRecordLogisticsPartyLinks.sourceField,
      rawValue: tradeRecordLogisticsPartyLinks.rawValue,
      partyId: sourceLogisticsParties.id,
      displayName: sourceLogisticsParties.displayName,
    })
    .from(tradeRecordLogisticsPartyLinks)
    .innerJoin(
      sourceLogisticsParties,
      eq(tradeRecordLogisticsPartyLinks.partyId, sourceLogisticsParties.id),
    )
    .where(eq(tradeRecordLogisticsPartyLinks.tradeRecordId, tradeRecordId))
    .orderBy(
      asc(tradeRecordLogisticsPartyLinks.role),
      asc(tradeRecordLogisticsPartyLinks.sourceField),
    );

  return rows
    .filter((row): row is typeof row & { role: TradeRecordLogisticsRole } =>
      row.role === "issuer" || row.role === "carrier",
    )
    .map((row) => ({
      role: row.role,
      sourceField: row.sourceField,
      rawValue: row.rawValue,
      partyId: row.partyId,
      displayName: canonicalTradeParticipantDisplayName(row.displayName),
      href: buildLogisticsPartyProfileHref(row.partyId),
    }));
}
