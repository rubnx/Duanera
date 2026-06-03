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
  tradeRecords,
} from "@/db/schema";
import { normalizeCodeForCoverage } from "@/quality/coverage";
import type {
  CodeCountRow,
  DataQualityLabelDimensionKey,
} from "@/quality/label-coverage";
import {
  march2026ReportPeriod,
  qualityTradeRecordsWhere,
  type QualityReportPeriod,
} from "@/quality/march-2026";
import type { TradeFlow } from "@/trade/trade-records";

export const codeTableKeys = {
  countries: "chile_aduana:paises",
  customsOffices: "chile_aduana:aduanas",
  ports: "chile_aduana:puertos",
  transportModes: "chile_aduana:vias_de_transporte",
} satisfies Record<DataQualityLabelDimensionKey, string>;

export type CodeValueSetMap = Record<DataQualityLabelDimensionKey, Set<string>>;

export async function loadCodeValueSets(db: DbClient): Promise<CodeValueSetMap> {
  const rows = await db
    .select({
      codeTableKey: codeTables.codeTableKey,
      codeValue: codeValues.codeValue,
    })
    .from(codeValues)
    .innerJoin(codeTables, eq(codeValues.codeTableId, codeTables.id))
    .where(inArray(codeTables.codeTableKey, Object.values(codeTableKeys)));

  const sets: CodeValueSetMap = {
    countries: new Set(),
    customsOffices: new Set(),
    ports: new Set(),
    transportModes: new Set(),
  };

  const keyByCodeTable = new Map<string, DataQualityLabelDimensionKey>(
    Object.entries(codeTableKeys).map(([key, codeTableKey]) => [
      codeTableKey,
      key as DataQualityLabelDimensionKey,
    ]),
  );

  for (const row of rows) {
    const dimensionKey = keyByCodeTable.get(row.codeTableKey);
    const normalizedCode = normalizeCodeForCoverage(row.codeValue);
    if (dimensionKey && normalizedCode) {
      sets[dimensionKey].add(normalizedCode);
    }
  }

  return sets;
}

export async function codeCountsForDimension(
  db: DbClient,
  tradeFlow: TradeFlow,
  expression: SQL<string>,
  period: QualityReportPeriod = march2026ReportPeriod,
): Promise<CodeCountRow[]> {
  return db
    .select({
      code: expression,
      records: count(),
    })
    .from(tradeRecords)
    .where(
      and(
        qualityTradeRecordsWhere(period, tradeFlow),
        sql`${expression} is not null`,
        sql`${expression} <> ''`,
      ),
    )
    .groupBy(expression)
    .orderBy(desc(sql<number>`count(*)`));
}
