import {
  sql,
  type SQL,
} from "drizzle-orm";

import { tradeRecords } from "@/db/schema";

type TradeFlowFilter = {
  tradeFlow?: "import" | "export";
};

export type ParsedTradeRecordPeriod = {
  year: number;
  month: number;
  value: number;
};

export function tradeRecordPeriodNumber(year: number, month: number): number {
  return year * 100 + month;
}

export function parseTradeRecordPeriod(value: string): ParsedTradeRecordPeriod {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) {
    throw new Error(`Period must use YYYY-MM format, got ${value}.`);
  }

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  if (month < 1 || month > 12) {
    throw new Error(`Period month must be between 01 and 12, got ${value}.`);
  }

  return {
    year,
    month,
    value: tradeRecordPeriodNumber(year, month),
  };
}

export function tradeRecordPeriodTupleExpression(): SQL<number> {
  return sql<number>`(${tradeRecords.periodYear}, ${tradeRecords.periodMonth})`;
}

export function tradeRecordItemValueExpression(
  filters: TradeFlowFilter,
): SQL<string> {
  if (filters.tradeFlow === "import") {
    return sql<string>`${tradeRecords.itemCifValue}`;
  }

  if (filters.tradeFlow === "export") {
    return sql<string>`${tradeRecords.itemFobValue}`;
  }

  return sql<string>`case when ${tradeRecords.tradeFlow} = 'import' then ${tradeRecords.itemCifValue} else ${tradeRecords.itemFobValue} end`;
}

export function tradeRecordGrossWeightExpression(): SQL<string> {
  return sql<string>`coalesce(${tradeRecords.grossWeightItem}, ${tradeRecords.grossWeightTotal})`;
}

export function tradeRecordCountryExpression(filters: TradeFlowFilter): SQL<string> {
  if (filters.tradeFlow === "import") {
    return sql<string>`${tradeRecords.originCountryCode}`;
  }

  if (filters.tradeFlow === "export") {
    return sql<string>`${tradeRecords.destinationCountryCode}`;
  }

  return sql<string>`case when ${tradeRecords.tradeFlow} = 'import' then ${tradeRecords.originCountryCode} else ${tradeRecords.destinationCountryCode} end`;
}

export function tradeRecordRelevantPortExpression(
  filters: TradeFlowFilter,
): SQL<string> {
  if (filters.tradeFlow === "import") {
    return sql<string>`${tradeRecords.disembarkPortCode}`;
  }

  if (filters.tradeFlow === "export") {
    return sql<string>`${tradeRecords.embarkPortCode}`;
  }

  return sql<string>`case when ${tradeRecords.tradeFlow} = 'import' then ${tradeRecords.disembarkPortCode} else ${tradeRecords.embarkPortCode} end`;
}

export function tradeRecordRelevantPortLabelExpression(
  filters: TradeFlowFilter,
): SQL<string> {
  if (filters.tradeFlow === "import") {
    return sql<string>`${tradeRecords.disembarkPortLabelRaw}`;
  }

  if (filters.tradeFlow === "export") {
    return sql<string>`${tradeRecords.embarkPortLabelRaw}`;
  }

  return sql<string>`case when ${tradeRecords.tradeFlow} = 'import' then ${tradeRecords.disembarkPortLabelRaw} else ${tradeRecords.embarkPortLabelRaw} end`;
}

export function tradeRecordParticipantCorrelativeExpression(
  filters: TradeFlowFilter,
): SQL<string> {
  if (filters.tradeFlow === "import") {
    return sql<string>`${tradeRecords.importerCorrelativeId}`;
  }

  if (filters.tradeFlow === "export") {
    return sql<string>`coalesce(${tradeRecords.exporterPrimaryCorrelativeId}, ${tradeRecords.exporterSecondaryCorrelativeId})`;
  }

  return sql<string>`case when ${tradeRecords.tradeFlow} = 'import' then ${tradeRecords.importerCorrelativeId} else coalesce(${tradeRecords.exporterPrimaryCorrelativeId}, ${tradeRecords.exporterSecondaryCorrelativeId}) end`;
}

export function tradeRecordHsCodePrefixExpression(): SQL<string> {
  return sql<string>`substring(${tradeRecords.hsCodeNormalized} from 1 for 6)`;
}

export function tradeRecordDecimalSumExpression(
  expression: SQL<string>,
): SQL<string | null> {
  return sql<string | null>`sum(${expression})::text`;
}
