import {
  and,
  eq,
  gte,
  inArray,
  like,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import {
  sourceFiles,
  tradeRecordLogisticsPartyLinks,
  tradeRecords,
} from "@/db/schema";
import { publicSearchTerms } from "@/text/public-text";
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

export function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

export const internalSourceCategories = [
  "test",
  "internal",
  "qa",
  "smoke",
  "fixture",
] as const;

export type ProductFacingTradeRecordWhereOptions = {
  referenceDate?: Date;
};

export type TradeRecordWhereOptions = ProductFacingTradeRecordWhereOptions & {
  productFacing?: boolean;
};

export const productFacingCoverageStart = { year: 2021, month: 1 } as const;

function periodLimitFromDate(referenceDate: Date) {
  return {
    year: referenceDate.getUTCFullYear(),
    month: referenceDate.getUTCMonth() + 1,
  };
}

export function productFacingTradeRecordWhere(
  options: ProductFacingTradeRecordWhereOptions = {},
): SQL {
  const periodLimit = periodLimitFromDate(options.referenceDate ?? new Date());

  return and(
    sql`exists (
      select 1
      from ${sourceFiles}
      where ${sourceFiles.id} = ${tradeRecords.sourceFileId}
        and coalesce(lower(${sourceFiles.sourceCategory}), '') not in ('test', 'internal', 'qa', 'smoke', 'fixture')
    )`,
    sql`${tradeRecordPeriodTupleExpression()} >= (${productFacingCoverageStart.year}, ${productFacingCoverageStart.month})`,
    sql`${tradeRecordPeriodTupleExpression()} <= (${periodLimit.year}, ${periodLimit.month})`,
  )!;
}

export function buildTradeRecordWhere(
  filters: TradeRecordFilters,
  options: TradeRecordWhereOptions = {},
): SQL | undefined {
  const conditions: SQL[] = [];

  if (options.productFacing) {
    conditions.push(productFacingTradeRecordWhere(options));
  }

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

  const productSearchTerms = publicSearchTerms(filters.productQuery);
  for (const term of productSearchTerms) {
    conditions.push(
      sql`${tradeRecords.productSearchText} ilike ${`%${escapeLikePattern(term)}%`} escape '\\'`,
    );
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

  const originCountryCodes = filters.originCountryCodes?.length
    ? filters.originCountryCodes
    : filters.originCountryCode
      ? [filters.originCountryCode]
      : [];
  if (originCountryCodes.length === 1) {
    conditions.push(eq(tradeRecords.originCountryCode, originCountryCodes[0]!));
  } else if (originCountryCodes.length > 1) {
    conditions.push(inArray(tradeRecords.originCountryCode, originCountryCodes));
  }

  const destinationCountryCodes = filters.destinationCountryCodes?.length
    ? filters.destinationCountryCodes
    : filters.destinationCountryCode
      ? [filters.destinationCountryCode]
      : [];
  if (destinationCountryCodes.length === 1) {
    conditions.push(eq(tradeRecords.destinationCountryCode, destinationCountryCodes[0]!));
  } else if (destinationCountryCodes.length > 1) {
    conditions.push(inArray(tradeRecords.destinationCountryCode, destinationCountryCodes));
  }

  if (filters.customsOfficeCode) {
    conditions.push(eq(tradeRecords.customsOfficeCode, filters.customsOfficeCode));
  }

  if (filters.transportModeCode) {
    conditions.push(eq(tradeRecords.transportModeCode, filters.transportModeCode));
  }

  if (filters.embarkPortCode) {
    conditions.push(eq(tradeRecords.embarkPortCode, filters.embarkPortCode));
  }

  if (filters.disembarkPortCode) {
    conditions.push(eq(tradeRecords.disembarkPortCode, filters.disembarkPortCode));
  }

  if (filters.cargoTypeCode) {
    conditions.push(eq(tradeRecords.cargoTypeCode, filters.cargoTypeCode));
  }

  if (filters.logisticsPartyId || filters.logisticsRole) {
    const partyCondition = filters.logisticsPartyId
      ? sql`and ${tradeRecordLogisticsPartyLinks.partyId} = ${filters.logisticsPartyId}::uuid`
      : sql``;
    const roleCondition = filters.logisticsRole
      ? sql`and ${tradeRecordLogisticsPartyLinks.role} = ${filters.logisticsRole}`
      : sql``;

    conditions.push(sql`exists (
      select 1
      from ${tradeRecordLogisticsPartyLinks}
      where ${tradeRecordLogisticsPartyLinks.tradeRecordId} = ${tradeRecords.id}
        ${partyCondition}
        ${roleCondition}
    )`);
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
