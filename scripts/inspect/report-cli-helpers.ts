import { and, sql, type SQL } from "drizzle-orm";

import { tradeRecords } from "../../src/db/schema";
import type { TradeFlow } from "../../src/trade/trade-records";

export function parseTradeFlowCliValue(value: string): TradeFlow {
  if (value !== "import" && value !== "export") {
    throw new Error("--trade-flow must be import or export.");
  }

  return value;
}

export function parsePeriodCliValue(value: string, flag: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    throw new Error(`${flag} must use YYYY-MM format.`);
  }

  return value;
}

function periodTuple(value: string) {
  const [year, month] = value.split("-").map((part) => Number.parseInt(part, 10));
  return { month, year };
}

export function tradeRecordPeriodRangeWhere(
  periodFrom: string,
  periodTo: string,
): SQL {
  const from = periodTuple(periodFrom);
  const to = periodTuple(periodTo);

  return and(
    sql`(${tradeRecords.periodYear}, ${tradeRecords.periodMonth}) >= (${from.year}, ${from.month})`,
    sql`(${tradeRecords.periodYear}, ${tradeRecords.periodMonth}) <= (${to.year}, ${to.month})`,
  )!;
}
