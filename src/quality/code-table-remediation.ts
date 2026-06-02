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
  sourceFiles,
  sourceLayoutFields,
  sourceLayouts,
  tradeRecords,
} from "@/db/schema";
import { sourceDisplayFilename, sourceTradeRecordsHref } from "@/sources/source-provenance";
import { buildTradeRecordSearchHref } from "@/trade/trade-record-links";
import type { TradeFlow } from "@/trade/trade-records";
import {
  coveragePercent,
  normalizeCodeForCoverage,
  type DataQualityStatus,
} from "@/quality/data-quality";
import {
  countValueToNumber,
  march2026ReportPeriod,
  march2026TradeRecordsWhere,
  presentTrimmedTextCondition,
  type CountValue,
} from "@/quality/march-2026";

const reportPeriod = march2026ReportPeriod;

export type CodeTableRemediationDimension =
  | "countries"
  | "customs_offices"
  | "ports"
  | "transport_modes"
  | "quantity_units"
  | "currencies"
  | "cargo_types";

export type CodeTableRemediationPriority = "high" | "medium" | "low";

export type CodeTableRemediationFilterKind =
  | "originCountry"
  | "destinationCountry"
  | "customsOffice"
  | "port"
  | "transportMode";

type SupportedNormalizedCodeField =
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

type CodeTableRemediationDefinition = {
  id: string;
  tradeFlow: TradeFlow;
  dimension: CodeTableRemediationDimension;
  label: string;
  normalizedField: SupportedNormalizedCodeField;
  rawFields: string[];
  codeTableKey: string;
  priority: CodeTableRemediationPriority;
  filterKind?: CodeTableRemediationFilterKind;
  commercialUse: string;
  unsupportedReason?: string;
  sourceSpecialCodes?: {
    codes: string[];
    note: string;
  };
};

export type CodeTableSourceField = {
  name: string;
  ordinal: number | null;
  isCoded: boolean;
  layoutCodeTableKey: string | null;
};

export type TopUndecodedCode = {
  code: string;
  normalizedCode: string;
  records: number;
  tradeRecordsHref: string;
};

export type CodeTableSourceContext = {
  sourceFileId: string;
  importBatchId: string;
  sourceLabel: string;
  sourceHref: string;
  tradeRecordsHref: string | null;
  records: number;
};

export type CodeTableDictionaryProvenance = {
  codeTableKey: string;
  tableName: string | null;
  sourceSheetName: string | null;
  reviewStatus: string;
  sourceLabel: string | null;
  sourceHref: string | null;
};

export type CodeTableRemediationRow = {
  id: string;
  tradeFlow: TradeFlow;
  dimension: CodeTableRemediationDimension;
  label: string;
  normalizedField: SupportedNormalizedCodeField;
  sourceFields: CodeTableSourceField[];
  codeTableKey: string;
  codeTableFound: boolean;
  priority: CodeTableRemediationPriority;
  status: DataQualityStatus;
  distinctCodes: number;
  decodedCodes: number;
  undecodedCodes: number;
  recordsWithCode: number;
  recordsWithDecodedCode: number;
  recordsWithSpecialSourceCode: number;
  recordsWithUndecodedCode: number;
  decodedPercent: number;
  topUndecodedCodes: TopUndecodedCode[];
  sourceSpecialCodeNote: string | null;
  sourceContext: CodeTableSourceContext | null;
  dictionaryProvenance: CodeTableDictionaryProvenance | null;
  fieldMappingHref: string;
  tradeRecordsHref: string;
  nextAction: string;
  commercialUse: string;
  unsupportedReason: string | null;
};

export type CodeTableRemediationReport = {
  period: typeof reportPeriod;
  rows: CodeTableRemediationRow[];
  summary: {
    totalDimensions: number;
    highPriorityGaps: number;
    mediumPriorityGaps: number;
    lowPriorityGaps: number;
    recordsWithUndecodedCodes: number;
  };
};

export type CodeTableCodeCountInput = {
  code: string | null;
  records: number | string | null | undefined;
};

type SourceCountRow = {
  sourceFileId: string;
  importBatchId: string;
  originalFilename: string;
  normalizedRawFilename: string | null;
  records: CountValue;
};

type LayoutFieldRow = {
  tradeFlow: string | null;
  sourceFieldName: string;
  fieldOrdinal: number;
  isCoded: boolean;
  codeTableKey: string | null;
};

