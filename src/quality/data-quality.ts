import {
  and,
  asc,
  count,
  eq,
  sql,
  type SQL,
} from "drizzle-orm";

import type { DbClient } from "@/db/client";
import {
  fieldCoverageRows,
  type DataQualityFieldCoverage,
} from "@/quality/field-coverage";
import {
  labelCoverageFromRows,
  type DataQualityLabelCoverage,
} from "@/quality/label-coverage";
import {
  importBatches,
  rawTradeRows,
  sourceFiles,
  tradeRecords,
} from "@/db/schema";
import type { TradeFlow } from "@/trade/trade-records";
import {
  march2026RawTradeRowsWhere,
  march2026ReportPeriod,
  march2026TradeRecordsWhere,
} from "@/quality/march-2026";
import {
  addUndecodedSourceBatchCounts,
  dataQualitySourceBatchKey,
  finalizeSourceBatchRemediationRows,
  sourceBatchRemediationFromRow,
  type DataQualitySourceBatchRemediation,
  type SourceBatchCodeCountRow,
  type SourceBatchRemediationBaseRow,
} from "@/quality/source-batch-remediation";
import { type DataQualityIssueGroup } from "@/quality/data-quality-issues";
import { loadDataQualityIssueGroups } from "@/quality/data-quality-issue-groups";
import {
  flowSummariesFromRows,
  sourceCoverageRows,
  type DataQualityFlowSummary,
  type DataQualitySourceCoverage,
} from "@/quality/source-coverage";
import { countValueToNumber } from "@/db/count-values";
import {
  buildDataQualityFindings,
  type DataQualityFinding,
  type DataQualityPayloadCoverage,
} from "@/quality/data-quality-findings";
import {
  codeCountsForDimension,
  loadCodeValueSets,
} from "@/quality/code-value-sets";

const reportPeriod = march2026ReportPeriod;

export {
  coveragePercent,
  coverageStatus,
  isActionableUndecodedCode,
  normalizeCodeForCoverage,
  type DataQualityStatus,
} from "@/quality/coverage";
export { type DataQualityFieldCoverage } from "@/quality/field-coverage";
export { type DataQualityLabelCoverage } from "@/quality/label-coverage";
export {
  addUndecodedSourceBatchCounts,
  dataQualityRemediationNextStep,
  dataQualityRemediationStatus,
  dataQualityRemediationTotal,
  dataQualitySourceBatchKey,
  finalizeSourceBatchRemediationRows,
  sourceBatchRemediationFromRow,
  type DataQualitySourceBatchRemediation,
  type DataQualityRemediationIssueCounts,
  type SourceBatchCodeCountRow,
  type SourceBatchRemediationBaseRow,
} from "@/quality/source-batch-remediation";
export {
  dataQualityIssueRecordHref,
  dataQualityIssueSampleFromRow,
  dataQualityIssueSearchHref,
  dataQualityIssueStatus,
  dataQualitySourceBatchHref,
  type DataQualityIssueGroup,
  type DataQualityIssueKind,
  type DataQualityIssueSample,
  type DataQualityIssueSampleSourceRow,
} from "@/quality/data-quality-issues";
export {
  type DataQualityFlowSummary,
  type DataQualitySourceCoverage,
} from "@/quality/source-coverage";
export {
  buildDataQualityFindings,
  type DataQualityFinding,
  type DataQualityPayloadCoverage,
} from "@/quality/data-quality-findings";

export type DataQualityReport = {
  period: typeof reportPeriod;
  totals: {
    rawRows: number;
    parsedRows: number;
    failedRows: number;
    warningRows: number;
    tradeRecords: number;
    rawToTradeDelta: number;
  };
  flows: DataQualityFlowSummary[];
  sourceCoverage: DataQualitySourceCoverage[];
  fieldCoverage: DataQualityFieldCoverage[];
  labelCoverage: DataQualityLabelCoverage[];
  payloadCoverage: DataQualityPayloadCoverage[];
  issueGroups: DataQualityIssueGroup[];
  sourceBatchRemediation: DataQualitySourceBatchRemediation[];
  findings: DataQualityFinding[];
};

const toNumber = countValueToNumber;

const dusExportSpecialLogisticsCodes = new Set(["0"]);

const marchRawWhere = march2026RawTradeRowsWhere;
const marchTradeWhere = march2026TradeRecordsWhere;

