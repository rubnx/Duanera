import type { TradeFlow } from "@/trade/trade-records";
import type { SupportedNormalizedCodeField } from "@/quality/code-table-remediation-fields";

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
  | "embarkPort"
  | "disembarkPort"
  | "transportMode";

export type CodeTableRemediationDefinition = {
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

export const remediationDefinitions: CodeTableRemediationDefinition[] = [
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
    label: "Puerto de desembarque importación",
    normalizedField: "disembarkPortCode",
    rawFields: ["PTO_DESEM"],
    codeTableKey: "chile_aduana:puertos",
    priority: "high",
    filterKind: "disembarkPort",
    commercialUse: "Puerto de llegada usado por el filtro de puerto de desembarque.",
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
    filterKind: "embarkPort",
    commercialUse: "Campo logístico secundario para importaciones.",
  },
  {
    id: "export_embark_port",
    tradeFlow: "export",
    dimension: "ports",
    label: "Puerto de embarque exportación",
    normalizedField: "embarkPortCode",
    rawFields: ["PUERTOEMB"],
    codeTableKey: "chile_aduana:puertos",
    priority: "high",
    filterKind: "embarkPort",
    commercialUse: "Puerto de salida usado por el filtro de puerto de embarque.",
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
    filterKind: "disembarkPort",
    commercialUse: "Campo logístico secundario para exportaciones.",
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
