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
  codeTables,
  codeValues,
  importBatches,
  rawTradeRows,
  sourceFiles,
  tradeRecords,
} from "@/db/schema";
import { sourceDisplayFilename, sourceTradeRecordsHref } from "@/sources/source-provenance";
import {
  buildTradeRecordSearchHref,
  filtersToTradeRecordSearchParams,
} from "@/trade/trade-record-links";
import type { TradeFlow, TradeRecordFilters } from "@/trade/trade-records";

const reportPeriod = {
  year: 2026,
  month: 3,
  label: "2026-03",
};

const codeTableKeys = {
  countries: "chile_aduana:paises",
  customsOffices: "chile_aduana:aduanas",
  ports: "chile_aduana:puertos",
  transportModes: "chile_aduana:vias_de_transporte",
} as const;

type LabelDimensionKey = keyof typeof codeTableKeys;

export type DataQualityStatus = "ok" | "review" | "warning";

export type DataQualityFlowSummary = {
  tradeFlow: TradeFlow;
  rawRows: number;
  parsedRows: number;
  failedRows: number;
  warningRows: number;
  tradeRecords: number;
  rawToTradeDelta: number;
  status: DataQualityStatus;
};

export type DataQualitySourceCoverage = {
  sourceFileId: string;
  importBatchId: string;
  tradeFlow: TradeFlow;
  filename: string;
  batchStatus: string;
  rawRows: number;
  parsedRows: number;
  failedRows: number;
  tradeRecords: number;
  sourceHref: string;
  tradeRecordsHref: string;
};

export type DataQualityFieldCoverage = {
  tradeFlow: TradeFlow;
  key: string;
  label: string;
  covered: number;
  total: number;
  percent: number;
  status: DataQualityStatus;
  caveat: string;
};

export type DataQualityLabelCoverage = {
  tradeFlow: TradeFlow;
  key: LabelDimensionKey;
  label: string;
  distinctCodes: number;
  decodedCodes: number;
  undecodedCodes: string[];
  recordsWithCode: number;
  recordsWithDecodedCode: number;
  percent: number;
  status: DataQualityStatus;
  caveat: string;
};

export type DataQualityPayloadCoverage = {
  tradeFlow: TradeFlow | "unknown";
  retentionMode: string;
  storageKind: string;
  reconstructable: boolean;
  rows: number;
};

export type DataQualityFinding = {
  status: DataQualityStatus;
  title: string;
  detail: string;
};

export type DataQualityIssueKind =
  | "missing_import_gross_weight_item"
  | "undecoded_customs_office"
  | "undecoded_port"
  | "undecoded_transport_mode"
  | "missing_or_zero_item_value"
  | "missing_or_zero_declaration_fob"
  | "quantity_unit_value_review";

export type DataQualityIssueSample = {
  id: string;
  tradeFlow: TradeFlow;
  periodLabel: string;
  declarationIdRaw: string | null;
  itemNumber: number | null;
  hsCodeNormalized: string | null;
  productDescriptionRaw: string | null;
  itemValue: string | null;
  itemValueLabel: string;
  declarationFobValue: string | null;
  quantity: string | null;
  quantityUnitCode: string | null;
  unitPriceValue: string | null;
  grossWeightItem: string | null;
  grossWeightTotal: string | null;
  customsOfficeCode: string | null;
  relevantPortCode: string | null;
  transportModeCode: string | null;
  sourceFileId: string;
  importBatchId: string;
  sourceFilename: string;
  rawRowNumber: number;
  evidence: string;
  recordHref: string;
  sourceHref: string;
  sourceTradeRecordsHref: string;
};

export type DataQualityIssueGroup = {
  key: DataQualityIssueKind;
  title: string;
  description: string;
  status: DataQualityStatus;
  count: number;
  sampleLimit: number;
  tradeRecordsHref: string;
  samples: DataQualityIssueSample[];
};

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
  findings: DataQualityFinding[];
};

type CountValue = number | string | null | undefined;

type FlowCountRow = {
  tradeFlow: string | null;
  rawRows?: CountValue;
  parsedRows?: CountValue;
  failedRows?: CountValue;
  warningRows?: CountValue;
  tradeRecords?: CountValue;
};

type CodeCountRow = {
  code: string | null;
  records: CountValue;
};

type CodeValueSetMap = Record<LabelDimensionKey, Set<string>>;