function countPresent(expression: SQL<unknown>) {
  return sql<number>`count(*) filter (where ${expression} is not null and ${expression}::text <> '')`;
}

function countAnyPresent(expressions: SQL<unknown>[]) {
  const joined = sql.join(
    expressions.map(
      (expression) => sql`(${expression} is not null and ${expression}::text <> '')`,
    ),
    sql` or `,
  );

  return sql<number>`count(*) filter (where ${joined})`;
}

async function loadFlowSummaries(db: DbClient): Promise<DataQualityFlowSummary[]> {
  const [rawRows, tradeRows] = await Promise.all([
    db
      .select({
        tradeFlow: rawTradeRows.tradeFlow,
        rawRows: count(),
        parsedRows: sql<number>`count(*) filter (where ${rawTradeRows.parseStatus} = 'parsed')`,
        failedRows: sql<number>`count(*) filter (where ${rawTradeRows.parseStatus} = 'failed')`,
        warningRows: sql<number>`count(*) filter (where ${rawTradeRows.parseWarnings} is not null)`,
      })
      .from(rawTradeRows)
      .where(marchRawWhere())
      .groupBy(rawTradeRows.tradeFlow),
    db
      .select({
        tradeFlow: tradeRecords.tradeFlow,
        tradeRecords: count(),
      })
      .from(tradeRecords)
      .where(marchTradeWhere())
      .groupBy(tradeRecords.tradeFlow),
  ]);

  return flowSummariesFromRows({ rawRows, tradeRows });
}

async function loadSourceCoverage(db: DbClient): Promise<DataQualitySourceCoverage[]> {
  const [rawRows, tradeRows] = await Promise.all([
    db
      .select({
        sourceFileId: rawTradeRows.sourceFileId,
        importBatchId: rawTradeRows.importBatchId,
        tradeFlow: rawTradeRows.tradeFlow,
        originalFilename: sourceFiles.originalFilename,
        normalizedRawFilename: sourceFiles.normalizedRawFilename,
        batchStatus: importBatches.status,
        rawRows: count(),
        parsedRows: sql<number>`count(*) filter (where ${rawTradeRows.parseStatus} = 'parsed')`,
        failedRows: sql<number>`count(*) filter (where ${rawTradeRows.parseStatus} = 'failed')`,
      })
      .from(rawTradeRows)
      .innerJoin(sourceFiles, eq(rawTradeRows.sourceFileId, sourceFiles.id))
      .innerJoin(importBatches, eq(rawTradeRows.importBatchId, importBatches.id))
      .where(marchRawWhere())
      .groupBy(
        rawTradeRows.sourceFileId,
        rawTradeRows.importBatchId,
        rawTradeRows.tradeFlow,
        sourceFiles.originalFilename,
        sourceFiles.normalizedRawFilename,
        importBatches.status,
      )
      .orderBy(asc(rawTradeRows.tradeFlow), asc(sourceFiles.originalFilename)),
    db
      .select({
        sourceFileId: tradeRecords.sourceFileId,
        importBatchId: tradeRecords.importBatchId,
        tradeFlow: tradeRecords.tradeFlow,
        tradeRecords: count(),
      })
      .from(tradeRecords)
      .where(marchTradeWhere())
      .groupBy(
        tradeRecords.sourceFileId,
        tradeRecords.importBatchId,
        tradeRecords.tradeFlow,
      ),
  ]);

  return sourceCoverageRows({ rawRows, tradeRows });
}

