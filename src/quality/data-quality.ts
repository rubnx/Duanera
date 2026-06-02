import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  sql,
  type SQL,
} from "drizzle-orm";

import type { DbClient } from "@/db/client";
import {
  isActionableUndecodedCode,
  normalizeCodeForCoverage,
  type DataQualityStatus,
} from "@/quality/coverage";
import {
  fieldCoverageRows,
  type DataQualityFieldCoverage,
} from "@/quality/field-coverage";
import {
  labelCoverageFromRows,
  type CodeCountRow,
  type DataQualityLabelCoverage,
  type DataQualityLabelDimensionKey,
} from "@/quality/label-coverage";
import {
  codeTables,
  codeValues,
  importBatches,
  rawTradeRows,
  sourceFiles,
  tradeRecords,
} from "@/db/schema";
import type { TradeFlow, TradeRecordFilters } from "@/trade/trade-records";
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
import {
  dataQualityIssueRecordHref,
  dataQualityIssueSampleFromRow,
  dataQualityIssueSearchHref,
  dataQualityIssueStatus,
  type DataQualityIssueGroup,
  type DataQualityIssueKind,
  type DataQualityIssueSample,
  type DataQualityIssueSampleSourceRow,
} from "@/quality/data-quality-issues";
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

const codeTableKeys = {
  countries: "chile_aduana:paises",
  customsOffices: "chile_aduana:aduanas",
  ports: "chile_aduana:puertos",
  transportModes: "chile_aduana:vias_de_transporte",
} satisfies Record<DataQualityLabelDimensionKey, string>;

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

type CodeValueSetMap = Record<DataQualityLabelDimensionKey, Set<string>>;

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

