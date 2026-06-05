import {
  and,
  sql,
} from "drizzle-orm";

import type { DbClient } from "@/db/client";
import { tradeRecords } from "@/db/schema";
import { loadCodeValueSets } from "@/quality/code-value-sets";
import {
  dataQualityIssueSearchHref,
  type DataQualityIssueGroup,
} from "@/quality/data-quality-issues";
import {
  issueGroupFromWhere,
  undecodedIssueGroup,
} from "@/quality/data-quality-issue-sampling";
import {
  march2026ReportPeriod,
  qualityPeriodSearchParams,
  qualityTradeRecordsWhere,
  type QualityReportPeriod,
} from "@/quality/march-2026";
import { dusExportSpecialLogisticsCodes } from "@/quality/source-special-codes";
import type { TradeRecordFilters } from "@/trade/trade-records";

export async function loadDataQualityIssueGroups(
  db: DbClient,
  period: QualityReportPeriod = march2026ReportPeriod,
): Promise<DataQualityIssueGroup[]> {
  const codeSets = await loadCodeValueSets(db);
  const periodFilters = {
    ...qualityPeriodSearchParams(period),
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
        ...periodFilters,
        tradeFlow: "import",
      }),
      where: and(
        qualityTradeRecordsWhere(period, "import"),
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
      period,
      flows: [
        {
          tradeFlow: "import",
          expression: sql<string>`${tradeRecords.customsOfficeCode}`,
          whereExpression: sql`${tradeRecords.customsOfficeCode}`,
          searchFilter: (code) => ({
            ...periodFilters,
            tradeFlow: "import",
            customsOfficeCode: code,
          }),
        },
        {
          tradeFlow: "export",
          expression: sql<string>`${tradeRecords.customsOfficeCode}`,
          whereExpression: sql`${tradeRecords.customsOfficeCode}`,
          searchFilter: (code) => ({
            ...periodFilters,
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
      period,
      flows: [
        {
          tradeFlow: "import",
          expression: sql<string>`${tradeRecords.disembarkPortCode}`,
          whereExpression: sql`${tradeRecords.disembarkPortCode}`,
          searchFilter: (code) => ({
            ...periodFilters,
            tradeFlow: "import",
            disembarkPortCode: code,
          }),
        },
        {
          tradeFlow: "export",
          expression: sql<string>`${tradeRecords.embarkPortCode}`,
          ignoredSourceCodes: dusExportSpecialLogisticsCodes,
          whereExpression: sql`${tradeRecords.embarkPortCode}`,
          searchFilter: (code) => ({
            ...periodFilters,
            tradeFlow: "export",
            embarkPortCode: code,
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
      period,
      flows: [
        {
          tradeFlow: "import",
          expression: sql<string>`${tradeRecords.transportModeCode}`,
          whereExpression: sql`${tradeRecords.transportModeCode}`,
          searchFilter: (code) => ({
            ...periodFilters,
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
            ...periodFilters,
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
      tradeRecordsHref: dataQualityIssueSearchHref(periodFilters),
      where: and(qualityTradeRecordsWhere(period), itemValueMissingOrZero) ?? sql`false`,
    }),
    issueGroupFromWhere({
      db,
      key: "missing_or_zero_declaration_fob",
      title: "FOB declaración vacío o cero",
      description:
        "Casos donde el FOB de declaración no está disponible o es cero. Puede afectar análisis agregados por declaración.",
      evidence: "FOB declaración vacío o cero; revisar si el valor vive en otro campo fuente.",
      statusWhenPresent: "review",
      tradeRecordsHref: dataQualityIssueSearchHref(periodFilters),
      where: and(
        qualityTradeRecordsWhere(period),
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
      tradeRecordsHref: dataQualityIssueSearchHref(periodFilters),
      where: and(
        qualityTradeRecordsWhere(period),
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