async function loadImportFieldCoverage(db: DbClient): Promise<DataQualityFieldCoverage[]> {
  const [row] = await db
    .select({
      total: count(),
      hsCode: countPresent(sql`${tradeRecords.hsCodeNormalized}`),
      productDescription: countPresent(sql`${tradeRecords.productDescriptionRaw}`),
      itemCifValue: countPresent(sql`${tradeRecords.itemCifValue}`),
      declarationFobValue: countPresent(sql`${tradeRecords.declarationFobValue}`),
      quantity: countPresent(sql`${tradeRecords.quantity}`),
      quantityUnit: countPresent(sql`${tradeRecords.quantityUnitCode}`),
      grossWeightItem: countPresent(sql`${tradeRecords.grossWeightItem}`),
      grossWeightTotal: countPresent(sql`${tradeRecords.grossWeightTotal}`),
      unitPrice: countPresent(sql`${tradeRecords.unitPriceValue}`),
      importerCorrelative: countPresent(sql`${tradeRecords.importerCorrelativeId}`),
      originCountry: countPresent(sql`${tradeRecords.originCountryCode}`),
      customsOffice: countPresent(sql`${tradeRecords.customsOfficeCode}`),
      disembarkPort: countPresent(sql`${tradeRecords.disembarkPortCode}`),
      transportMode: countPresent(sql`${tradeRecords.transportModeCode}`),
    })
    .from(tradeRecords)
    .where(marchTradeWhere("import"));

  const total = toNumber(row?.total);

  return fieldCoverageRows({
    tradeFlow: "import",
    total,
    fields: [
      {
        key: "hsCode",
        label: "Código HS normalizado",
        covered: row?.hsCode,
        caveat: "Campo central para búsquedas por producto.",
      },
      {
        key: "productDescription",
        label: "Descripción del producto",
        covered: row?.productDescription,
        caveat: "Texto fuente, útil para búsqueda comercial pero no clasificación oficial adicional.",
      },
      {
        key: "itemCifValue",
        label: "Valor CIF item",
        covered: row?.itemCifValue,
        caveat: "Métrica principal de valor para importaciones.",
      },
      {
        key: "declarationFobValue",
        label: "FOB declaración",
        covered: row?.declarationFobValue,
        caveat: "Valor de declaración; puede repetirse entre items de una misma declaración.",
      },
      {
        key: "quantity",
        label: "Cantidad",
        covered: row?.quantity,
        caveat: "Comparable solo cuando la unidad también coincide.",
      },
      {
        key: "quantityUnit",
        label: "Unidad de cantidad",
        covered: row?.quantityUnit,
        caveat: "Necesaria para comparar cantidades de forma segura.",
      },
      {
        key: "grossWeightItem",
        label: "Peso bruto item",
        covered: row?.grossWeightItem,
        caveat: "Peso asociado al item; revisar contra peso total si se agrupa.",
      },
      {
        key: "grossWeightTotal",
        label: "Peso bruto total",
        covered: row?.grossWeightTotal,
        caveat: "Puede representar el total de declaración o embarque según fuente.",
      },
      {
        key: "unitPrice",
        label: "Precio unitario",
        covered: row?.unitPrice,
        caveat: "Útil si cantidad y unidad son consistentes.",
      },
      {
        key: "importerCorrelative",
        label: "Correlativo importador Aduana",
        covered: row?.importerCorrelative,
        caveat: "Correlativo anónimo; no es RUT ni identidad legal verificada.",
      },
      {
        key: "originCountry",
        label: "País de origen",
        covered: row?.originCountry,
        caveat: "Dimensión principal de origen para importaciones.",
      },
      {
        key: "customsOffice",
        label: "Aduana",
        covered: row?.customsOffice,
        caveat: "Código fuente decodificado con tablas de Aduana cuando existe match.",
      },
      {
        key: "disembarkPort",
        label: "Puerto desembarque",
        covered: row?.disembarkPort,
        caveat: "Puerto relevante para importaciones.",
      },
      {
        key: "transportMode",
        label: "Vía transporte",
        covered: row?.transportMode,
        caveat: "Código fuente decodificado con tablas de Aduana cuando existe match.",
      },
    ],
  });
}