type DictionaryRow = {
  codeTableKey: string;
  tableName: string | null;
  sourceSheetName: string | null;
  reviewStatus: string;
  sourceFileId: string | null;
  originalFilename: string | null;
  normalizedRawFilename: string | null;
};

const remediationDefinitions: CodeTableRemediationDefinition[] = [
  {
    id: "import_origin_country",
    tradeFlow: "import",
    dimension: "countries",
    label: "País de origen importación",
    normalizedField: "originCountryCode",
    rawFields: ["PA_ORIG"],
    codeTableKey: "chile_aduana:paises",
    priority: "high",
    filterKind: "originCountry",
    commercialUse: "Filtro y ranking comercial principal para importaciones.",
  },
  {
    id: "import_acquisition_country",
    tradeFlow: "import",
    dimension: "countries",
    label: "País de adquisición importación",
    normalizedField: "acquisitionCountryCode",
    rawFields: ["PA_ADQ"],
    codeTableKey: "chile_aduana:paises",
    priority: "medium",
    commercialUse: "Contexto comercial adicional; no reemplaza país de origen.",
    unsupportedReason: "Aún no tiene filtro dedicado en /trade-records.",
  },
  {
    id: "import_consignment_country",
    tradeFlow: "import",
    dimension: "countries",
    label: "País de consignación importación",
    normalizedField: "consignmentCountryCode",
    rawFields: ["CODPAISCON"],
    codeTableKey: "chile_aduana:paises",
    priority: "medium",
    commercialUse: "Contexto logístico y documental para importaciones.",
    unsupportedReason: "Aún no tiene filtro dedicado en /trade-records.",
  },
  {
    id: "export_destination_country",
    tradeFlow: "export",
    dimension: "countries",
    label: "País de destino exportación",
    normalizedField: "destinationCountryCode",
    rawFields: ["PAISDESTINO"],
    codeTableKey: "chile_aduana:paises",
    priority: "high",
    filterKind: "destinationCountry",
    commercialUse: "Filtro y ranking comercial principal para exportaciones.",
  },
  {
    id: "import_customs_office",
    tradeFlow: "import",
    dimension: "customs_offices",
    label: "Aduana importación",
    normalizedField: "customsOfficeCode",
    rawFields: ["ADU"],
    codeTableKey: "chile_aduana:aduanas",
    priority: "high",
    filterKind: "customsOffice",
    commercialUse: "Filtro, resumen y contexto operativo de importaciones.",
  },
  {
    id: "export_customs_office",
    tradeFlow: "export",
    dimension: "customs_offices",
    label: "Aduana exportación",
    normalizedField: "customsOfficeCode",
    rawFields: ["ADUANA"],
    codeTableKey: "chile_aduana:aduanas",
    priority: "high",
    filterKind: "customsOffice",
    commercialUse: "Filtro, resumen y contexto operativo de exportaciones.",
  },
  {
    id: "import_disembark_port",
    tradeFlow: "import",
    dimension: "ports",
    label: "Puerto relevante importación",
    normalizedField: "disembarkPortCode",
    rawFields: ["PTO_DESEM"],
    codeTableKey: "chile_aduana:puertos",
    priority: "high",
    filterKind: "port",
    commercialUse: "Puerto de llegada usado por el filtro de puerto relevante.",
  },
  {
    id: "import_embark_port",
    tradeFlow: "import",
    dimension: "ports",
    label: "Puerto de embarque importación",
    normalizedField: "embarkPortCode",
    rawFields: ["PTO_EMB"],
    codeTableKey: "chile_aduana:puertos",
    priority: "low",
    commercialUse: "Campo logístico secundario para importaciones.",
    unsupportedReason: "El filtro de puerto usa desembarque como puerto relevante en importación.",
  },
  {
    id: "export_embark_port",
    tradeFlow: "export",
    dimension: "ports",
    label: "Puerto relevante exportación",
    normalizedField: "embarkPortCode",
    rawFields: ["PUERTOEMB"],
    codeTableKey: "chile_aduana:puertos",
    priority: "high",
    filterKind: "port",
    commercialUse: "Puerto de salida usado por el filtro de puerto relevante.",
    sourceSpecialCodes: {
      codes: ["0"],
      note: "Código 0 aparece en DUS como puerto sin glosa, principalmente junto a vía 0 y registros de servicios; se conserva como código fuente, no como brecha de diccionario accionable.",
    },
  },
  {
    id: "export_disembark_port",
    tradeFlow: "export",
    dimension: "ports",
    label: "Puerto de desembarque exportación",
    normalizedField: "disembarkPortCode",
    rawFields: ["PUERTODESEMB"],
    codeTableKey: "chile_aduana:puertos",
    priority: "low",
    commercialUse: "Campo logístico secundario para exportaciones.",
    unsupportedReason: "El filtro de puerto usa embarque como puerto relevante en exportación.",
  },
  {
    id: "import_transport_mode",
    tradeFlow: "import",
    dimension: "transport_modes",
    label: "Vía de transporte importación",
    normalizedField: "transportModeCode",
    rawFields: ["VIA_TRAN"],
    codeTableKey: "chile_aduana:vias_de_transporte",
    priority: "high",
    filterKind: "transportMode",
    commercialUse: "Filtro y contexto logístico principal de importaciones.",
  },
  {
    id: "export_transport_mode",
    tradeFlow: "export",
    dimension: "transport_modes",
    label: "Vía de transporte exportación",
    normalizedField: "transportModeCode",
    rawFields: ["VIATRANSPORTE"],
    codeTableKey: "chile_aduana:vias_de_transporte",
    priority: "high",
    filterKind: "transportMode",
    commercialUse: "Filtro y contexto logístico principal de exportaciones.",
    sourceSpecialCodes: {
      codes: ["0"],
      note: "Código 0 aparece en DUS para registros sin vía aplicable o sin logística física clara; se conserva como código fuente, no como valor a agregar al diccionario sin evidencia oficial.",
    },
  },
  {
    id: "import_quantity_unit",
    tradeFlow: "import",
    dimension: "quantity_units",
    label: "Unidad de medida importación",
    normalizedField: "quantityUnitCode",
    rawFields: ["MEDIDA"],
    codeTableKey: "chile_aduana:unidades_de_medida",
    priority: "medium",
    commercialUse: "Define si cantidades y precios unitarios son comparables.",
    unsupportedReason: "Aún no tiene filtro dedicado en /trade-records.",
  },
  {
    id: "export_quantity_unit",
    tradeFlow: "export",
    dimension: "quantity_units",
    label: "Unidad de medida exportación",
    normalizedField: "quantityUnitCode",
    rawFields: ["UNIDADMEDIDA"],
    codeTableKey: "chile_aduana:unidades_de_medida",
    priority: "medium",
    commercialUse: "Define si cantidades y precios unitarios son comparables.",
    unsupportedReason: "Aún no tiene filtro dedicado en /trade-records.",
  },
  {
    id: "import_currency",
    tradeFlow: "import",
    dimension: "currencies",
    label: "Moneda importación",
    normalizedField: "currencyCodeRaw",
    rawFields: ["MONEDA"],
    codeTableKey: "chile_aduana:moneda",
    priority: "medium",
    commercialUse: "Ayuda a interpretar valores y precios unitarios.",
    unsupportedReason: "Aún no tiene filtro dedicado en /trade-records.",
  },
  {
    id: "export_currency",
    tradeFlow: "export",
    dimension: "currencies",
    label: "Moneda exportación",
    normalizedField: "currencyCodeRaw",
    rawFields: ["MONEDA"],
    codeTableKey: "chile_aduana:moneda",
    priority: "medium",
    commercialUse: "Ayuda a interpretar valores y precios unitarios.",
    unsupportedReason: "Aún no tiene filtro dedicado en /trade-records.",
  },
  {
    id: "import_cargo_type",
    tradeFlow: "import",
    dimension: "cargo_types",
    label: "Tipo de carga importación",
    normalizedField: "cargoTypeCode",
    rawFields: ["TPO_CARGA"],
    codeTableKey: "chile_aduana:tipos_de_carga",
    priority: "low",
    commercialUse: "Contexto logístico secundario para el MVP actual.",
    unsupportedReason: "Actualmente no es filtro ni ranking principal.",
  },
  {
    id: "export_cargo_type",
    tradeFlow: "export",
    dimension: "cargo_types",
    label: "Tipo de carga exportación",
    normalizedField: "cargoTypeCode",
    rawFields: ["TIPOCARGA"],
    codeTableKey: "chile_aduana:tipos_de_carga",
    priority: "low",
    commercialUse: "Contexto logístico secundario para el MVP actual.",
    unsupportedReason: "Actualmente no es filtro ni ranking principal.",
  },
];