async function loadCodeValueSets(db: DbClient): Promise<CodeValueSetMap> {
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

async function codeCountsForDimension(
  db: DbClient,
  tradeFlow: TradeFlow,
  expression: SQL<string>,
): Promise<CodeCountRow[]> {
  return db
    .select({
      code: expression,
      records: count(),
    })
    .from(tradeRecords)
    .where(
      and(
        marchTradeWhere(tradeFlow),
        sql`${expression} is not null`,
        sql`${expression} <> ''`,
      ),
    )
    .groupBy(expression)
    .orderBy(desc(sql<number>`count(*)`));
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

const issueSampleLimit = 8;

const issueSampleColumns = {
  id: tradeRecords.id,
  tradeFlow: tradeRecords.tradeFlow,
  periodYear: tradeRecords.periodYear,
  periodMonth: tradeRecords.periodMonth,
  declarationIdRaw: tradeRecords.declarationIdRaw,
  itemNumber: tradeRecords.itemNumber,
  hsCodeNormalized: tradeRecords.hsCodeNormalized,
  productDescriptionRaw: tradeRecords.productDescriptionRaw,
  quantity: tradeRecords.quantity,
  quantityUnitCode: tradeRecords.quantityUnitCode,
  grossWeightItem: tradeRecords.grossWeightItem,
  grossWeightTotal: tradeRecords.grossWeightTotal,
  itemCifValue: tradeRecords.itemCifValue,
  itemFobValue: tradeRecords.itemFobValue,
  declarationFobValue: tradeRecords.declarationFobValue,
  unitPriceValue: tradeRecords.unitPriceValue,
  customsOfficeCode: tradeRecords.customsOfficeCode,
  embarkPortCode: tradeRecords.embarkPortCode,
  disembarkPortCode: tradeRecords.disembarkPortCode,
  transportModeCode: tradeRecords.transportModeCode,
  sourceFileId: tradeRecords.sourceFileId,
  importBatchId: tradeRecords.importBatchId,
  originalFilename: sourceFiles.originalFilename,
  normalizedRawFilename: sourceFiles.normalizedRawFilename,
  rawRowNumber: rawTradeRows.rowNumber,
};

async function countIssue(db: DbClient, where: SQL): Promise<number> {
  const [row] = await db
    .select({
      total: count(),
    })
    .from(tradeRecords)
    .where(where);

  return toNumber(row?.total);
}

async function sampleIssue({
  db,
  evidence,
  limit = issueSampleLimit,
  where,
}: {
  db: DbClient;
  evidence: string;
  limit?: number;
  where: SQL;
}): Promise<DataQualityIssueSample[]> {
  const rows = await db
    .select(issueSampleColumns)
    .from(tradeRecords)
    .innerJoin(rawTradeRows, eq(tradeRecords.rawTradeRowId, rawTradeRows.id))
    .innerJoin(sourceFiles, eq(tradeRecords.sourceFileId, sourceFiles.id))
    .where(where)
    .orderBy(asc(tradeRecords.tradeFlow), asc(rawTradeRows.rowNumber), asc(tradeRecords.id))
    .limit(limit);

  return rows
    .map((row) => dataQualityIssueSampleFromRow(row, evidence))
    .filter((row): row is DataQualityIssueSample => Boolean(row));
}

async function issueGroupFromWhere({
  db,
  description,
  evidence,
  key,
  statusWhenPresent = "review",
  title,
  tradeRecordsHref,
  where,
}: {
  db: DbClient;
  description: string;
  evidence: string;
  key: DataQualityIssueKind;
  statusWhenPresent?: DataQualityStatus;
  title: string;
  tradeRecordsHref: string;
  where: SQL;
}): Promise<DataQualityIssueGroup> {
  const [issueCount, samples] = await Promise.all([
    countIssue(db, where),
    sampleIssue({ db, evidence, where }),
  ]);

  return {
    key,
    title,
    description,
    status: dataQualityIssueStatus(issueCount, statusWhenPresent),
    count: issueCount,
    sampleLimit: issueSampleLimit,
    tradeRecordsHref,
    samples,
  };
}

type UndecodedIssueConfig = {
  codeSet: Set<string>;
  description: string;
  key: DataQualityIssueKind;
  sampleEvidence: string;
  statusWhenPresent?: DataQualityStatus;
  title: string;
  flows: Array<{
    tradeFlow: TradeFlow;
    expression: SQL<string>;
    ignoredSourceCodes?: Set<string>;
    whereExpression: SQL<unknown>;
    searchFilter: (code: string) => TradeRecordFilters;
  }>;
};

async function undecodedIssueGroup(
  db: DbClient,
  config: UndecodedIssueConfig,
): Promise<DataQualityIssueGroup> {
  const flowResults = await Promise.all(
    config.flows.map(async (flow) => {
      const rows = await codeCountsForDimension(db, flow.tradeFlow, flow.expression);
      const undecodedRows = rows.filter((row) => {
        return isActionableUndecodedCode({
          code: row.code,
          codeSet: config.codeSet,
          ignoredSourceCodes: flow.ignoredSourceCodes,
        });
      });

      return {
        ...flow,
        rows: undecodedRows,
        count: undecodedRows.reduce((total, row) => total + toNumber(row.records), 0),
      };
    }),
  );

  const samples: DataQualityIssueSample[] = [];
  for (const result of flowResults) {
    if (samples.length >= issueSampleLimit) {
      break;
    }

    const rawCodes = result.rows
      .map((row) => row.code)
      .filter((code): code is string => Boolean(code));

    if (rawCodes.length === 0) {
      continue;
    }

    const remainingLimit = issueSampleLimit - samples.length;
    const flowSamples = await sampleIssue({
      db,
      evidence: config.sampleEvidence,
      limit: remainingLimit,
      where: and(
        marchTradeWhere(result.tradeFlow),
        inArray(result.whereExpression, rawCodes.slice(0, 200)),
      ) ?? sql`false`,
    });
    samples.push(...flowSamples);
  }

  const firstCode = flowResults.flatMap((result) =>
    result.rows.map((row) => ({
      code: normalizeCodeForCoverage(row.code),
      tradeFlow: result.tradeFlow,
      searchFilter: result.searchFilter,
    })),
  )[0];
  const tradeRecordsHref = firstCode?.code
    ? dataQualityIssueSearchHref(firstCode.searchFilter(firstCode.code))
    : dataQualityIssueSearchHref({
        periodFrom: reportPeriod.label,
        periodTo: reportPeriod.label,
        limit: 25,
      });

  const issueCount = flowResults.reduce((total, result) => total + result.count, 0);

  return {
    key: config.key,
    title: config.title,
    description: config.description,
    status: dataQualityIssueStatus(issueCount, config.statusWhenPresent ?? "review"),
    count: issueCount,
    sampleLimit: issueSampleLimit,
    tradeRecordsHref,
    samples,
  };
}

async function loadIssueGroups(db: DbClient): Promise<DataQualityIssueGroup[]> {
  const codeSets = await loadCodeValueSets(db);
  const marchFilters = {
    periodFrom: reportPeriod.label,
    periodTo: reportPeriod.label,
    limit: 25,
  } satisfies TradeRecordFilters;

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

  return Promise.all([
    issueGroupFromWhere({
      db,
      key: "missing_import_gross_weight_item",
      title: "Importaciones sin peso bruto item",
      description:
        "Casos donde el item importado no trae peso bruto item normalizado. Úsalo como alerta de mapeo/cobertura, no como prueba de que el peso no exista en la fuente.",
      evidence: "Peso bruto item vacío en importación; revisar fuente y peso bruto total antes de comparar.",
      statusWhenPresent: "warning",
      tradeRecordsHref: dataQualityIssueSearchHref({
        ...marchFilters,
        tradeFlow: "import",
      }),
      where: and(
        marchTradeWhere("import"),
        sql`${tradeRecords.grossWeightItem} is null`,
      ) ?? sql`false`,
    }),
    undecodedIssueGroup(db, {
      codeSet: codeSets.customsOffices,
      key: "undecoded_customs_office",
      title: "Aduanas sin etiqueta decodificada",
      description:
        "Registros con código de aduana presente pero sin match en la tabla de códigos cargada.",
      sampleEvidence: "Código de aduana presente sin etiqueta decodificada en tablas Aduana.",
      flows: [
        {
          tradeFlow: "import",
          expression: sql<string>`${tradeRecords.customsOfficeCode}`,
          whereExpression: sql`${tradeRecords.customsOfficeCode}`,
          searchFilter: (code) => ({
            ...marchFilters,
            tradeFlow: "import",
            customsOfficeCode: code,
          }),
        },
        {
          tradeFlow: "export",
          expression: sql<string>`${tradeRecords.customsOfficeCode}`,
          whereExpression: sql`${tradeRecords.customsOfficeCode}`,
          searchFilter: (code) => ({
            ...marchFilters,
            tradeFlow: "export",
            customsOfficeCode: code,
          }),
        },
      ],
    }),
    undecodedIssueGroup(db, {
      codeSet: codeSets.ports,
      key: "undecoded_port",
      title: "Puertos relevantes sin etiqueta decodificada",
      description:
        "Importaciones revisan puerto de desembarque; exportaciones revisan puerto de embarque.",
      sampleEvidence: "Código de puerto relevante presente sin etiqueta decodificada en tablas Aduana.",
      flows: [
        {
          tradeFlow: "import",
          expression: sql<string>`${tradeRecords.disembarkPortCode}`,
          whereExpression: sql`${tradeRecords.disembarkPortCode}`,
          searchFilter: (code) => ({
            ...marchFilters,
            tradeFlow: "import",
            portCode: code,
          }),
        },
        {
          tradeFlow: "export",
          expression: sql<string>`${tradeRecords.embarkPortCode}`,
          ignoredSourceCodes: dusExportSpecialLogisticsCodes,
          whereExpression: sql`${tradeRecords.embarkPortCode}`,
          searchFilter: (code) => ({
            ...marchFilters,
            tradeFlow: "export",
            portCode: code,
          }),
        },
      ],
    }),
    undecodedIssueGroup(db, {
      codeSet: codeSets.transportModes,
      key: "undecoded_transport_mode",
      title: "Vías de transporte sin etiqueta decodificada",
      description:
        "Registros con vía de transporte presente pero sin match en la tabla de códigos cargada.",
      sampleEvidence: "Código de vía de transporte presente sin etiqueta decodificada.",
      flows: [
        {
          tradeFlow: "import",
          expression: sql<string>`${tradeRecords.transportModeCode}`,
          whereExpression: sql`${tradeRecords.transportModeCode}`,
          searchFilter: (code) => ({
            ...marchFilters,
            tradeFlow: "import",
            transportModeCode: code,
          }),
        },
        {
          tradeFlow: "export",
          expression: sql<string>`${tradeRecords.transportModeCode}`,
          ignoredSourceCodes: dusExportSpecialLogisticsCodes,
          whereExpression: sql`${tradeRecords.transportModeCode}`,
          searchFilter: (code) => ({
            ...marchFilters,
            tradeFlow: "export",
            transportModeCode: code,
          }),
        },
      ],
    }),
    issueGroupFromWhere({
      db,
      key: "missing_or_zero_item_value",
      title: "Valor item vacío o cero",
      description:
        "Importaciones usan CIF item y exportaciones FOB item. No trata CIF vacío como defecto de exportación.",
      evidence: "Valor comercial principal del item vacío o cero para el flujo del registro.",
      statusWhenPresent: "warning",
      tradeRecordsHref: dataQualityIssueSearchHref(marchFilters),
      where: and(marchTradeWhere(), itemValueMissingOrZero) ?? sql`false`,
    }),
    issueGroupFromWhere({
      db,
      key: "missing_or_zero_declaration_fob",
      title: "FOB declaración vacío o cero",
      description:
        "Casos donde el FOB de declaración no está disponible o es cero. Puede afectar análisis agregados por declaración.",
      evidence: "FOB declaración vacío o cero; revisar si el valor vive en otro campo fuente.",
      statusWhenPresent: "review",
      tradeRecordsHref: dataQualityIssueSearchHref(marchFilters),
      where: and(
        marchTradeWhere(),
        sql`${tradeRecords.declarationFobValue} is null or ${tradeRecords.declarationFobValue} <= 0`,
      ) ?? sql`false`,
    }),
    issueGroupFromWhere({
      db,
      key: "quantity_unit_value_review",
      title: "Cantidad, unidad o precio unitario a revisar",
      description:
        "Casos donde cantidad/unidad/precio no son comparables con seguridad aunque exista valor comercial.",
      evidence: "Cantidad, unidad o precio unitario incompleto/inconsistente para comparación comercial.",
      statusWhenPresent: "review",
      tradeRecordsHref: dataQualityIssueSearchHref(marchFilters),
      where: and(
        marchTradeWhere(),
        sql`
          (
            (${tradeRecords.quantity} is not null and ${tradeRecords.quantityUnitCode} is null)
            or (${tradeRecords.quantity} is null and ${tradeRecords.quantityUnitCode} is not null)
            or (${tradeRecords.quantity} <= 0 and ${positiveItemValue})
            or (${tradeRecords.unitPriceValue} is null and ${tradeRecords.quantity} > 0 and ${positiveItemValue})
            or (${tradeRecords.unitPriceValue} <= 0 and ${positiveItemValue})
          )
        `,
      ) ?? sql`false`,
    }),
  ]);
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
    loadIssueGroups(db),
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
