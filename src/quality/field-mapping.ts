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
  rawTradeRows,
  sourceFiles,
  sourceLayoutFields,
  sourceLayouts,
  tradeRecords,
} from "@/db/schema";
import { sourceDisplayFilename, sourceTradeRecordsHref } from "@/sources/source-provenance";
import { buildTradeRecordSearchHref } from "@/trade/trade-record-links";
import type { TradeFlow } from "@/trade/trade-records";
import { coveragePercent, type DataQualityStatus } from "@/quality/data-quality";

const reportPeriod = {
  year: 2026,
  month: 3,
  label: "2026-03",
};

export type FieldMappingGroup =
  | "commercial_values"
  | "quantity_weight"
  | "geography_logistics"
  | "hs_product"
  | "anonymous_correlative"
  | "provenance";

export type FieldMappingConfidence = "verified" | "inferred" | "needs_review";

type NormalizedFieldKey =
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

type FieldMappingDefinition = {
  id: string;
  tradeFlow: TradeFlow;
  group: FieldMappingGroup;
  normalizedField: NormalizedFieldKey;
  label: string;
  rawFields: string[];
  confidence: FieldMappingConfidence;
  note: string;
};

export type FieldMappingRawField = {
  name: string;
  ordinal: number | null;
  isCoded: boolean;
  codeTableKey: string | null;
};

export type FieldMappingRow = {
  id: string;
  tradeFlow: TradeFlow;
  group: FieldMappingGroup;
  label: string;
  normalizedField: NormalizedFieldKey;
  rawFields: FieldMappingRawField[];
  confidence: FieldMappingConfidence;
  status: DataQualityStatus;
  note: string;
  totalRows: number;
  rawSampleRows: number;
  rawPresentRows: number;
  rawCoveragePercent: number;
  normalizedPresentRows: number;
  normalizedCoveragePercent: number;
  sampleValues: string[];
  tradeRecordsHref: string;
  sourceHref: string | null;
  sourceLabel: string | null;
};

export type FieldMappingReport = {
  period: typeof reportPeriod;
  rows: FieldMappingRow[];
  summary: {
    totalMappings: number;
    verifiedMappings: number;
    inferredMappings: number;
    reviewMappings: number;
    warningMappings: number;
  };
};

type CountValue = number | string | null | undefined;

type LayoutFieldRow = {
  tradeFlow: string | null;
  sourceFieldName: string;
  fieldOrdinal: number;
  isCoded: boolean;
  codeTableKey: string | null;
};

type RawSampleRow = {
  tradeFlow: string | null;
  rawValues: unknown;
};

type SourceContextRow = {
  tradeFlow: string | null;
  sourceFileId: string;
  importBatchId: string;
  originalFilename: string;
  normalizedRawFilename: string | null;
};

export function rawSampleValueRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