type IssueSampleRow = {
  id: string;
  tradeFlow: string;
  periodYear: number;
  periodMonth: number;
  declarationIdRaw: string | null;
  itemNumber: number | null;
  hsCodeNormalized: string | null;
  productDescriptionRaw: string | null;
  quantity: string | null;
  quantityUnitCode: string | null;
  grossWeightItem: string | null;
  grossWeightTotal: string | null;
  itemCifValue: string | null;
  itemFobValue: string | null;
  declarationFobValue: string | null;
  unitPriceValue: string | null;
  customsOfficeCode: string | null;
  embarkPortCode: string | null;
  disembarkPortCode: string | null;
  transportModeCode: string | null;
  sourceFileId: string;
  importBatchId: string;
  originalFilename: string;
  normalizedRawFilename: string | null;
  rawRowNumber: number;
};

function toNumber(value: CountValue): number {
  if (value === null || value === undefined) {
    return 0;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

export function coveragePercent(covered: number, total: number): number {
  if (total <= 0) {
    return 0;
  }

  return Math.round((covered / total) * 1000) / 10;
}

export function coverageStatus({
  covered,
  okAt = 99,
  total,
  warningBelow = 90,
}: {
  covered: number;
  total: number;
  okAt?: number;
  warningBelow?: number;
}): DataQualityStatus {
  if (total <= 0) {
    return "review";
  }

  const percent = coveragePercent(covered, total);
  if (percent >= okAt) {
    return "ok";
  }

  if (percent < warningBelow) {
    return "warning";
  }

  return "review";
}

export function normalizeCodeForCoverage(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^\d+$/.test(trimmed)) {
    const withoutLeadingZeros = trimmed.replace(/^0+/, "");
    return withoutLeadingZeros || "0";
  }

  return trimmed.toUpperCase();
}

function marchRawWhere(flow?: TradeFlow): SQL {
  const conditions: SQL[] = [
    eq(rawTradeRows.periodYear, reportPeriod.year),
    eq(rawTradeRows.periodMonth, reportPeriod.month),
  ];

  if (flow) {
    conditions.push(eq(rawTradeRows.tradeFlow, flow));
  }

  return and(...conditions) ?? sql`true`;
}

function marchTradeWhere(flow?: TradeFlow): SQL {
  const conditions: SQL[] = [
    eq(tradeRecords.periodYear, reportPeriod.year),
    eq(tradeRecords.periodMonth, reportPeriod.month),
  ];

  if (flow) {
    conditions.push(eq(tradeRecords.tradeFlow, flow));
  }

  return and(...conditions) ?? sql`true`;
}

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

function statusForFlow(rawRows: number, failedRows: number, rawToTradeDelta: number) {
  if (failedRows > 0 || rawToTradeDelta !== 0) {
    return "warning" satisfies DataQualityStatus;
  }

  if (rawRows === 0) {
    return "review" satisfies DataQualityStatus;
  }

  return "ok" satisfies DataQualityStatus;
}

export function dataQualityIssueRecordHref(id: string) {
  return `/trade-records/${id}`;
}

export function dataQualityIssueSearchHref(filters: TradeRecordFilters) {
  return buildTradeRecordSearchHref(filtersToTradeRecordSearchParams(filters));
}

export function dataQualityIssueStatus(
  count: number,
  statusWhenPresent: DataQualityStatus = "review",
): DataQualityStatus {
  return count > 0 ? statusWhenPresent : "ok";
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

  const rawByFlow = new Map(rawRows.map((row) => [row.tradeFlow, row]));
  const tradeByFlow = new Map(tradeRows.map((row) => [row.tradeFlow, row]));

  return (["import", "export"] satisfies TradeFlow[]).map((tradeFlow) => {
    const raw = rawByFlow.get(tradeFlow) as FlowCountRow | undefined;
    const trade = tradeByFlow.get(tradeFlow) as FlowCountRow | undefined;
    const rawCount = toNumber(raw?.rawRows);
    const failedRows = toNumber(raw?.failedRows);
    const tradeRecordCount = toNumber(trade?.tradeRecords);
    const rawToTradeDelta = rawCount - tradeRecordCount;

    return {
      tradeFlow,
      rawRows: rawCount,
      parsedRows: toNumber(raw?.parsedRows),
      failedRows,
      warningRows: toNumber(raw?.warningRows),
      tradeRecords: tradeRecordCount,
      rawToTradeDelta,
      status: statusForFlow(rawCount, failedRows, rawToTradeDelta),
    };
  });
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

  const tradeCountByBatch = new Map(
    tradeRows.map((row) => [
      `${row.sourceFileId}:${row.importBatchId}:${row.tradeFlow}`,
      toNumber(row.tradeRecords),
    ]),
  );

  return rawRows
    .filter((row) => row.tradeFlow === "import" || row.tradeFlow === "export")
    .map((row) => {
      const tradeFlow = row.tradeFlow as TradeFlow;
      const importBatchId = row.importBatchId;
      const sourceFileId = row.sourceFileId;

      return {
        sourceFileId,
        importBatchId,
        tradeFlow,
        filename: sourceDisplayFilename({
          originalFilename: row.originalFilename,
          normalizedRawFilename: row.normalizedRawFilename,
        }),
        batchStatus: row.batchStatus,
        rawRows: toNumber(row.rawRows),
        parsedRows: toNumber(row.parsedRows),
        failedRows: toNumber(row.failedRows),
        tradeRecords:
          tradeCountByBatch.get(`${sourceFileId}:${importBatchId}:${tradeFlow}`) ?? 0,
        sourceHref: `/sources/${sourceFileId}#batch-${importBatchId}`,
        tradeRecordsHref: sourceTradeRecordsHref({
          sourceFileId,
          importBatchId,
          tradeFlow,
        }),
      };
    });
}

type FieldDefinition = {
  key: string;
  label: string;
  covered: CountValue;
  caveat: string;
  okAt?: number;
  warningBelow?: number;
};

function fieldCoverageRows({
  fields,
  total,
  tradeFlow,
}: {
  fields: FieldDefinition[];
  total: number;
  tradeFlow: TradeFlow;
}): DataQualityFieldCoverage[] {
  return fields.map((field) => {
    const covered = toNumber(field.covered);

    return {
      tradeFlow,
      key: field.key,
      label: field.label,
      covered,
      total,
      percent: coveragePercent(covered, total),
      status: coverageStatus({
        covered,
        total,
        okAt: field.okAt ?? 99,
        warningBelow: field.warningBelow ?? 90,
      }),
      caveat: field.caveat,
    };
  });
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

  const keyByCodeTable = new Map<string, LabelDimensionKey>(
    Object.entries(codeTableKeys).map(([key, codeTableKey]) => [
      codeTableKey,
      key as LabelDimensionKey,
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

function labelCoverageFromRows({
  caveat,
  codeSet,
  key,
  label,
  rows,
  tradeFlow,
}: {
  caveat: string;
  codeSet: Set<string>;
  key: LabelDimensionKey;
  label: string;
  rows: CodeCountRow[];
  tradeFlow: TradeFlow;
}): DataQualityLabelCoverage {
  const distinctCodes = new Set<string>();
  const decodedCodes = new Set<string>();
  const undecodedCodes = new Set<string>();
  let recordsWithCode = 0;
  let recordsWithDecodedCode = 0;

  for (const row of rows) {
    const normalizedCode = normalizeCodeForCoverage(row.code);
    if (!normalizedCode) {
      continue;
    }

    const records = toNumber(row.records);
    distinctCodes.add(normalizedCode);
    recordsWithCode += records;

    if (codeSet.has(normalizedCode)) {
      decodedCodes.add(normalizedCode);
      recordsWithDecodedCode += records;
    } else {
      undecodedCodes.add(normalizedCode);
    }
  }

  return {
    tradeFlow,
    key,
    label,
    distinctCodes: distinctCodes.size,
    decodedCodes: decodedCodes.size,
    undecodedCodes: Array.from(undecodedCodes).sort().slice(0, 12),
    recordsWithCode,
    recordsWithDecodedCode,
    percent: coveragePercent(recordsWithDecodedCode, recordsWithCode),
    status: coverageStatus({
      covered: recordsWithDecodedCode,
      total: recordsWithCode,
      okAt: 99,
      warningBelow: 95,
    }),
    caveat,
  };
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

function sourceHref(sourceFileId: string, importBatchId: string) {
  return `/sources/${sourceFileId}#batch-${importBatchId}`;
}

function periodLabel(row: Pick<IssueSampleRow, "periodMonth" | "periodYear">) {
  return `${row.periodYear}-${String(row.periodMonth).padStart(2, "0")}`;
}

function issueSampleFromRow(
  row: IssueSampleRow,
  evidence: string,
): DataQualityIssueSample | null {
  if (row.tradeFlow !== "import" && row.tradeFlow !== "export") {
    return null;
  }

  const tradeFlow = row.tradeFlow;

  return {
    id: row.id,
    tradeFlow,
    periodLabel: periodLabel(row),
    declarationIdRaw: row.declarationIdRaw,
    itemNumber: row.itemNumber,
    hsCodeNormalized: row.hsCodeNormalized,
    productDescriptionRaw: row.productDescriptionRaw,
    itemValue: tradeFlow === "import" ? row.itemCifValue : row.itemFobValue,
    itemValueLabel: tradeFlow === "import" ? "CIF item" : "FOB item",
    declarationFobValue: row.declarationFobValue,
    quantity: row.quantity,
    quantityUnitCode: row.quantityUnitCode,
    unitPriceValue: row.unitPriceValue,
    grossWeightItem: row.grossWeightItem,
    grossWeightTotal: row.grossWeightTotal,
    customsOfficeCode: row.customsOfficeCode,
    relevantPortCode: tradeFlow === "import" ? row.disembarkPortCode : row.embarkPortCode,
    transportModeCode: row.transportModeCode,
    sourceFileId: row.sourceFileId,
    importBatchId: row.importBatchId,
    sourceFilename: sourceDisplayFilename({
      originalFilename: row.originalFilename,
      normalizedRawFilename: row.normalizedRawFilename,
    }),
    rawRowNumber: row.rawRowNumber,
    evidence,
    recordHref: dataQualityIssueRecordHref(row.id),
    sourceHref: sourceHref(row.sourceFileId, row.importBatchId),
    sourceTradeRecordsHref: sourceTradeRecordsHref({
      sourceFileId: row.sourceFileId,
      importBatchId: row.importBatchId,
      tradeFlow,
    }),
  };
}

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
    .map((row) => issueSampleFromRow(row, evidence))
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
        const normalizedCode = normalizeCodeForCoverage(row.code);
        return Boolean(normalizedCode && !config.codeSet.has(normalizedCode));
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

function buildFindings({
  fieldCoverage,
  flows,
  labelCoverage,
  payloadCoverage,
}: {
  fieldCoverage: DataQualityFieldCoverage[];
  flows: DataQualityFlowSummary[];
  labelCoverage: DataQualityLabelCoverage[];
  payloadCoverage: DataQualityPayloadCoverage[];
}): DataQualityFinding[] {
  const findings: DataQualityFinding[] = [];

  for (const flow of flows) {
    if (flow.status === "ok") {
      findings.push({
        status: "ok",
        title: `${flow.tradeFlow === "import" ? "Importaciones" : "Exportaciones"}: filas normalizadas`,
        detail: `${flow.rawRows.toLocaleString("es-CL")} filas crudas y ${flow.tradeRecords.toLocaleString("es-CL")} registros normalizados; diferencia ${flow.rawToTradeDelta.toLocaleString("es-CL")}.`,
      });
    } else {
      findings.push({
        status: flow.status,
        title: `${flow.tradeFlow === "import" ? "Importaciones" : "Exportaciones"}: revisar normalización`,
        detail: `Diferencia raw-normalizado ${flow.rawToTradeDelta.toLocaleString("es-CL")} y ${flow.failedRows.toLocaleString("es-CL")} filas fallidas.`,
      });
    }
  }

  const labelProblems = labelCoverage.filter((row) => row.status !== "ok");
  if (labelProblems.length > 0) {
    findings.push({
      status: labelProblems.some((row) => row.status === "warning") ? "warning" : "review",
      title: "Cobertura de etiquetas decodificadas",
      detail: `${labelProblems.length} dimensiones tienen códigos sin match perfecto en tablas Aduana. La UI debe mostrar código + etiqueta cuando exista y conservar el código fuente.`,
    });
  } else {
    findings.push({
      status: "ok",
      title: "Etiquetas decodificadas",
      detail: "Países, aduanas, puertos y vías principales decodifican contra tablas Aduana para los registros con código.",
    });
  }

  const missingCoreFields = fieldCoverage.filter((row) => row.status === "warning");
  if (missingCoreFields.length > 0) {
    const fieldLabel = missingCoreFields.length === 1 ? "campo" : "campos";
    const verb = missingCoreFields.length === 1 ? "está" : "están";
    findings.push({
      status: "warning",
      title: "Campos comerciales incompletos",
      detail: `${missingCoreFields.length} ${fieldLabel} de alto valor ${verb} bajo el umbral de cobertura. Priorizar revisión de parser o mapeo antes de usar esos campos para decisiones.`,
    });
  }

  const prunedRows = payloadCoverage.reduce(
    (total, row) => total + (row.retentionMode === "pruned" ? row.rows : 0),
    0,
  );
  findings.push({
    status: prunedRows > 0 ? "review" : "ok",
    title: "Payload crudo y trazabilidad",
    detail:
      prunedRows > 0
        ? `${prunedRows.toLocaleString("es-CL")} filas tienen payload podado; revisar reconstructibilidad antes de auditoría fina.`
        : "Las filas de marzo 2026 mantienen payload crudo completo en Postgres dev y trazabilidad a fuente/lote/fila.",
  });

  findings.push({
    status: "review",
    title: "Correlativos anónimos",
    detail:
      "Los correlativos importador/exportador siguen siendo identificadores anónimos de Aduana. No deben presentarse como RUT, razón social ni identidad legal verificada.",
  });

  return findings;
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
  const issueGroups = await loadIssueGroups(db);

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
    findings: buildFindings({
      fieldCoverage,
      flows,
      labelCoverage,
      payloadCoverage,
    }),
  };
}