async function loadExportFieldCoverage(db: DbClient): Promise<DataQualityFieldCoverage[]> {
  const [row] = await db
    .select({
      total: count(),
      hsCode: countPresent(sql`${tradeRecords.hsCodeNormalized}`),
      productDescription: countPresent(sql`${tradeRecords.productDescriptionRaw}`),
      itemFobValue: countPresent(sql`${tradeRecords.itemFobValue}`),
      declarationFobValue: countPresent(sql`${tradeRecords.declarationFobValue}`),
      quantity: countPresent(sql`${tradeRecords.quantity}`),
      quantityUnit: countPresent(sql`${tradeRecords.quantityUnitCode}`),
      grossWeightItem: countPresent(sql`${tradeRecords.grossWeightItem}`),
      grossWeightTotal: countPresent(sql`${tradeRecords.grossWeightTotal}`),
      unitPrice: countPresent(sql`${tradeRecords.unitPriceValue}`),
      exporterCorrelative: countAnyPresent([
        sql`${tradeRecords.exporterPrimaryCorrelativeId}`,
        sql`${tradeRecords.exporterSecondaryCorrelativeId}`,
      ]),
      destinationCountry: countPresent(sql`${tradeRecords.destinationCountryCode}`),
      customsOffice: countPresent(sql`${tradeRecords.customsOfficeCode}`),
      embarkPort: countPresent(sql`${tradeRecords.embarkPortCode}`),
      transportMode: countPresent(sql`${tradeRecords.transportModeCode}`),
    })
    .from(tradeRecords)
    .where(marchTradeWhere("export"));

  const total = toNumber(row?.total);

  return fieldCoverageRows({
    tradeFlow: "export",
    total,
    fields: [
      {
        key: "hsCode",
        label: "Código HS normalizado",
        covered: row?.hsCode,
        caveat: "Campo central para búsquedas por producto.",
      },
      {
        key: "productDescription",
        label: "Descripción del producto",
        covered: row?.productDescription,
        caveat: "Texto fuente, útil para búsqueda comercial pero no clasificación oficial adicional.",
      },
      {
        key: "itemFobValue",
        label: "Valor FOB item",
        covered: row?.itemFobValue,
        caveat: "Métrica principal de valor para exportaciones.",
      },
      {
        key: "declarationFobValue",
        label: "FOB declaración",
        covered: row?.declarationFobValue,
        caveat: "Valor de declaración; puede repetirse entre items de una misma declaración.",
      },
      {
        key: "quantity",
        label: "Cantidad",
        covered: row?.quantity,
        caveat: "Comparable solo cuando la unidad también coincide.",
      },
      {
        key: "quantityUnit",
        label: "Unidad de cantidad",
        covered: row?.quantityUnit,
        caveat: "Necesaria para comparar cantidades de forma segura.",
      },
      {
        key: "grossWeightItem",
        label: "Peso bruto item",
        covered: row?.grossWeightItem,
        caveat: "Peso asociado al item; revisar contra peso total si se agrupa.",
      },
      {
        key: "grossWeightTotal",
        label: "Peso bruto total",
        covered: row?.grossWeightTotal,
        caveat: "Puede representar el total de declaración o embarque según fuente.",
      },
      {
        key: "unitPrice",
        label: "Precio unitario",
        covered: row?.unitPrice,
        caveat: "Útil si cantidad y unidad son consistentes.",
      },
      {
        key: "exporterCorrelative",
        label: "Correlativo exportador Aduana",
        covered: row?.exporterCorrelative,
        caveat: "Correlativo anónimo; no es RUT ni identidad legal verificada.",
      },
      {
        key: "destinationCountry",
        label: "País destino",
        covered: row?.destinationCountry,
        caveat: "Dimensión principal de destino para exportaciones.",
      },
      {
        key: "customsOffice",
        label: "Aduana",
        covered: row?.customsOffice,
        caveat: "Código fuente decodificado con tablas de Aduana cuando existe match.",
      },
      {
        key: "embarkPort",
        label: "Puerto embarque",
        covered: row?.embarkPort,
        caveat: "Puerto relevante para exportaciones.",
      },
      {
        key: "transportMode",
        label: "Vía transporte",
        covered: row?.transportMode,
        caveat: "Código fuente decodificado con tablas de Aduana cuando existe match.",
      },
    ],
  });
}

async function loadFieldCoverage(db: DbClient): Promise<DataQualityFieldCoverage[]> {
  const [imports, exports] = await Promise.all([
    loadImportFieldCoverage(db),
    loadExportFieldCoverage(db),
  ]);

  return [...imports, ...exports];
}