const fieldMappingDefinitions: FieldMappingDefinition[] = [
  {
    id: "import_declaration_id",
    tradeFlow: "import",
    group: "provenance",
    normalizedField: "declarationIdRaw",
    label: "Declaración / identificación DIN",
    rawFields: ["NUMENCRIPTADO"],
    confidence: "verified",
    note: "Identificador fuente de la declaración; se conserva como texto crudo.",
  },
  {
    id: "export_declaration_id",
    tradeFlow: "export",
    group: "provenance",
    normalizedField: "declarationIdRaw",
    label: "Declaración / identificación DUS",
    rawFields: ["NUMEROIDENT"],
    confidence: "verified",
    note: "Identificador fuente de la declaración; se conserva como texto crudo.",
  },
  {
    id: "import_item_number",
    tradeFlow: "import",
    group: "provenance",
    normalizedField: "itemNumber",
    label: "Número de item",
    rawFields: ["NUMITEM"],
    confidence: "verified",
    note: "Número de item dentro de la declaración.",
  },
  {
    id: "export_item_number",
    tradeFlow: "export",
    group: "provenance",
    normalizedField: "itemNumber",
    label: "Número de item",
    rawFields: ["NUMEROITEM"],
    confidence: "verified",
    note: "Número de item dentro de la declaración.",
  },
  {
    id: "import_acceptance_date",
    tradeFlow: "import",
    group: "provenance",
    normalizedField: "acceptanceDate",
    label: "Fecha de aceptación",
    rawFields: ["FECACEP"],
    confidence: "inferred",
    note: "Fecha normalizada desde formato fuente ddmmaaaa; se conserva también el valor crudo.",
  },
  {
    id: "export_acceptance_date",
    tradeFlow: "export",
    group: "provenance",
    normalizedField: "acceptanceDate",
    label: "Fecha de aceptación",
    rawFields: ["FECHAACEPT"],
    confidence: "inferred",
    note: "Fecha normalizada desde formato fuente ddmmaaaa; se conserva también el valor crudo.",
  },
  {
    id: "import_importer_correlative",
    tradeFlow: "import",
    group: "anonymous_correlative",
    normalizedField: "importerCorrelativeId",
    label: "Correlativo anónimo importador",
    rawFields: ["NUM_UNICO_IMPORTADOR"],
    confidence: "verified",
    note: "Identificador anónimo de Aduana. No es RUT, razón social ni identidad legal verificada.",
  },
  {
    id: "export_exporter_primary_correlative",
    tradeFlow: "export",
    group: "anonymous_correlative",
    normalizedField: "exporterPrimaryCorrelativeId",
    label: "Correlativo anónimo exportador principal",
    rawFields: ["NRO_EXPORTADOR"],
    confidence: "verified",
    note: "Identificador anónimo de Aduana. No es RUT, razón social ni identidad legal verificada.",
  },
  {
    id: "export_exporter_secondary_correlative",
    tradeFlow: "export",
    group: "anonymous_correlative",
    normalizedField: "exporterSecondaryCorrelativeId",
    label: "Correlativo anónimo exportador secundario",
    rawFields: ["NRO_EXPORTADOR_SEC"],
    confidence: "verified",
    note: "Identificador anónimo de Aduana. Muchos registros no traen exportador secundario.",
  },
  {
    id: "import_hs_raw",
    tradeFlow: "import",
    group: "hs_product",
    normalizedField: "hsCodeRaw",
    label: "Código arancelario fuente",
    rawFields: ["ARANC-NAC"],
    confidence: "verified",
    note: "Código arancelario fuente antes de normalizar dígitos.",
  },
  {
    id: "export_hs_raw",
    tradeFlow: "export",
    group: "hs_product",
    normalizedField: "hsCodeRaw",
    label: "Código arancelario fuente",
    rawFields: ["CODIGOARANCEL"],
    confidence: "verified",
    note: "Código arancelario fuente antes de normalizar dígitos.",
  },
  {
    id: "import_hs_normalized",
    tradeFlow: "import",
    group: "hs_product",
    normalizedField: "hsCodeNormalized",
    label: "Código HS normalizado",
    rawFields: ["ARANC-NAC"],
    confidence: "inferred",
    note: "Se conservan solo dígitos para filtros por prefijo; validar contra diccionario HS antes de uso oficial.",
  },
  {
    id: "export_hs_normalized",
    tradeFlow: "export",
    group: "hs_product",
    normalizedField: "hsCodeNormalized",
    label: "Código HS normalizado",
    rawFields: ["CODIGOARANCEL"],
    confidence: "inferred",
    note: "Se conservan solo dígitos para filtros por prefijo; validar contra diccionario HS antes de uso oficial.",
  },
  {
    id: "import_product_description",
    tradeFlow: "import",
    group: "hs_product",
    normalizedField: "productDescriptionRaw",
    label: "Descripción producto",
    rawFields: ["DNOMBRE"],
    confidence: "verified",
    note: "Texto fuente principal del producto; puede contener abreviaturas o escritura operativa.",
  },
  {
    id: "export_product_description",
    tradeFlow: "export",
    group: "hs_product",
    normalizedField: "productDescriptionRaw",
    label: "Descripción producto",
    rawFields: ["NOMBRE"],
    confidence: "verified",
    note: "Texto fuente principal del producto; puede contener abreviaturas o escritura operativa.",
  },
  {
    id: "import_product_attributes",
    tradeFlow: "import",
    group: "hs_product",
    normalizedField: "productAttributes",
    label: "Atributos de producto",
    rawFields: ["DMARCA", "DVARIEDAD", "DOTRO1", "DOTRO2", "ATR-5", "ATR-6"],
    confidence: "verified",
    note: "Atributos fuente agrupados en JSON para revisión y búsqueda; no equivalen a identidad de empresa.",
  },
  {
    id: "export_product_attributes",
    tradeFlow: "export",
    group: "hs_product",
    normalizedField: "productAttributes",
    label: "Atributos de producto",
    rawFields: ["ATRIBUTO1", "ATRIBUTO2", "ATRIBUTO3", "ATRIBUTO4", "ATRIBUTO5", "ATRIBUTO6"],
    confidence: "verified",
    note: "Atributos fuente agrupados en JSON para revisión y búsqueda; no equivalen a identidad de empresa.",
  },
  {
    id: "import_product_search",
    tradeFlow: "import",
    group: "hs_product",
    normalizedField: "productSearchText",
    label: "Texto de búsqueda producto",
    rawFields: ["DNOMBRE", "DMARCA", "DVARIEDAD", "DOTRO1", "DOTRO2", "ATR-5", "ATR-6"],
    confidence: "inferred",
    note: "Campo derivado para búsqueda; combina descripción y atributos sin cambiar el texto fuente.",
  },
  {
    id: "export_product_search",
    tradeFlow: "export",
    group: "hs_product",
    normalizedField: "productSearchText",
    label: "Texto de búsqueda producto",
    rawFields: ["NOMBRE", "ATRIBUTO1", "ATRIBUTO2", "ATRIBUTO3", "ATRIBUTO4", "ATRIBUTO5", "ATRIBUTO6"],
    confidence: "inferred",
    note: "Campo derivado para búsqueda; combina descripción y atributos sin cambiar el texto fuente.",
  },
  {
    id: "import_quantity",
    tradeFlow: "import",
    group: "quantity_weight",
    normalizedField: "quantity",
    label: "Cantidad mercancía",
    rawFields: ["CANT-MERC"],
    confidence: "inferred",
    note: "Número parseado desde coma decimal; comparar solo junto con unidad.",
  },
  {
    id: "export_quantity",
    tradeFlow: "export",
    group: "quantity_weight",
    normalizedField: "quantity",
    label: "Cantidad mercancía",
    rawFields: ["CANTIDADMERCANCIA"],
    confidence: "inferred",
    note: "Número parseado desde coma decimal; comparar solo junto con unidad.",
  },
  {
    id: "import_quantity_unit",
    tradeFlow: "import",
    group: "quantity_weight",
    normalizedField: "quantityUnitCode",
    label: "Unidad de medida",
    rawFields: ["MEDIDA"],
    confidence: "verified",
    note: "Código fuente de unidad; requiere tabla de códigos para etiqueta comercial.",
  },
  {
    id: "export_quantity_unit",
    tradeFlow: "export",
    group: "quantity_weight",
    normalizedField: "quantityUnitCode",
    label: "Unidad de medida",
    rawFields: ["UNIDADMEDIDA"],
    confidence: "verified",
    note: "Código fuente de unidad; requiere tabla de códigos para etiqueta comercial.",
  },
  {
    id: "import_gross_weight_total",
    tradeFlow: "import",
    group: "quantity_weight",
    normalizedField: "grossWeightTotal",
    label: "Peso bruto total",
    rawFields: ["TOT_PESO"],
    confidence: "inferred",
    note: "Peso total de la declaración/registro fuente; no debe confundirse con peso item.",
  },
  {
    id: "export_gross_weight_total",
    tradeFlow: "export",
    group: "quantity_weight",
    normalizedField: "grossWeightTotal",
    label: "Peso bruto total",
    rawFields: ["PESOBRUTOTOTAL"],
    confidence: "inferred",
    note: "Peso total de la declaración/registro fuente; no debe confundirse con peso item.",
  },
  {
    id: "import_gross_weight_item",
    tradeFlow: "import",
    group: "quantity_weight",
    normalizedField: "grossWeightItem",
    label: "Peso bruto item",
    rawFields: [],
    confidence: "needs_review",
    note: "El layout DIN March 2026 no contiene un campo de peso bruto por item; TOT_PESO es peso total y no debe usarse como aproximación automática.",
  },
  {
    id: "export_gross_weight_item",
    tradeFlow: "export",
    group: "quantity_weight",
    normalizedField: "grossWeightItem",
    label: "Peso bruto item",
    rawFields: ["PESOBRUTOITEM"],
    confidence: "inferred",
    note: "Peso item disponible en DUS; comparar contra peso total en revisiones agregadas.",
  },
  {
    id: "import_item_cif_value",
    tradeFlow: "import",
    group: "commercial_values",
    normalizedField: "itemCifValue",
    label: "Valor CIF item",
    rawFields: ["CIF-ITEM"],
    confidence: "inferred",
    note: "Métrica comercial principal para importaciones; parseada desde coma decimal.",
  },
  {
    id: "export_item_fob_value",
    tradeFlow: "export",
    group: "commercial_values",
    normalizedField: "itemFobValue",
    label: "Valor FOB item",
    rawFields: ["FOBUS"],
    confidence: "inferred",
    note: "Métrica comercial principal para exportaciones; parseada desde coma decimal.",
  },
  {
    id: "import_declaration_fob",
    tradeFlow: "import",
    group: "commercial_values",
    normalizedField: "declarationFobValue",
    label: "FOB declaración",
    rawFields: ["FOB"],
    confidence: "inferred",
    note: "Valor FOB de declaración; no reemplaza CIF item para ranking de importación.",
  },
  {
    id: "export_declaration_fob",
    tradeFlow: "export",
    group: "commercial_values",
    normalizedField: "declarationFobValue",
    label: "FOB declaración",
    rawFields: ["TOTALVALORFOB"],
    confidence: "inferred",
    note: "Valor FOB total de declaración; útil para contexto agregado de exportación.",
  },
  {
    id: "import_freight",
    tradeFlow: "import",
    group: "commercial_values",
    normalizedField: "freightValue",
    label: "Flete",
    rawFields: ["FLETE"],
    confidence: "inferred",
    note: "Componente de costo importación; revisar moneda/alcance antes de comparar entre fuentes.",
  },
  {
    id: "export_freight",
    tradeFlow: "export",
    group: "commercial_values",
    normalizedField: "freightValue",
    label: "Flete",
    rawFields: ["VALORFLETE"],
    confidence: "inferred",
    note: "Componente logístico exportación; puede no ser la métrica principal de valor comercial.",
  },
  {
    id: "import_insurance",
    tradeFlow: "import",
    group: "commercial_values",
    normalizedField: "insuranceValue",
    label: "Seguro",
    rawFields: ["SEGURO"],
    confidence: "inferred",
    note: "Componente de costo importación; revisar con CIF y flete.",
  },
  {
    id: "export_insurance",
    tradeFlow: "export",
    group: "commercial_values",
    normalizedField: "insuranceValue",
    label: "Seguro",
    rawFields: ["VALORSEGURO"],
    confidence: "inferred",
    note: "Componente logístico exportación; puede venir en cero sin invalidar FOB.",
  },
  {
    id: "import_cif_declaration",
    tradeFlow: "import",
    group: "commercial_values",
    normalizedField: "cifValue",
    label: "CIF declaración",
    rawFields: ["CIF"],
    confidence: "inferred",
    note: "Valor CIF de declaración; usar junto a CIF item y componentes de costo.",
  },
  {
    id: "export_cif_declaration",
    tradeFlow: "export",
    group: "commercial_values",
    normalizedField: "cifValue",
    label: "CIF exportación",
    rawFields: ["VALORCIF"],
    confidence: "inferred",
    note: "Campo fuente normalizado como contexto secundario; FOB sigue siendo la lectura principal de exportación y los ceros no son defecto automático.",
  },
  {
    id: "import_unit_price",
    tradeFlow: "import",
    group: "commercial_values",
    normalizedField: "unitPriceValue",
    label: "Precio unitario",
    rawFields: ["PRE-UNIT"],
    confidence: "inferred",
    note: "Precio unitario fuente; solo comparable cuando unidad y moneda son consistentes.",
  },
  {
    id: "export_unit_price",
    tradeFlow: "export",
    group: "commercial_values",
    normalizedField: "unitPriceValue",
    label: "Precio unitario FOB",
    rawFields: ["FOBUNITARIO"],
    confidence: "inferred",
    note: "Precio unitario fuente; solo comparable cuando unidad y moneda son consistentes.",
  },
  {
    id: "import_currency",
    tradeFlow: "import",
    group: "commercial_values",
    normalizedField: "currencyCodeRaw",
    label: "Moneda",
    rawFields: ["MONEDA"],
    confidence: "verified",
    note: "Código fuente de moneda; requiere tabla de códigos para etiqueta.",
  },
  {
    id: "export_currency",
    tradeFlow: "export",
    group: "commercial_values",
    normalizedField: "currencyCodeRaw",
    label: "Moneda",
    rawFields: ["MONEDA"],
    confidence: "verified",
    note: "Código fuente de moneda; requiere tabla de códigos para etiqueta.",
  },
  {
    id: "import_origin_country",
    tradeFlow: "import",
    group: "geography_logistics",
    normalizedField: "originCountryCode",
    label: "País de origen",
    rawFields: ["PA_ORIG"],
    confidence: "verified",
    note: "Código fuente; la etiqueta depende de tablas Aduana cargadas.",
  },
  {
    id: "import_acquisition_country",
    tradeFlow: "import",
    group: "geography_logistics",
    normalizedField: "acquisitionCountryCode",
    label: "País de adquisición",
    rawFields: ["PA_ADQ"],
    confidence: "verified",
    note: "Código fuente; no siempre equivale al país de origen.",
  },
  {
    id: "import_consignment_country",
    tradeFlow: "import",
    group: "geography_logistics",
    normalizedField: "consignmentCountryCode",
    label: "País de consignación",
    rawFields: ["CODPAISCON"],
    confidence: "verified",
    note: "Código fuente; útil para logística, no para origen si difiere de PA_ORIG.",
  },
  {
    id: "export_destination_country",
    tradeFlow: "export",
    group: "geography_logistics",
    normalizedField: "destinationCountryCode",
    label: "País de destino",
    rawFields: ["PAISDESTINO"],
    confidence: "verified",
    note: "Código fuente; dimensión comercial principal de destino exportador.",
  },
  {
    id: "export_destination_country_label",
    tradeFlow: "export",
    group: "geography_logistics",
    normalizedField: "destinationCountryLabelRaw",
    label: "Glosa país destino",
    rawFields: ["GLOSAPAISDESTINO"],
    confidence: "verified",
    note: "Glosa fuente; convive con la etiqueta decodificada desde tabla de códigos.",
  },
  {
    id: "import_customs_office",
    tradeFlow: "import",
    group: "geography_logistics",
    normalizedField: "customsOfficeCode",
    label: "Aduana",
    rawFields: ["ADU"],
    confidence: "verified",
    note: "Código fuente de aduana; revisar faltantes de decodificación en QA.",
  },
  {
    id: "export_customs_office",
    tradeFlow: "export",
    group: "geography_logistics",
    normalizedField: "customsOfficeCode",
    label: "Aduana",
    rawFields: ["ADUANA"],
    confidence: "verified",
    note: "Código fuente de aduana; revisar faltantes de decodificación en QA.",
  },
  {
    id: "import_embark_port",
    tradeFlow: "import",
    group: "geography_logistics",
    normalizedField: "embarkPortCode",
    label: "Puerto de embarque",
    rawFields: ["PTO_EMB"],
    confidence: "verified",
    note: "Código fuente de puerto de embarque; para importación el puerto relevante de llegada suele ser desembarque.",
  },
  {
    id: "export_embark_port",
    tradeFlow: "export",
    group: "geography_logistics",
    normalizedField: "embarkPortCode",
    label: "Puerto de embarque",
    rawFields: ["PUERTOEMB"],
    confidence: "verified",
    note: "Código fuente de puerto de embarque; dimensión logística relevante en exportación.",
  },
  {
    id: "export_embark_port_label",
    tradeFlow: "export",
    group: "geography_logistics",
    normalizedField: "embarkPortLabelRaw",
    label: "Glosa puerto embarque",
    rawFields: ["GLOSAPUERTOEMB"],
    confidence: "verified",
    note: "Glosa fuente; convive con la etiqueta decodificada desde tabla de códigos.",
  },
  {
    id: "import_disembark_port",
    tradeFlow: "import",
    group: "geography_logistics",
    normalizedField: "disembarkPortCode",
    label: "Puerto de desembarque",
    rawFields: ["PTO_DESEM"],
    confidence: "verified",
    note: "Código fuente de puerto de desembarque; dimensión logística relevante en importación.",
  },
  {
    id: "export_disembark_port",
    tradeFlow: "export",
    group: "geography_logistics",
    normalizedField: "disembarkPortCode",
    label: "Puerto de desembarque",
    rawFields: ["PUERTODESEMB"],
    confidence: "verified",
    note: "Código fuente de puerto de desembarque; en exportación suele ser contexto de destino/logística.",
  },
  {
    id: "export_disembark_port_label",
    tradeFlow: "export",
    group: "geography_logistics",
    normalizedField: "disembarkPortLabelRaw",
    label: "Glosa puerto desembarque",
    rawFields: ["GLOSAPUERTODESEMB"],
    confidence: "verified",
    note: "Glosa fuente; convive con la etiqueta decodificada desde tabla de códigos.",
  },
  {
    id: "import_transport_mode",
    tradeFlow: "import",
    group: "geography_logistics",
    normalizedField: "transportModeCode",
    label: "Vía de transporte",
    rawFields: ["VIA_TRAN"],
    confidence: "verified",
    note: "Código fuente de vía; revisar faltantes de decodificación en QA.",
  },
  {
    id: "export_transport_mode",
    tradeFlow: "export",
    group: "geography_logistics",
    normalizedField: "transportModeCode",
    label: "Vía de transporte",
    rawFields: ["VIATRANSPORTE"],
    confidence: "verified",
    note: "Código fuente de vía; revisar faltantes de decodificación en QA.",
  },
  {
    id: "import_cargo_type",
    tradeFlow: "import",
    group: "geography_logistics",
    normalizedField: "cargoTypeCode",
    label: "Tipo de carga",
    rawFields: ["TPO_CARGA"],
    confidence: "verified",
    note: "Código fuente de tipo de carga; etiqueta completa depende de tabla oficial.",
  },
  {
    id: "export_cargo_type",
    tradeFlow: "export",
    group: "geography_logistics",
    normalizedField: "cargoTypeCode",
    label: "Tipo de carga",
    rawFields: ["TIPOCARGA"],
    confidence: "verified",
    note: "Código fuente de tipo de carga; etiqueta completa depende de tabla oficial.",
  },
];