const toNumber = countValueToNumber;
const marchTradeWhere = march2026TradeRecordsWhere;
const presentCondition = presentTrimmedTextCondition;

function codeExpression(field: SupportedNormalizedCodeField): SQL<string> {
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

export function codeTableRemediationPriorityRank(
  priority: CodeTableRemediationPriority,
) {
  const ranks: Record<CodeTableRemediationPriority, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };

  return ranks[priority];
}

export function codeTableRemediationStatus({
  codeTableFound = true,
  decodedCodes,
  distinctCodes,
  priority,
  recordsWithCode = 0,
}: {
  codeTableFound?: boolean;
  decodedCodes: number;
  distinctCodes: number;
  priority: CodeTableRemediationPriority;
  recordsWithCode?: number;
}): DataQualityStatus {
  if (!codeTableFound && recordsWithCode > 0) {
    return priority === "high" ? "warning" : "review";
  }

  if (distinctCodes <= 0) {
    return "review";
  }

  if (decodedCodes === distinctCodes) {
    return "ok";
  }

  return priority === "high" ? "warning" : "review";
}

export function codeTableRemediationNextAction({
  codeTableKey,
  codeTableFound = true,
  priority,
  recordsWithUndecodedCode,
  recordsWithSpecialSourceCode = 0,
  sourceSpecialCodeNote,
  unsupportedReason,
}: {
  codeTableKey: string;
  codeTableFound?: boolean;
  priority: CodeTableRemediationPriority;
  recordsWithUndecodedCode: number;
  recordsWithSpecialSourceCode?: number;
  sourceSpecialCodeNote?: string | null;
  unsupportedReason?: string;
}) {
  if (!codeTableFound && recordsWithUndecodedCode > 0) {
    return `Confirmar si la tabla oficial ${codeTableKey} fue cargada o si el campo fuente usa otro diccionario; no corregir valores sin evidencia oficial.`;
  }

  if (recordsWithUndecodedCode === 0) {
    if (recordsWithSpecialSourceCode > 0 && sourceSpecialCodeNote) {
      return `Sin brecha de etiqueta accionable para los códigos restantes. ${sourceSpecialCodeNote}`;
    }

    return unsupportedReason
      ? `Sin brecha de etiqueta detectada; mantener como contexto. ${unsupportedReason}`
      : "Sin brecha de etiqueta detectada en marzo 2026.";
  }

  const specialSuffix = recordsWithSpecialSourceCode > 0 && sourceSpecialCodeNote
    ? ` Mantener separado el valor especial: ${sourceSpecialCodeNote}`
    : "";

  if (priority === "high") {
    return `Priorizar contraste con diccionario/código oficial ${codeTableKey}; afecta filtros o rankings visibles.${specialSuffix}`;
  }

  if (priority === "medium") {
    return `Revisar ${codeTableKey} antes de comparar unidades, moneda o valores agregados.${specialSuffix}`;
  }

  return `Registrar brecha para limpieza posterior; impacto bajo en el MVP actual.${specialSuffix}`;
}

