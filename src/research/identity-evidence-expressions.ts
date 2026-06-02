import { eq, or, sql, type SQL } from "drizzle-orm";

import { tradeRecords } from "@/db/schema";
import type { TradeFlow } from "@/trade/trade-records";

export function groupParticipantExpression(tradeFlow: TradeFlow): SQL<string> {
  return tradeFlow === "import"
    ? sql<string>`${tradeRecords.importerCorrelativeId}`
    : sql<string>`coalesce(${tradeRecords.exporterPrimaryCorrelativeId}, ${tradeRecords.exporterSecondaryCorrelativeId})`;
}

export function itemValueExpression(tradeFlow: TradeFlow): SQL<string | null> {
  return tradeFlow === "import"
    ? sql<string | null>`${tradeRecords.itemCifValue}::text`
    : sql<string | null>`${tradeRecords.itemFobValue}::text`;
}

export function itemValueNumericExpression(tradeFlow: TradeFlow): SQL<string | null> {
  return tradeFlow === "import"
    ? sql<string | null>`${tradeRecords.itemCifValue}`
    : sql<string | null>`${tradeRecords.itemFobValue}`;
}

export function relevantCountryExpression(tradeFlow: TradeFlow): SQL<string | null> {
  return tradeFlow === "import"
    ? sql<string | null>`${tradeRecords.originCountryCode}`
    : sql<string | null>`${tradeRecords.destinationCountryCode}`;
}

export function relevantPortExpression(tradeFlow: TradeFlow): SQL<string | null> {
  return tradeFlow === "import"
    ? sql<string | null>`${tradeRecords.disembarkPortCode}`
    : sql<string | null>`${tradeRecords.embarkPortCode}`;
}

export function participantWhere(tradeFlow: TradeFlow, correlativeId: string) {
  return tradeFlow === "import"
    ? eq(tradeRecords.importerCorrelativeId, correlativeId)
    : or(
        eq(tradeRecords.exporterPrimaryCorrelativeId, correlativeId),
        eq(tradeRecords.exporterSecondaryCorrelativeId, correlativeId),
      );
}
