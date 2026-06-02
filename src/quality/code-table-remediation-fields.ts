import {
  sql,
  type SQL,
} from "drizzle-orm";

import { tradeRecords } from "@/db/schema";

export type SupportedNormalizedCodeField =
  | "originCountryCode"
  | "acquisitionCountryCode"
  | "consignmentCountryCode"
  | "destinationCountryCode"
  | "customsOfficeCode"
  | "embarkPortCode"
  | "disembarkPortCode"
  | "transportModeCode"
  | "quantityUnitCode"
  | "currencyCodeRaw"
  | "cargoTypeCode";

export function codeTableCodeExpression(
  field: SupportedNormalizedCodeField,
): SQL<string> {
  switch (field) {
    case "originCountryCode":
      return sql<string>`${tradeRecords.originCountryCode}`;
    case "acquisitionCountryCode":
      return sql<string>`${tradeRecords.acquisitionCountryCode}`;
    case "consignmentCountryCode":
      return sql<string>`${tradeRecords.consignmentCountryCode}`;
    case "destinationCountryCode":
      return sql<string>`${tradeRecords.destinationCountryCode}`;
    case "customsOfficeCode":
      return sql<string>`${tradeRecords.customsOfficeCode}`;
    case "embarkPortCode":
      return sql<string>`${tradeRecords.embarkPortCode}`;
    case "disembarkPortCode":
      return sql<string>`${tradeRecords.disembarkPortCode}`;
    case "transportModeCode":
      return sql<string>`${tradeRecords.transportModeCode}`;
    case "quantityUnitCode":
      return sql<string>`${tradeRecords.quantityUnitCode}`;
    case "currencyCodeRaw":
      return sql<string>`${tradeRecords.currencyCodeRaw}`;
    case "cargoTypeCode":
      return sql<string>`${tradeRecords.cargoTypeCode}`;
  }
}
