import {
  and,
  eq,
  gt,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import type { DbClient } from "@/db/client";
import {
  importBatches,
  rawTradeRows,
  sourceFiles,
  tradeRecords,
} from "@/db/schema";
import type { TradeRecordCursor } from "@/trade/trade-record-pagination";

export const tradeRecordSummaryColumns = {
  id: tradeRecords.id,
  tradeFlow: tradeRecords.tradeFlow,
  periodYear: tradeRecords.periodYear,
  periodMonth: tradeRecords.periodMonth,
  declarationIdRaw: tradeRecords.declarationIdRaw,
  itemNumber: tradeRecords.itemNumber,
  acceptanceDate: tradeRecords.acceptanceDate,
  importerCorrelativeId: tradeRecords.importerCorrelativeId,
  exporterPrimaryCorrelativeId: tradeRecords.exporterPrimaryCorrelativeId,
  exporterSecondaryCorrelativeId: tradeRecords.exporterSecondaryCorrelativeId,
  hsCodeRaw: tradeRecords.hsCodeRaw,
  hsCodeNormalized: tradeRecords.hsCodeNormalized,
  productDescriptionRaw: tradeRecords.productDescriptionRaw,
  quantity: tradeRecords.quantity,
  quantityUnitCode: tradeRecords.quantityUnitCode,
  grossWeightTotal: tradeRecords.grossWeightTotal,
  grossWeightItem: tradeRecords.grossWeightItem,
  itemCifValue: tradeRecords.itemCifValue,
  itemFobValue: tradeRecords.itemFobValue,
  declarationFobValue: tradeRecords.declarationFobValue,
  currencyCodeRaw: tradeRecords.currencyCodeRaw,
  originCountryCode: tradeRecords.originCountryCode,
  acquisitionCountryCode: tradeRecords.acquisitionCountryCode,
  consignmentCountryCode: tradeRecords.consignmentCountryCode,
  destinationCountryCode: tradeRecords.destinationCountryCode,
  destinationCountryLabelRaw: tradeRecords.destinationCountryLabelRaw,
  customsOfficeCode: tradeRecords.customsOfficeCode,
  embarkPortCode: tradeRecords.embarkPortCode,
  embarkPortLabelRaw: tradeRecords.embarkPortLabelRaw,
  disembarkPortCode: tradeRecords.disembarkPortCode,
  disembarkPortLabelRaw: tradeRecords.disembarkPortLabelRaw,
  transportModeCode: tradeRecords.transportModeCode,
  cargoTypeCode: tradeRecords.cargoTypeCode,
  sourceFileId: tradeRecords.sourceFileId,
  sourceFilename: sql<string>`coalesce(${sourceFiles.normalizedRawFilename}, ${sourceFiles.originalFilename})`,
  importBatchId: tradeRecords.importBatchId,
  importBatchStatus: importBatches.status,
  rawTradeRowId: tradeRecords.rawTradeRowId,
  rawRowNumber: rawTradeRows.rowNumber,
  payloadRetentionMode: rawTradeRows.payloadRetentionMode,
  payloadRetainedReason: rawTradeRows.payloadRetainedReason,
  payloadReconstructable: rawTradeRows.payloadReconstructable,
  parserName: tradeRecords.parserName,
  parserVersion: tradeRecords.parserVersion,
};

export const tradeRecordDetailColumns = {
  ...tradeRecordSummaryColumns,
  productAttributes: tradeRecords.productAttributes,
  freightValue: tradeRecords.freightValue,
  insuranceValue: tradeRecords.insuranceValue,
  cifValue: tradeRecords.cifValue,
  unitPriceValue: tradeRecords.unitPriceValue,
  rawText: rawTradeRows.rawText,
  rawValues: rawTradeRows.rawValues,
  payloadStorageKind: rawTradeRows.payloadStorageKind,
  payloadHashSha256: rawTradeRows.payloadHashSha256,
  payloadPrunedAt: rawTradeRows.payloadPrunedAt,
};

export function baseTradeRecordSummaryQuery(db: DbClient) {
  return db
    .select(tradeRecordSummaryColumns)
    .from(tradeRecords)
    .innerJoin(sourceFiles, eq(tradeRecords.sourceFileId, sourceFiles.id))
    .innerJoin(importBatches, eq(tradeRecords.importBatchId, importBatches.id))
    .innerJoin(rawTradeRows, eq(tradeRecords.rawTradeRowId, rawTradeRows.id));
}

export function baseRawOrderedTradeRecordSummaryQuery(db: DbClient) {
  return db
    .select(tradeRecordSummaryColumns)
    .from(rawTradeRows)
    .innerJoin(tradeRecords, eq(tradeRecords.rawTradeRowId, rawTradeRows.id))
    .innerJoin(sourceFiles, eq(tradeRecords.sourceFileId, sourceFiles.id))
    .innerJoin(importBatches, eq(tradeRecords.importBatchId, importBatches.id));
}

export function baseTradeRecordDetailQuery(db: DbClient) {
  return db
    .select(tradeRecordDetailColumns)
    .from(tradeRecords)
    .innerJoin(sourceFiles, eq(tradeRecords.sourceFileId, sourceFiles.id))
    .innerJoin(importBatches, eq(tradeRecords.importBatchId, importBatches.id))
    .innerJoin(rawTradeRows, eq(tradeRecords.rawTradeRowId, rawTradeRows.id));
}

export function rawTradeRecordCursorWhere(cursor: TradeRecordCursor): SQL {
  return or(
    gt(rawTradeRows.rowNumber, cursor.rawRowNumber),
    and(
      eq(rawTradeRows.rowNumber, cursor.rawRowNumber),
      gt(rawTradeRows.id, cursor.rawTradeRowId),
    ),
  )!;
}
