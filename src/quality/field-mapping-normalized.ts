import {
  sql,
  type SQL,
} from "drizzle-orm";

import { tradeRecords } from "@/db/schema";
import { presentTrimmedTextCondition } from "@/quality/march-2026";

export type NormalizedFieldKey =
  | "declarationIdRaw"
  | "itemNumber"
  | "acceptanceDateRaw"
  | "acceptanceDate"
  | "importerCorrelativeId"
  | "exporterPrimaryCorrelativeId"
  | "exporterSecondaryCorrelativeId"
  | "hsCodeRaw"
  | "hsCodeNormalized"
  | "productDescriptionRaw"
  | "productAttributes"
  | "productSearchText"
  | "quantity"
  | "quantityUnitCode"
  | "grossWeightTotal"
  | "grossWeightItem"
  | "itemCifValue"
  | "itemFobValue"
  | "declarationFobValue"
  | "freightValue"
  | "insuranceValue"
  | "cifValue"
  | "unitPriceValue"
  | "currencyCodeRaw"
  | "originCountryCode"
  | "acquisitionCountryCode"
  | "consignmentCountryCode"
  | "destinationCountryCode"
  | "destinationCountryLabelRaw"
  | "customsOfficeCode"
  | "embarkPortCode"
  | "embarkPortLabelRaw"
  | "disembarkPortCode"
  | "disembarkPortLabelRaw"
  | "transportModeCode"
  | "cargoTypeCode";

const presentCondition = presentTrimmedTextCondition;

export function normalizedPresentCondition(field: NormalizedFieldKey): SQL {
  switch (field) {
    case "declarationIdRaw":
      return presentCondition(sql`${tradeRecords.declarationIdRaw}`);
    case "itemNumber":
      return sql`${tradeRecords.itemNumber} is not null`;
    case "acceptanceDateRaw":
      return presentCondition(sql`${tradeRecords.acceptanceDateRaw}`);
    case "acceptanceDate":
      return sql`${tradeRecords.acceptanceDate} is not null`;
    case "importerCorrelativeId":
      return presentCondition(sql`${tradeRecords.importerCorrelativeId}`);
    case "exporterPrimaryCorrelativeId":
      return presentCondition(sql`${tradeRecords.exporterPrimaryCorrelativeId}`);
    case "exporterSecondaryCorrelativeId":
      return presentCondition(sql`${tradeRecords.exporterSecondaryCorrelativeId}`);
    case "hsCodeRaw":
      return presentCondition(sql`${tradeRecords.hsCodeRaw}`);
    case "hsCodeNormalized":
      return presentCondition(sql`${tradeRecords.hsCodeNormalized}`);
    case "productDescriptionRaw":
      return presentCondition(sql`${tradeRecords.productDescriptionRaw}`);
    case "productAttributes":
      return sql`${tradeRecords.productAttributes} is not null and ${tradeRecords.productAttributes}::text <> '{}'`;
    case "productSearchText":
      return presentCondition(sql`${tradeRecords.productSearchText}`);
    case "quantity":
      return sql`${tradeRecords.quantity} is not null`;
    case "quantityUnitCode":
      return presentCondition(sql`${tradeRecords.quantityUnitCode}`);
    case "grossWeightTotal":
      return sql`${tradeRecords.grossWeightTotal} is not null`;
    case "grossWeightItem":
      return sql`${tradeRecords.grossWeightItem} is not null`;
    case "itemCifValue":
      return sql`${tradeRecords.itemCifValue} is not null`;
    case "itemFobValue":
      return sql`${tradeRecords.itemFobValue} is not null`;
    case "declarationFobValue":
      return sql`${tradeRecords.declarationFobValue} is not null`;
    case "freightValue":
      return sql`${tradeRecords.freightValue} is not null`;
    case "insuranceValue":
      return sql`${tradeRecords.insuranceValue} is not null`;
    case "cifValue":
      return sql`${tradeRecords.cifValue} is not null`;
    case "unitPriceValue":
      return sql`${tradeRecords.unitPriceValue} is not null`;
    case "currencyCodeRaw":
      return presentCondition(sql`${tradeRecords.currencyCodeRaw}`);
    case "originCountryCode":
      return presentCondition(sql`${tradeRecords.originCountryCode}`);
    case "acquisitionCountryCode":
      return presentCondition(sql`${tradeRecords.acquisitionCountryCode}`);
    case "consignmentCountryCode":
      return presentCondition(sql`${tradeRecords.consignmentCountryCode}`);
    case "destinationCountryCode":
      return presentCondition(sql`${tradeRecords.destinationCountryCode}`);
    case "destinationCountryLabelRaw":
      return presentCondition(sql`${tradeRecords.destinationCountryLabelRaw}`);
    case "customsOfficeCode":
      return presentCondition(sql`${tradeRecords.customsOfficeCode}`);
    case "embarkPortCode":
      return presentCondition(sql`${tradeRecords.embarkPortCode}`);
    case "embarkPortLabelRaw":
      return presentCondition(sql`${tradeRecords.embarkPortLabelRaw}`);
    case "disembarkPortCode":
      return presentCondition(sql`${tradeRecords.disembarkPortCode}`);
    case "disembarkPortLabelRaw":
      return presentCondition(sql`${tradeRecords.disembarkPortLabelRaw}`);
    case "transportModeCode":
      return presentCondition(sql`${tradeRecords.transportModeCode}`);
    case "cargoTypeCode":
      return presentCondition(sql`${tradeRecords.cargoTypeCode}`);
  }
}