async function loadLabelCoverage(db: DbClient): Promise<DataQualityLabelCoverage[]> {
  const codeSets = await loadCodeValueSets(db);
  const [
    importCountries,
    exportCountries,
    importCustoms,
    exportCustoms,
    importPorts,
    exportPorts,
    importTransport,
    exportTransport,
  ] = await Promise.all([
    codeCountsForDimension(db, "import", sql<string>`${tradeRecords.originCountryCode}`),
    codeCountsForDimension(db, "export", sql<string>`${tradeRecords.destinationCountryCode}`),
    codeCountsForDimension(db, "import", sql<string>`${tradeRecords.customsOfficeCode}`),
    codeCountsForDimension(db, "export", sql<string>`${tradeRecords.customsOfficeCode}`),
    codeCountsForDimension(db, "import", sql<string>`${tradeRecords.disembarkPortCode}`),
    codeCountsForDimension(db, "export", sql<string>`${tradeRecords.embarkPortCode}`),
    codeCountsForDimension(db, "import", sql<string>`${tradeRecords.transportModeCode}`),
    codeCountsForDimension(db, "export", sql<string>`${tradeRecords.transportModeCode}`),
  ]);

  return [
    labelCoverageFromRows({
      caveat: "Origen para importaciones.",
      codeSet: codeSets.countries,
      key: "countries",
      label: "País origen",
      rows: importCountries,
      tradeFlow: "import",
    }),
    labelCoverageFromRows({
      caveat: "Destino para exportaciones.",
      codeSet: codeSets.countries,
      key: "countries",
      label: "País destino",
      rows: exportCountries,
      tradeFlow: "export",
    }),
    labelCoverageFromRows({
      caveat: "Aduana registrada en el archivo fuente.",
      codeSet: codeSets.customsOffices,
      key: "customsOffices",
      label: "Aduana",
      rows: importCustoms,
      tradeFlow: "import",
    }),
    labelCoverageFromRows({
      caveat: "Aduana registrada en el archivo fuente.",
      codeSet: codeSets.customsOffices,
      key: "customsOffices",
      label: "Aduana",
      rows: exportCustoms,
      tradeFlow: "export",
    }),
    labelCoverageFromRows({
      caveat: "Puerto de desembarque para importaciones.",
      codeSet: codeSets.ports,
      key: "ports",
      label: "Puerto desembarque",
      rows: importPorts,
      tradeFlow: "import",
    }),
    labelCoverageFromRows({
      caveat: "Puerto de embarque para exportaciones.",
      codeSet: codeSets.ports,
      key: "ports",
      label: "Puerto embarque",
      rows: exportPorts,
      tradeFlow: "export",
      ignoredSourceCodes: dusExportSpecialLogisticsCodes,
    }),
    labelCoverageFromRows({
      caveat: "Vía de transporte registrada en el archivo fuente.",
      codeSet: codeSets.transportModes,
      key: "transportModes",
      label: "Vía transporte",
      rows: importTransport,
      tradeFlow: "import",
    }),
    labelCoverageFromRows({
      caveat: "Vía de transporte registrada en el archivo fuente.",
      codeSet: codeSets.transportModes,
      key: "transportModes",
      label: "Vía transporte",
      rows: exportTransport,
      tradeFlow: "export",
      ignoredSourceCodes: dusExportSpecialLogisticsCodes,
    }),
  ];
}

async function loadPayloadCoverage(db: DbClient): Promise<DataQualityPayloadCoverage[]> {
  const rows = await db
    .select({
      tradeFlow: rawTradeRows.tradeFlow,
      retentionMode: rawTradeRows.payloadRetentionMode,
      storageKind: rawTradeRows.payloadStorageKind,
      reconstructable: rawTradeRows.payloadReconstructable,
      rows: count(),
    })
    .from(rawTradeRows)
    .where(marchRawWhere())
    .groupBy(
      rawTradeRows.tradeFlow,
      rawTradeRows.payloadRetentionMode,
      rawTradeRows.payloadStorageKind,
      rawTradeRows.payloadReconstructable,
    )
    .orderBy(
      asc(rawTradeRows.tradeFlow),
      asc(rawTradeRows.payloadRetentionMode),
      asc(rawTradeRows.payloadStorageKind),
    );

  return rows.map((row) => ({
    tradeFlow:
      row.tradeFlow === "import" || row.tradeFlow === "export" ? row.tradeFlow : "unknown",
    retentionMode: row.retentionMode,
    storageKind: row.storageKind,
    reconstructable: Boolean(row.reconstructable),
    rows: toNumber(row.rows),
  }));
}

function sourceBatchRemediationWhere(sourceFileId?: string): SQL {
  const conditions = [marchTradeWhere()];

  if (sourceFileId) {
    conditions.push(eq(tradeRecords.sourceFileId, sourceFileId));
  }

  return and(...conditions) ?? sql`true`;
}