export function codeTableRemediationHref({
  code,
  definition,
}: {
  code?: string;
  definition: {
    filterKind?: CodeTableRemediationFilterKind;
    tradeFlow: TradeFlow;
  };
}) {
  const params: Record<string, string> = {
    tradeFlow: definition.tradeFlow,
    periodYear: String(reportPeriod.year),
    periodMonth: String(reportPeriod.month),
    limit: "25",
  };

  if (code && definition.filterKind) {
    params[definition.filterKind] = code;
  }

  return buildTradeRecordSearchHref(params);
}

export function codeTableTopUndecodedCodes({
  codeRows,
  codeSet,
  definition,
  ignoredSourceCodes = new Set<string>(),
  limit = 5,
}: {
  codeRows: CodeTableCodeCountInput[];
  codeSet: Set<string>;
  definition: {
    filterKind?: CodeTableRemediationFilterKind;
    tradeFlow: TradeFlow;
  };
  ignoredSourceCodes?: Set<string>;
  limit?: number;
}): TopUndecodedCode[] {
  const undecoded = new Map<string, TopUndecodedCode>();

  for (const row of codeRows) {
    const records = toNumber(row.records);
    const normalizedCode = normalizeCodeForCoverage(row.code);
    if (!normalizedCode || codeSet.has(normalizedCode) || ignoredSourceCodes.has(normalizedCode)) {
      continue;
    }

    const displayCode = row.code?.trim() || normalizedCode;
    const existing = undecoded.get(normalizedCode);
    if (existing) {
      existing.records += records;
      continue;
    }

    undecoded.set(normalizedCode, {
      code: displayCode,
      normalizedCode,
      records,
      tradeRecordsHref: codeTableRemediationHref({
        code: displayCode,
        definition,
      }),
    });
  }

  return [...undecoded.values()]
    .sort((a, b) => b.records - a.records || a.normalizedCode.localeCompare(b.normalizedCode))
    .slice(0, limit);
}