function toNumber(value: CountValue): number {
  if (value === null || value === undefined) {
    return 0;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function marchRawWhere(flow: TradeFlow): SQL {
  return and(
    eq(rawTradeRows.periodYear, reportPeriod.year),
    eq(rawTradeRows.periodMonth, reportPeriod.month),
    eq(rawTradeRows.tradeFlow, flow),
  ) ?? sql`true`;
}

function marchTradeWhere(flow: TradeFlow): SQL {
  return and(
    eq(tradeRecords.periodYear, reportPeriod.year),
    eq(tradeRecords.periodMonth, reportPeriod.month),
    eq(tradeRecords.tradeFlow, flow),
  ) ?? sql`true`;
}

function presentCondition(expression: SQL<unknown>) {
  return sql`(${expression} is not null and btrim(${expression}::text) <> '')`;
}

function normalizedPresentCondition(field: NormalizedFieldKey): SQL {
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

export function fieldMappingSearchHref(tradeFlow: TradeFlow) {
  return buildTradeRecordSearchHref({
    tradeFlow,
    periodYear: String(reportPeriod.year),
    periodMonth: String(reportPeriod.month),
    limit: "25",
  });
}

export function fieldMappingCoverageStatus({
  confidence,
  normalizedTotalRows,
  normalizedPresentRows,
  rawFields,
  rawSampleRows,
  rawPresentRows,
}: {
  confidence: FieldMappingConfidence;
  normalizedTotalRows: number;
  normalizedPresentRows: number;
  rawFields: readonly string[];
  rawSampleRows: number;
  rawPresentRows: number;
}): DataQualityStatus {
  if (confidence === "needs_review" || rawFields.length === 0) {
    return "warning";
  }

  if (normalizedTotalRows <= 0) {
    return "review";
  }

  const normalizedCoverage = coveragePercent(normalizedPresentRows, normalizedTotalRows);
  const rawCoverage = rawSampleRows > 0
    ? coveragePercent(rawPresentRows, rawSampleRows)
    : normalizedCoverage;
  const conservativeCoverage = Math.min(rawCoverage, normalizedCoverage);

  if (conservativeCoverage >= 99) {
    return "ok";
  }

  return conservativeCoverage < 90 ? "warning" : "review";
}

function layoutFieldMap(rows: LayoutFieldRow[]) {
  const map = new Map<string, FieldMappingRawField>();

  for (const row of rows) {
    if (row.tradeFlow !== "import" && row.tradeFlow !== "export") {
      continue;
    }

    map.set(`${row.tradeFlow}:${row.sourceFieldName}`, {
      name: row.sourceFieldName,
      ordinal: row.fieldOrdinal,
      isCoded: row.isCoded,
      codeTableKey: row.codeTableKey,
    });
  }

  return map;
}

function rawFieldsForDefinition(
  definition: FieldMappingDefinition,
  fieldsByFlowAndName: Map<string, FieldMappingRawField>,
) {
  return definition.rawFields.map((fieldName) => (
    fieldsByFlowAndName.get(`${definition.tradeFlow}:${fieldName}`) ?? {
      name: fieldName,
      ordinal: null,
      isCoded: false,
      codeTableKey: null,
    }
  ));
}

function sampleValuesForDefinition(
  definition: FieldMappingDefinition,
  rawSamples: RawSampleRow[],
) {
  const values: string[] = [];
  const seen = new Set<string>();

  for (const row of rawSamples) {
    const rawValues = rawSampleValueRecord(row.rawValues);
    if (row.tradeFlow !== definition.tradeFlow || !rawValues) {
      continue;
    }

    for (const fieldName of definition.rawFields) {
      const rawValue = rawValues[fieldName];
      const value = typeof rawValue === "string" ? rawValue.trim() : "";
      if (!value) {
        continue;
      }

      const displayValue = definition.rawFields.length > 1
        ? `${fieldName}: ${value}`
        : value;
      if (seen.has(displayValue)) {
        continue;
      }

      seen.add(displayValue);
      values.push(displayValue);
      if (values.length >= 3) {
        return values;
      }
    }
  }

  return values;
}

function rawSampleCoverageForDefinition(
  definition: FieldMappingDefinition,
  rawSamples: RawSampleRow[],
) {
  let sampleRows = 0;
  let presentRows = 0;

  for (const row of rawSamples) {
    const rawValues = rawSampleValueRecord(row.rawValues);
    if (row.tradeFlow !== definition.tradeFlow || !rawValues) {
      continue;
    }

    sampleRows += 1;
    const hasPresentValue = definition.rawFields.some((fieldName) => {
      const rawValue = rawValues[fieldName];
      return typeof rawValue === "string" && rawValue.trim().length > 0;
    });

    if (hasPresentValue) {
      presentRows += 1;
    }
  }

  return { sampleRows, presentRows };
}

async function loadLayoutFields(db: DbClient) {
  return db
    .select({
      tradeFlow: sourceLayouts.tradeFlow,
      sourceFieldName: sourceLayoutFields.sourceFieldName,
      fieldOrdinal: sourceLayoutFields.fieldOrdinal,
      isCoded: sourceLayoutFields.isCoded,
      codeTableKey: sourceLayoutFields.codeTableKey,
    })
    .from(sourceLayoutFields)
    .innerJoin(sourceLayouts, eq(sourceLayoutFields.sourceLayoutId, sourceLayouts.id))
    .where(
      and(
        eq(sourceLayouts.countryCode, "CL"),
        eq(sourceLayouts.sourceSystem, "chile_aduana"),
        eq(sourceLayouts.sourceDomain, "datos.gob.cl"),
        eq(sourceLayouts.recordRole, "main_data"),
      ),
    )
    .orderBy(asc(sourceLayouts.tradeFlow), asc(sourceLayoutFields.fieldOrdinal));
}

async function loadRawSamples(db: DbClient) {
  const rows: RawSampleRow[] = [];

  for (const tradeFlow of ["import", "export"] satisfies TradeFlow[]) {
    const flowRows = await db
      .select({
        tradeFlow: rawTradeRows.tradeFlow,
        rawValues: rawTradeRows.rawValues,
      })
      .from(rawTradeRows)
      .where(
        and(
          marchRawWhere(tradeFlow),
          eq(rawTradeRows.parseStatus, "parsed"),
          sql`${rawTradeRows.rawValues} is not null`,
        ),
      )
      .orderBy(asc(rawTradeRows.rowNumber))
      .limit(250);

    rows.push(...flowRows);
  }

  return rows;
}

async function loadSourceContexts(db: DbClient) {
  const contexts = new Map<TradeFlow, SourceContextRow>();

  for (const tradeFlow of ["import", "export"] satisfies TradeFlow[]) {
    const [row] = await db
      .select({
        tradeFlow: tradeRecords.tradeFlow,
        sourceFileId: tradeRecords.sourceFileId,
        importBatchId: tradeRecords.importBatchId,
        originalFilename: sourceFiles.originalFilename,
        normalizedRawFilename: sourceFiles.normalizedRawFilename,
      })
      .from(tradeRecords)
      .innerJoin(sourceFiles, eq(tradeRecords.sourceFileId, sourceFiles.id))
      .where(marchTradeWhere(tradeFlow))
      .orderBy(asc(sourceFiles.originalFilename), asc(tradeRecords.importBatchId))
      .limit(1);

    if (row.tradeFlow === "import" || row.tradeFlow === "export") {
      contexts.set(row.tradeFlow, row);
    }
  }

  return contexts;
}

async function loadNormalizedCoverage(
  db: DbClient,
  tradeFlow: TradeFlow,
  definitions: FieldMappingDefinition[],
) {
  const selectFields: Record<string, SQL<number>> = {
    total: count(),
  };

  for (const definition of definitions) {
    selectFields[definition.id] = sql<number>`count(*) filter (where ${normalizedPresentCondition(definition.normalizedField)})`;
  }

  const [row] = await db
    .select(selectFields)
    .from(tradeRecords)
    .where(marchTradeWhere(tradeFlow));

  return row ?? {};
}

export function fieldMappingGroupLabel(group: FieldMappingGroup) {
  const labels: Record<FieldMappingGroup, string> = {
    commercial_values: "Valores comerciales",
    quantity_weight: "Cantidad y peso",
    geography_logistics: "Geografía y logística",
    hs_product: "HS y producto",
    anonymous_correlative: "Correlativos anónimos",
    provenance: "Proveniencia",
  };

  return labels[group];
}

export function fieldMappingConfidenceLabel(confidence: FieldMappingConfidence) {
  const labels: Record<FieldMappingConfidence, string> = {
    verified: "Mapeo directo",
    inferred: "Normalizado",
    needs_review: "Requiere revisión",
  };

  return labels[confidence];
}

export async function getMarch2026FieldMappingReport(
  db: DbClient,
): Promise<FieldMappingReport> {
  const [layoutFields, rawSamples, sourceContexts] = await Promise.all([
    loadLayoutFields(db),
    loadRawSamples(db),
    loadSourceContexts(db),
  ]);
  const fieldsByFlowAndName = layoutFieldMap(layoutFields);

  const rows: FieldMappingRow[] = [];

  for (const tradeFlow of ["import", "export"] satisfies TradeFlow[]) {
    const definitions = fieldMappingDefinitions.filter(
      (definition) => definition.tradeFlow === tradeFlow,
    );
    const normalizedCoverage = await loadNormalizedCoverage(db, tradeFlow, definitions);
    const totalRows = toNumber(normalizedCoverage.total);
    const sourceContext = sourceContexts.get(tradeFlow);

    for (const definition of definitions) {
      const rawSampleCoverage = rawSampleCoverageForDefinition(definition, rawSamples);
      const rawPresentRows = rawSampleCoverage.presentRows;
      const normalizedPresentRows = toNumber(normalizedCoverage[definition.id]);
      const status = fieldMappingCoverageStatus({
        confidence: definition.confidence,
        normalizedTotalRows: totalRows,
        normalizedPresentRows,
        rawFields: definition.rawFields,
        rawSampleRows: rawSampleCoverage.sampleRows,
        rawPresentRows,
      });

      rows.push({
        id: definition.id,
        tradeFlow,
        group: definition.group,
        label: definition.label,
        normalizedField: definition.normalizedField,
        rawFields: rawFieldsForDefinition(definition, fieldsByFlowAndName),
        confidence: definition.confidence,
        status,
        note: definition.note,
        totalRows,
        rawSampleRows: rawSampleCoverage.sampleRows,
        rawPresentRows,
        rawCoveragePercent: coveragePercent(rawPresentRows, rawSampleCoverage.sampleRows),
        normalizedPresentRows,
        normalizedCoveragePercent: coveragePercent(normalizedPresentRows, totalRows),
        sampleValues: sampleValuesForDefinition(definition, rawSamples),
        tradeRecordsHref: fieldMappingSearchHref(tradeFlow),
        sourceHref: sourceContext
          ? `/sources/${sourceContext.sourceFileId}#batch-${sourceContext.importBatchId}`
          : null,
        sourceLabel: sourceContext
          ? sourceDisplayFilename({
              originalFilename: sourceContext.originalFilename,
              normalizedRawFilename: sourceContext.normalizedRawFilename,
            })
          : null,
      });
    }
  }

  return {
    period: reportPeriod,
    rows,
    summary: {
      totalMappings: rows.length,
      verifiedMappings: rows.filter((row) => row.confidence === "verified").length,
      inferredMappings: rows.filter((row) => row.confidence === "inferred").length,
      reviewMappings: rows.filter((row) => row.confidence === "needs_review").length,
      warningMappings: rows.filter((row) => row.status === "warning").length,
    },
  };
}

export function fieldMappingSourceTradeHref({
  importBatchId,
  sourceFileId,
  tradeFlow,
}: {
  sourceFileId: string;
  importBatchId?: string;
  tradeFlow: TradeFlow;
}) {
  return sourceTradeRecordsHref({ sourceFileId, importBatchId, tradeFlow });
}