async function loadSourceBatchRemediationBaseRows({
  db,
  sourceFileId,
}: {
  db: DbClient;
  sourceFileId?: string;
}): Promise<SourceBatchRemediationBaseRow[]> {
  const where = sourceBatchRemediationWhere(sourceFileId);
  const itemValueMissingOrZero = sql`
    (
      (${tradeRecords.tradeFlow} = 'import' and (${tradeRecords.itemCifValue} is null or ${tradeRecords.itemCifValue} <= 0))
      or (${tradeRecords.tradeFlow} = 'export' and (${tradeRecords.itemFobValue} is null or ${tradeRecords.itemFobValue} <= 0))
    )
  `;
  const positiveItemValue = sql`
    (
      (${tradeRecords.tradeFlow} = 'import' and ${tradeRecords.itemCifValue} > 0)
      or (${tradeRecords.tradeFlow} = 'export' and ${tradeRecords.itemFobValue} > 0)
    )
  `;

  return db
    .select({
      sourceFileId: tradeRecords.sourceFileId,
      importBatchId: tradeRecords.importBatchId,
      tradeFlow: tradeRecords.tradeFlow,
      originalFilename: sourceFiles.originalFilename,
      normalizedRawFilename: sourceFiles.normalizedRawFilename,
      parserName: importBatches.parserName,
      parserVersion: importBatches.parserVersion,
      batchStatus: importBatches.status,
      tradeRecords: count(),
      missingImportGrossWeightItem: sql<number>`count(*) filter (where ${tradeRecords.tradeFlow} = 'import' and ${tradeRecords.grossWeightItem} is null)`,
      missingOrZeroItemValue: sql<number>`count(*) filter (where ${itemValueMissingOrZero})`,
      missingOrZeroDeclarationFob: sql<number>`count(*) filter (where ${tradeRecords.declarationFobValue} is null or ${tradeRecords.declarationFobValue} <= 0)`,
      quantityUnitValueReview: sql<number>`count(*) filter (where (
        (${tradeRecords.quantity} is not null and ${tradeRecords.quantityUnitCode} is null)
        or (${tradeRecords.quantity} is null and ${tradeRecords.quantityUnitCode} is not null)
        or (${tradeRecords.quantity} <= 0 and ${positiveItemValue})
        or (${tradeRecords.unitPriceValue} is null and ${tradeRecords.quantity} > 0 and ${positiveItemValue})
        or (${tradeRecords.unitPriceValue} <= 0 and ${positiveItemValue})
      ))`,
    })
    .from(tradeRecords)
    .innerJoin(sourceFiles, eq(tradeRecords.sourceFileId, sourceFiles.id))
    .innerJoin(importBatches, eq(tradeRecords.importBatchId, importBatches.id))
    .where(where)
    .groupBy(
      tradeRecords.sourceFileId,
      tradeRecords.importBatchId,
      tradeRecords.tradeFlow,
      sourceFiles.originalFilename,
      sourceFiles.normalizedRawFilename,
      importBatches.parserName,
      importBatches.parserVersion,
      importBatches.status,
    );
}

async function sourceBatchCodeCounts({
  db,
  expression,
  sourceFileId,
  tradeFlow,
}: {
  db: DbClient;
  expression: SQL<string>;
  sourceFileId?: string;
  tradeFlow: TradeFlow;
}): Promise<SourceBatchCodeCountRow[]> {
  const conditions = [
    marchTradeWhere(tradeFlow),
    sql`${expression} is not null`,
    sql`${expression} <> ''`,
  ];

  if (sourceFileId) {
    conditions.push(eq(tradeRecords.sourceFileId, sourceFileId));
  }

  return db
    .select({
      sourceFileId: tradeRecords.sourceFileId,
      importBatchId: tradeRecords.importBatchId,
      tradeFlow: tradeRecords.tradeFlow,
      code: expression,
      records: count(),
    })
    .from(tradeRecords)
    .where(and(...conditions))
    .groupBy(
      tradeRecords.sourceFileId,
      tradeRecords.importBatchId,
      tradeRecords.tradeFlow,
      expression,
    );
}