function decodedCodeSet(rows: Array<{ codeValue: string; labelEs: string | null }>) {
  const values = new Set<string>();

  for (const row of rows) {
    const normalizedCode = normalizeCodeForCoverage(row.codeValue);
    if (normalizedCode && row.labelEs?.trim()) {
      values.add(normalizedCode);
    }
  }

  return values;
}

function sourceFieldsForDefinition(
  definition: CodeTableRemediationDefinition,
  layoutFields: LayoutFieldRow[],
): CodeTableSourceField[] {
  return definition.rawFields.map((fieldName) => {
    const field = layoutFields.find(
      (row) => row.tradeFlow === definition.tradeFlow && row.sourceFieldName === fieldName,
    );

    return {
      name: fieldName,
      ordinal: field?.fieldOrdinal ?? null,
      isCoded: field?.isCoded ?? false,
      layoutCodeTableKey: field?.codeTableKey ?? null,
    };
  });
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

async function loadCodeTableValues(db: DbClient) {
  const keys = [...new Set(remediationDefinitions.map((definition) => definition.codeTableKey))];
  const rows = await db
    .select({
      codeTableKey: codeTables.codeTableKey,
      codeValue: codeValues.codeValue,
      labelEs: codeValues.labelEs,
    })
    .from(codeValues)
    .innerJoin(codeTables, eq(codeValues.codeTableId, codeTables.id))
    .where(inArray(codeTables.codeTableKey, keys));

  const rowsByKey = new Map<string, Array<{ codeValue: string; labelEs: string | null }>>();
  for (const row of rows) {
    const existing = rowsByKey.get(row.codeTableKey) ?? [];
    existing.push({ codeValue: row.codeValue, labelEs: row.labelEs });
    rowsByKey.set(row.codeTableKey, existing);
  }

  return rowsByKey;
}

async function loadDictionaryProvenance(db: DbClient) {
  const keys = [...new Set(remediationDefinitions.map((definition) => definition.codeTableKey))];
  const rows = await db
    .select({
      codeTableKey: codeTables.codeTableKey,
      tableName: codeTables.tableName,
      sourceSheetName: codeTables.sourceSheetName,
      reviewStatus: codeTables.reviewStatus,
      sourceFileId: codeTables.sourceFileId,
      originalFilename: sourceFiles.originalFilename,
      normalizedRawFilename: sourceFiles.normalizedRawFilename,
    })
    .from(codeTables)
    .leftJoin(sourceFiles, eq(codeTables.sourceFileId, sourceFiles.id))
    .where(inArray(codeTables.codeTableKey, keys));

  return new Map(rows.map((row) => [row.codeTableKey, row]));
}

async function codeCountsForDefinition(
  db: DbClient,
  definition: CodeTableRemediationDefinition,
) {
  const expression = codeExpression(definition.normalizedField);

  return db
    .select({
      code: expression,
      records: count(),
    })
    .from(tradeRecords)
    .where(and(marchTradeWhere(definition.tradeFlow), presentCondition(expression)))
    .groupBy(expression);
}

async function sourceContextForDefinition(
  db: DbClient,
  definition: CodeTableRemediationDefinition,
) {
  const expression = codeExpression(definition.normalizedField);
  const [row] = await db
    .select({
      sourceFileId: tradeRecords.sourceFileId,
      importBatchId: tradeRecords.importBatchId,
      originalFilename: sourceFiles.originalFilename,
      normalizedRawFilename: sourceFiles.normalizedRawFilename,
      records: count(),
    })
    .from(tradeRecords)
    .innerJoin(sourceFiles, eq(tradeRecords.sourceFileId, sourceFiles.id))
    .where(and(marchTradeWhere(definition.tradeFlow), presentCondition(expression)))
    .groupBy(
      tradeRecords.sourceFileId,
      tradeRecords.importBatchId,
      sourceFiles.originalFilename,
      sourceFiles.normalizedRawFilename,
    )
    .orderBy(desc(count()))
    .limit(1);

  return row;
}

function dictionaryProvenanceFromRow(
  row: DictionaryRow | undefined,
): CodeTableDictionaryProvenance | null {
  if (!row) {
    return null;
  }

  return {
    codeTableKey: row.codeTableKey,
    tableName: row.tableName,
    sourceSheetName: row.sourceSheetName,
    reviewStatus: row.reviewStatus,
    sourceLabel: row.originalFilename
      ? sourceDisplayFilename({
          originalFilename: row.originalFilename,
          normalizedRawFilename: row.normalizedRawFilename,
        })
      : null,
    sourceHref: row.sourceFileId ? `/sources/${row.sourceFileId}` : null,
  };
}

function sourceContextFromRow(
  row: SourceCountRow | undefined,
  tradeFlow: TradeFlow,
): CodeTableSourceContext | null {
  if (!row) {
    return null;
  }

  return {
    sourceFileId: row.sourceFileId,
    importBatchId: row.importBatchId,
    sourceLabel: sourceDisplayFilename({
      originalFilename: row.originalFilename,
      normalizedRawFilename: row.normalizedRawFilename,
    }),
    sourceHref: `/sources/${row.sourceFileId}#batch-${row.importBatchId}`,
    tradeRecordsHref: sourceTradeRecordsHref({
      sourceFileId: row.sourceFileId,
      importBatchId: row.importBatchId,
      tradeFlow,
    }),
    records: toNumber(row.records),
  };
}

function remediationRowFromCounts({
  codeRows,
  codeSet,
  definition,
  dictionaryProvenance,
  layoutFields,
  sourceContext,
}: {
  codeRows: CodeTableCodeCountInput[];
  codeSet: Set<string>;
  definition: CodeTableRemediationDefinition;
  dictionaryProvenance: CodeTableDictionaryProvenance | null;
  layoutFields: LayoutFieldRow[];
  sourceContext: CodeTableSourceContext | null;
}): CodeTableRemediationRow {
  let decodedCodes = 0;
  let recordsWithCode = 0;
  let recordsWithDecodedCode = 0;
  let recordsWithSpecialSourceCode = 0;
  const specialCodeSet = new Set(
    (definition.sourceSpecialCodes?.codes ?? [])
      .map((code) => normalizeCodeForCoverage(code))
      .filter((code): code is string => Boolean(code)),
  );

  for (const row of codeRows) {
    const records = toNumber(row.records);
    recordsWithCode += records;
    const normalizedCode = normalizeCodeForCoverage(row.code);
    if (!normalizedCode) {
      continue;
    }

    if (specialCodeSet.has(normalizedCode)) {
      recordsWithSpecialSourceCode += records;
      continue;
    }

    if (codeSet.has(normalizedCode)) {
      decodedCodes += 1;
      recordsWithDecodedCode += records;
    }
  }

  const topUndecodedCodes = codeTableTopUndecodedCodes({
    codeRows,
    codeSet,
    definition,
    ignoredSourceCodes: specialCodeSet,
  });
  const distinctCodes = codeRows.filter((row) => {
    const normalizedCode = normalizeCodeForCoverage(row.code);
    return normalizedCode ? !specialCodeSet.has(normalizedCode) : true;
  }).length;
  const undecodedCodeSet = codeRows.reduce((set, row) => {
    const normalizedCode = normalizeCodeForCoverage(row.code);
    if (normalizedCode && !codeSet.has(normalizedCode) && !specialCodeSet.has(normalizedCode)) {
      set.add(normalizedCode);
    }
    return set;
  }, new Set<string>());
  const undecodedCodes = undecodedCodeSet.size;
  const recordsWithUndecodedCode =
    recordsWithCode - recordsWithDecodedCode - recordsWithSpecialSourceCode;
  const codeTableFound = dictionaryProvenance !== null;
  const status = codeTableRemediationStatus({
    codeTableFound,
    decodedCodes,
    distinctCodes,
    priority: definition.priority,
    recordsWithCode,
  });

  return {
    id: definition.id,
    tradeFlow: definition.tradeFlow,
    dimension: definition.dimension,
    label: definition.label,
    normalizedField: definition.normalizedField,
    sourceFields: sourceFieldsForDefinition(definition, layoutFields),
    codeTableKey: definition.codeTableKey,
    codeTableFound,
    priority: definition.priority,
    status,
    distinctCodes,
    decodedCodes,
    undecodedCodes,
    recordsWithCode,
    recordsWithDecodedCode,
    recordsWithSpecialSourceCode,
    recordsWithUndecodedCode,
    decodedPercent: coveragePercent(
      recordsWithDecodedCode,
      recordsWithCode - recordsWithSpecialSourceCode,
    ),
    topUndecodedCodes,
    sourceSpecialCodeNote: definition.sourceSpecialCodes?.note ?? null,
    sourceContext,
    dictionaryProvenance,
    fieldMappingHref: "/data-quality/field-mapping",
    tradeRecordsHref: codeTableRemediationHref({ definition }),
    nextAction: codeTableRemediationNextAction({
      codeTableKey: definition.codeTableKey,
      codeTableFound,
      priority: definition.priority,
      recordsWithUndecodedCode,
      recordsWithSpecialSourceCode,
      sourceSpecialCodeNote: definition.sourceSpecialCodes?.note,
      unsupportedReason: definition.unsupportedReason,
    }),
    commercialUse: definition.commercialUse,
    unsupportedReason: definition.unsupportedReason ?? null,
  };
}

export function codeTableRemediationDimensionLabel(
  dimension: CodeTableRemediationDimension,
) {
  const labels: Record<CodeTableRemediationDimension, string> = {
    countries: "Países",
    customs_offices: "Aduanas",
    ports: "Puertos",
    transport_modes: "Vías de transporte",
    quantity_units: "Unidades de medida",
    currencies: "Monedas",
    cargo_types: "Tipos de carga",
  };

  return labels[dimension];
}

export function codeTableRemediationPriorityLabel(
  priority: CodeTableRemediationPriority,
) {
  const labels: Record<CodeTableRemediationPriority, string> = {
    high: "Alta",
    medium: "Media",
    low: "Baja",
  };

  return labels[priority];
}

export async function getMarch2026CodeTableRemediationReport(
  db: DbClient,
): Promise<CodeTableRemediationReport> {
  const [layoutFields, codeValuesByKey, dictionaryRows] = await Promise.all([
    loadLayoutFields(db),
    loadCodeTableValues(db),
    loadDictionaryProvenance(db),
  ]);

  const rows = await Promise.all(
    remediationDefinitions.map(async (definition) => {
      const [codeRows, sourceRow] = await Promise.all([
        codeCountsForDefinition(db, definition),
        sourceContextForDefinition(db, definition),
      ]);
      const codeSet = decodedCodeSet(codeValuesByKey.get(definition.codeTableKey) ?? []);

      return remediationRowFromCounts({
        codeRows,
        codeSet,
        definition,
        dictionaryProvenance: dictionaryProvenanceFromRow(
          dictionaryRows.get(definition.codeTableKey),
        ),
        layoutFields,
        sourceContext: sourceContextFromRow(sourceRow, definition.tradeFlow),
      });
    }),
  );

  const sortedRows = rows.sort((a, b) => {
    const priorityDelta =
      codeTableRemediationPriorityRank(a.priority) -
      codeTableRemediationPriorityRank(b.priority);
    if (priorityDelta !== 0) {
      return priorityDelta;
    }

    if (a.recordsWithUndecodedCode !== b.recordsWithUndecodedCode) {
      return b.recordsWithUndecodedCode - a.recordsWithUndecodedCode;
    }

    return a.label.localeCompare(b.label);
  });

  return {
    period: reportPeriod,
    rows: sortedRows,
    summary: {
      totalDimensions: sortedRows.length,
      highPriorityGaps: sortedRows.filter(
        (row) => row.priority === "high" && row.recordsWithUndecodedCode > 0,
      ).length,
      mediumPriorityGaps: sortedRows.filter(
        (row) => row.priority === "medium" && row.recordsWithUndecodedCode > 0,
      ).length,
      lowPriorityGaps: sortedRows.filter(
        (row) => row.priority === "low" && row.recordsWithUndecodedCode > 0,
      ).length,
      recordsWithUndecodedCodes: sortedRows.reduce(
        (total, row) => total + row.recordsWithUndecodedCode,
        0,
      ),
    },
  };
}
