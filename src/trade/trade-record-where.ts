import {
  and,
  eq,
  gte,
  ilike,
  like,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import { tradeRecords } from "@/db/schema";
import {
  parseTradeRecordPeriod,
  tradeRecordItemValueExpression,
  tradeRecordPeriodTupleExpression,
} from "@/trade/trade-record-expressions";
import type { TradeRecordFilters } from "@/trade/trade-records";

function gteDecimal(expression: SQL<string>, value: string): SQL {
  return sql`${expression} >= ${value}`;
}

function lteDecimal(expression: SQL<string>, value: string): SQL {
  return sql`${expression} <= ${value}`;
}

export function buildTradeRecordWhere(filters: TradeRecordFilters): SQL | undefined {
  const conditions: SQL[] = [];

  if (filters.tradeFlow) {
    conditions.push(eq(tradeRecords.tradeFlow, filters.tradeFlow));
  }

  if (filters.periodYear) {
    conditions.push(eq(tradeRecords.periodYear, filters.periodYear));
  }

  if (filters.periodMonth) {
    conditions.push(eq(tradeRecords.periodMonth, filters.periodMonth));
  }

  const periodFrom = filters.periodFrom
    ? parseTradeRecordPeriod(filters.periodFrom)
    : undefined;
  const periodTo = filters.periodTo
    ? parseTradeRecordPeriod(filters.periodTo)
    : undefined;

  if (filters.periodFrom) {
    if (periodFrom && periodTo && periodFrom.value === periodTo.value) {
      conditions.push(eq(tradeRecords.periodYear, periodFrom.year));
      conditions.push(eq(tradeRecords.periodMonth, periodFrom.month));
    } else if (periodFrom) {
      conditions.push(
        sql`${tradeRecordPeriodTupleExpression()} >= (${periodFrom.year}, ${periodFrom.month})`,
      );
    }
  }

  if (filters.periodTo && (!periodFrom || !periodTo || periodFrom.value !== periodTo.value)) {
    if (periodTo) {
      conditions.push(
        sql`${tradeRecordPeriodTupleExpression()} <= (${periodTo.year}, ${periodTo.month})`,
      );
    }
  }

  if (filters.hsCodePrefix) {
    conditions.push(like(tradeRecords.hsCodeNormalized, `${filters.hsCodePrefix}%`));
  }

  if (filters.productQuery) {
    conditions.push(ilike(tradeRecords.productSearchText, `%${filters.productQuery}%`));
  }

  if (filters.importerCorrelativeId) {
    conditions.push(eq(tradeRecords.importerCorrelativeId, filters.importerCorrelativeId));
  }

  if (filters.exporterCorrelativeId) {
    conditions.push(
      or(
        eq(tradeRecords.exporterPrimaryCorrelativeId, filters.exporterCorrelativeId),
        eq(tradeRecords.exporterSecondaryCorrelativeId, filters.exporterCorrelativeId),
      )!,
    );
  }

  if (filters.originCountryCode) {
    conditions.push(eq(tradeRecords.originCountryCode, filters.originCountryCode));
  }

  if (filters.destinationCountryCode) {
    conditions.push(eq(tradeRecords.destinationCountryCode, filters.destinationCountryCode));
  }

  if (filters.customsOfficeCode) {
    conditions.push(eq(tradeRecords.customsOfficeCode, filters.customsOfficeCode));
  }

  if (filters.transportModeCode) {
    conditions.push(eq(tradeRecords.transportModeCode, filters.transportModeCode));
  }

  if (filters.portCode) {
    if (filters.tradeFlow === "import") {
      conditions.push(eq(tradeRecords.disembarkPortCode, filters.portCode));
    } else if (filters.tradeFlow === "export") {
      conditions.push(eq(tradeRecords.embarkPortCode, filters.portCode));
    } else {
      conditions.push(
        or(
          eq(tradeRecords.embarkPortCode, filters.portCode),
          eq(tradeRecords.disembarkPortCode, filters.portCode),
        )!,
      );
    }
  }

  const itemValue = tradeRecordItemValueExpression(filters);
  if (filters.minItemValue) {
    conditions.push(gteDecimal(itemValue, filters.minItemValue));
  }
  if (filters.maxItemValue) {
    conditions.push(lteDecimal(itemValue, filters.maxItemValue));
  }

  if (filters.minDeclarationFob) {
    conditions.push(gte(tradeRecords.declarationFobValue, filters.minDeclarationFob));
  }
  if (filters.maxDeclarationFob) {
    conditions.push(lte(tradeRecords.declarationFobValue, filters.maxDeclarationFob));
  }

  if (filters.minQuantity) {
    conditions.push(gte(tradeRecords.quantity, filters.minQuantity));
  }
  if (filters.maxQuantity) {
    conditions.push(lte(tradeRecords.quantity, filters.maxQuantity));
  }

  if (filters.minGrossWeightItem) {
    conditions.push(gte(tradeRecords.grossWeightItem, filters.minGrossWeightItem));
  }
  if (filters.maxGrossWeightItem) {
    conditions.push(lte(tradeRecords.grossWeightItem, filters.maxGrossWeightItem));
  }

  if (filters.minGrossWeightTotal) {
    conditions.push(gte(tradeRecords.grossWeightTotal, filters.minGrossWeightTotal));
  }
  if (filters.maxGrossWeightTotal) {
    conditions.push(lte(tradeRecords.grossWeightTotal, filters.maxGrossWeightTotal));
  }

  if (filters.sourceFileId) {
    conditions.push(eq(tradeRecords.sourceFileId, filters.sourceFileId));
  }

  if (filters.importBatchId) {
    conditions.push(eq(tradeRecords.importBatchId, filters.importBatchId));
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

export function hasTradeRecordRangeFilters(filters: TradeRecordFilters): boolean {
  return Boolean(
    filters.minItemValue ||
      filters.maxItemValue ||
      filters.minDeclarationFob ||
      filters.maxDeclarationFob ||
      filters.minQuantity ||
      filters.maxQuantity ||
      filters.minGrossWeightItem ||
      filters.maxGrossWeightItem ||
      filters.minGrossWeightTotal ||
      filters.maxGrossWeightTotal,
  );
}
