import {
  and,
  asc,
  count,
  eq,
  inArray,
  sql,
  type SQL,
} from "drizzle-orm";

import { countValueToNumber } from "@/db/count-values";
import type { DbClient } from "@/db/client";
import {
  rawTradeRows,
  sourceFiles,
  tradeRecords,
} from "@/db/schema";
import {
  isActionableUndecodedCode,
  normalizeCodeForCoverage,
  type DataQualityStatus,
} from "@/quality/coverage";
import {
  codeCountsForDimension,
  loadCodeValueSets,
} from "@/quality/code-value-sets";
import {
  dataQualityIssueSampleFromRow,
  dataQualityIssueSearchHref,
  dataQualityIssueStatus,
  type DataQualityIssueGroup,
  type DataQualityIssueKind,
  type DataQualityIssueSample,
} from "@/quality/data-quality-issues";
import {
  march2026ReportPeriod,
  march2026TradeRecordsWhere,
} from "@/quality/march-2026";
import { dusExportSpecialLogisticsCodes } from "@/quality/source-special-codes";
import type { TradeFlow, TradeRecordFilters } from "@/trade/trade-records";

const reportPeriod = march2026ReportPeriod;
const marchTradeWhere = march2026TradeRecordsWhere;
const toNumber = countValueToNumber;
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

export async function loadDataQualityIssueGroups(
  db: DbClient,
): Promise<DataQualityIssueGroup[]> {
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
