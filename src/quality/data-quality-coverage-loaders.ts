import {
  count,
  sql,
  type SQL,
} from "drizzle-orm";

import type { DbClient } from "@/db/client";
import { countValueToNumber } from "@/db/count-values";
import { tradeRecords } from "@/db/schema";
import {
  fieldCoverageRows,
  type DataQualityFieldCoverage,
} from "@/quality/field-coverage";
import {
  march2026ReportPeriod,
  qualityTradeRecordsWhere,
  type QualityReportPeriod,
} from "@/quality/march-2026";

const toNumber = countValueToNumber;

function countPresent(expression: SQL<unknown>) {
  return sql<number>`count(*) filter (where ${expression} is not null and ${expression}::text <> '')`;
}

function countAnyPresent(expressions: SQL<unknown>[]) {
  const joined = sql.join(
    expressions.map(
      (expression) =>
        sql`(${expression} is not null and ${expression}::text <> '')`,
    ),
    sql` or `,
  );

  return sql<number>`count(*) filter (where ${joined})`;
}

async function loadImportFieldCoverage(
  db: DbClient,
  period: QualityReportPeriod,
): Promise<DataQualityFieldCoverage[]> {
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
    .where(qualityTradeRecordsWhere(period, "import"));

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
        caveat:
          "Texto fuente, útil para búsqueda comercial pero no clasificación oficial adicional.",
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
        caveat:
          "Valor de declaración; puede repetirse entre items de una misma declaración.",
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
        caveat:
          "Puede representar el total de declaración o embarque según fuente.",
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
        caveat:
          "Código fuente decodificado con tablas de Aduana cuando existe match.",
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
        caveat:
          "Código fuente decodificado con tablas de Aduana cuando existe match.",
      },
    ],
  });
}

async function loadExportFieldCoverage(
  db: DbClient,
  period: QualityReportPeriod,
): Promise<DataQualityFieldCoverage[]> {
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
    .where(qualityTradeRecordsWhere(period, "export"));

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
        caveat:
          "Texto fuente, útil para búsqueda comercial pero no clasificación oficial adicional.",
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
        caveat:
          "Valor de declaración; puede repetirse entre items de una misma declaración.",
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
        caveat:
          "Puede representar el total de declaración o embarque según fuente.",
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
        caveat:
          "Código fuente decodificado con tablas de Aduana cuando existe match.",
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
        caveat:
          "Código fuente decodificado con tablas de Aduana cuando existe match.",
      },
    ],
  });
}

export async function loadFieldCoverage(
  db: DbClient,
  period: QualityReportPeriod = march2026ReportPeriod,
): Promise<DataQualityFieldCoverage[]> {
  const [imports, exports] = await Promise.all([
    loadImportFieldCoverage(db, period),
    loadExportFieldCoverage(db, period),
  ]);

  return [...imports, ...exports];
}