export async function getMarch2026SourceBatchRemediation(
  db: DbClient,
  options: {
    limit?: number;
    sourceFileId?: string;
  } = {},
): Promise<DataQualitySourceBatchRemediation[]> {
  const [baseRows, codeSets] = await Promise.all([
    loadSourceBatchRemediationBaseRows({
      db,
      sourceFileId: options.sourceFileId,
    }),
    loadCodeValueSets(db),
  ]);

  const remediationRows = baseRows
    .map(sourceBatchRemediationFromRow)
    .filter((row): row is DataQualitySourceBatchRemediation => Boolean(row));
  const remediationByKey = new Map(
    remediationRows.map((row) => [dataQualitySourceBatchKey(row), row]),
  );

  const [
    importCustoms,
    exportCustoms,
    importPorts,
    exportPorts,
    importTransport,
    exportTransport,
  ] = await Promise.all([
    sourceBatchCodeCounts({
      db,
      expression: sql<string>`${tradeRecords.customsOfficeCode}`,
      sourceFileId: options.sourceFileId,
      tradeFlow: "import",
    }),
    sourceBatchCodeCounts({
      db,
      expression: sql<string>`${tradeRecords.customsOfficeCode}`,
      sourceFileId: options.sourceFileId,
      tradeFlow: "export",
    }),
    sourceBatchCodeCounts({
      db,
      expression: sql<string>`${tradeRecords.disembarkPortCode}`,
      sourceFileId: options.sourceFileId,
      tradeFlow: "import",
    }),
    sourceBatchCodeCounts({
      db,
      expression: sql<string>`${tradeRecords.embarkPortCode}`,
      sourceFileId: options.sourceFileId,
      tradeFlow: "export",
    }),
    sourceBatchCodeCounts({
      db,
      expression: sql<string>`${tradeRecords.transportModeCode}`,
      sourceFileId: options.sourceFileId,
      tradeFlow: "import",
    }),
    sourceBatchCodeCounts({
      db,
      expression: sql<string>`${tradeRecords.transportModeCode}`,
      sourceFileId: options.sourceFileId,
      tradeFlow: "export",
    }),
  ]);

  addUndecodedSourceBatchCounts({
    codeSet: codeSets.customsOffices,
    field: "undecodedCustomsOffice",
    remediationByKey,
    rows: [...importCustoms, ...exportCustoms],
  });
  addUndecodedSourceBatchCounts({
    codeSet: codeSets.ports,
    field: "undecodedPort",
    remediationByKey,
    rows: importPorts,
  });
  addUndecodedSourceBatchCounts({
    codeSet: codeSets.ports,
    field: "undecodedPort",
    ignoredSourceCodes: dusExportSpecialLogisticsCodes,
    remediationByKey,
    rows: exportPorts,
  });
  addUndecodedSourceBatchCounts({
    codeSet: codeSets.transportModes,
    field: "undecodedTransportMode",
    remediationByKey,
    rows: importTransport,
  });
  addUndecodedSourceBatchCounts({
    codeSet: codeSets.transportModes,
    field: "undecodedTransportMode",
    ignoredSourceCodes: dusExportSpecialLogisticsCodes,
    remediationByKey,
    rows: exportTransport,
  });

  return finalizeSourceBatchRemediationRows(remediationRows).slice(0, options.limit ?? 8);
}

export async function getMarch2026DataQualityReport(
  db: DbClient,
): Promise<DataQualityReport> {
  const [flows, sourceCoverage, fieldCoverage, labelCoverage, payloadCoverage] =
    await Promise.all([
      loadFlowSummaries(db),
      loadSourceCoverage(db),
      loadFieldCoverage(db),
      loadLabelCoverage(db),
      loadPayloadCoverage(db),
    ]);
  const [issueGroups, sourceBatchRemediation] = await Promise.all([
    loadDataQualityIssueGroups(db),
    getMarch2026SourceBatchRemediation(db),
  ]);

  const totals = flows.reduce(
    (summary, flow) => ({
      rawRows: summary.rawRows + flow.rawRows,
      parsedRows: summary.parsedRows + flow.parsedRows,
      failedRows: summary.failedRows + flow.failedRows,
      warningRows: summary.warningRows + flow.warningRows,
      tradeRecords: summary.tradeRecords + flow.tradeRecords,
      rawToTradeDelta: summary.rawToTradeDelta + flow.rawToTradeDelta,
    }),
    {
      rawRows: 0,
      parsedRows: 0,
      failedRows: 0,
      warningRows: 0,
      tradeRecords: 0,
      rawToTradeDelta: 0,
    },
  );

  return {
    period: reportPeriod,
    totals,
    flows,
    sourceCoverage,
    fieldCoverage,
    labelCoverage,
    payloadCoverage,
    issueGroups,
    sourceBatchRemediation,
    findings: buildDataQualityFindings({
      fieldCoverage,
      flows,
      labelCoverage,
      payloadCoverage,
    }),
  };
}
