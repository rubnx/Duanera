import type { TradeRecordFilters } from "./trade-records";

export type TradeRecordPresetCategory =
  | "value"
  | "product"
  | "geography"
  | "logistics";

export type TradeRecordPresetParams = {
  tradeFlow: "import" | "export";
  periodFrom?: string;
  periodTo?: string;
  hsCodePrefix?: string;
  q?: string;
  originCountry?: string;
  destinationCountry?: string;
  customsOffice?: string;
  exporter?: string;
  importBatchId?: string;
  importer?: string;
  transportMode?: string;
  embarkPort?: string;
  disembarkPort?: string;
  minItemValue?: string;
  maxItemValue?: string;
  minDeclarationFob?: string;
  maxDeclarationFob?: string;
  minQuantity?: string;
  maxQuantity?: string;
  minGrossWeightItem?: string;
  maxGrossWeightItem?: string;
  minGrossWeightTotal?: string;
  maxGrossWeightTotal?: string;
  sourceFileId?: string;
  sort?: string;
  limit?: string;
};

export type TradeRecordPreset = {
  id: string;
  category: TradeRecordPresetCategory;
  title: string;
  description: string;
  params: TradeRecordPresetParams;
};

export type TradeRecordPresetDefaultPeriod = {
  periodFrom: string;
  periodTo: string;
};

export const tradeRecordPresetCategories: Array<{
  id: TradeRecordPresetCategory;
  label: string;
}> = [
  { id: "value", label: "Valor" },
  { id: "product", label: "Producto / HS" },
  { id: "geography", label: "Países" },
  { id: "logistics", label: "Logística" },
];

export const tradeRecordPresets: TradeRecordPreset[] = [
  {
    id: "high-value-imports",
    category: "value",
    title: "Importaciones de alto valor",
    description: "Items importados con CIF item alto, ordenados por mayor valor.",
    params: {
      tradeFlow: "import",
      minItemValue: "50000",
      sort: "item_value_desc",
      limit: "25",
    },
  },
  {
    id: "high-value-exports",
    category: "value",
    title: "Exportaciones de alto valor",
    description: "Items exportados con FOB item alto, ordenados por mayor valor.",
    params: {
      tradeFlow: "export",
      minItemValue: "50000",
      sort: "item_value_desc",
      limit: "25",
    },
  },
  {
    id: "beef-imports",
    category: "product",
    title: "Carne bovina importada",
    description: "Partida HS 020130 para comparar origen, aduana, puerto y valores.",
    params: {
      tradeFlow: "import",
      hsCodePrefix: "020130",
      sort: "item_value_desc",
      limit: "25",
    },
  },
  {
    id: "tyre-exports",
    category: "product",
    title: "Neumáticos exportados",
    description: "Partida HS 401110 en exportaciones, útil para revisar destinos y FOB.",
    params: {
      tradeFlow: "export",
      hsCodePrefix: "401110",
      sort: "item_value_desc",
      limit: "25",
    },
  },
  {
    id: "brazil-origin-imports",
    category: "geography",
    title: "Importaciones desde Brasil",
    description: "Vista de origen Brasil para revisar productos, puertos y aduanas.",
    params: {
      tradeFlow: "import",
      originCountry: "220",
      sort: "item_value_desc",
      limit: "25",
    },
  },
  {
    id: "us-destination-exports",
    category: "geography",
    title: "Exportaciones a Estados Unidos",
    description: "Vista de destino Estados Unidos para comparar productos y puertos.",
    params: {
      tradeFlow: "export",
      destinationCountry: "225",
      sort: "item_value_desc",
      limit: "25",
    },
  },
  {
    id: "los-libertadores-imports",
    category: "logistics",
    title: "Importaciones Los Libertadores",
    description: "Puerto de desembarque 965 para revisar carga y aduanas asociadas.",
    params: {
      tradeFlow: "import",
      disembarkPort: "965",
      sort: "gross_weight_desc",
      limit: "25",
    },
  },
  {
    id: "maritime-imports",
    category: "logistics",
    title: "Importaciones vía marítima",
    description: "Vía de transporte marítima/fluvial/lacustre, ordenada por peso bruto.",
    params: {
      tradeFlow: "import",
      transportMode: "1",
      sort: "gross_weight_desc",
      limit: "25",
    },
  },
];

const presetParamKeys = [
  "tradeFlow",
  "periodFrom",
  "periodTo",
  "hsCodePrefix",
  "q",
  "originCountry",
  "destinationCountry",
  "customsOffice",
  "importer",
  "exporter",
  "transportMode",
  "embarkPort",
  "disembarkPort",
  "minItemValue",
  "maxItemValue",
  "minDeclarationFob",
  "maxDeclarationFob",
  "minQuantity",
  "maxQuantity",
  "minGrossWeightItem",
  "maxGrossWeightItem",
  "minGrossWeightTotal",
  "maxGrossWeightTotal",
  "sourceFileId",
  "importBatchId",
  "sort",
  "limit",
] as const;

type PresetParamKey = (typeof presetParamKeys)[number];

function setIfPresent(query: URLSearchParams, key: PresetParamKey, value: string | undefined) {
  const trimmed = value?.trim();
  if (trimmed) {
    query.set(key, trimmed);
  }
}

function presetValueForKey(
  preset: TradeRecordPreset,
  key: PresetParamKey,
  defaultPeriod?: TradeRecordPresetDefaultPeriod,
) {
  if (key === "periodFrom" && !preset.params.periodFrom) {
    return defaultPeriod?.periodFrom;
  }

  if (key === "periodTo" && !preset.params.periodTo) {
    return defaultPeriod?.periodTo;
  }

  return preset.params[key];
}

export function buildTradeRecordPresetHref(
  preset: TradeRecordPreset,
  defaultPeriod?: TradeRecordPresetDefaultPeriod,
) {
  const query = new URLSearchParams();

  for (const key of presetParamKeys) {
    setIfPresent(query, key, presetValueForKey(preset, key, defaultPeriod));
  }

  return `/trade-records?${query.toString()}`;
}

function filterValueForPresetKey(
  filters: TradeRecordFilters,
  key: PresetParamKey,
): string | undefined {
  switch (key) {
    case "tradeFlow":
      return filters.tradeFlow;
    case "periodFrom":
      return filters.periodFrom;
    case "periodTo":
      return filters.periodTo;
    case "hsCodePrefix":
      return filters.hsCodePrefix;
    case "q":
      return filters.productQuery;
    case "originCountry":
      return filters.originCountryCode;
    case "destinationCountry":
      return filters.destinationCountryCode;
    case "customsOffice":
      return filters.customsOfficeCode;
    case "importer":
      return filters.importerCorrelativeId;
    case "exporter":
      return filters.exporterCorrelativeId;
    case "transportMode":
      return filters.transportModeCode;
    case "embarkPort":
      return filters.embarkPortCode;
    case "disembarkPort":
      return filters.disembarkPortCode;
    case "minItemValue":
      return filters.minItemValue;
    case "maxItemValue":
      return filters.maxItemValue;
    case "minDeclarationFob":
      return filters.minDeclarationFob;
    case "maxDeclarationFob":
      return filters.maxDeclarationFob;
    case "minQuantity":
      return filters.minQuantity;
    case "maxQuantity":
      return filters.maxQuantity;
    case "minGrossWeightItem":
      return filters.minGrossWeightItem;
    case "maxGrossWeightItem":
      return filters.maxGrossWeightItem;
    case "minGrossWeightTotal":
      return filters.minGrossWeightTotal;
    case "maxGrossWeightTotal":
      return filters.maxGrossWeightTotal;
    case "sourceFileId":
      return filters.sourceFileId;
    case "importBatchId":
      return filters.importBatchId;
    case "sort":
      return filters.sort;
    case "limit":
      return filters.limit ? String(filters.limit) : undefined;
  }
}

export function activeTradeRecordPresetId(
  filters: TradeRecordFilters,
  defaultPeriod?: TradeRecordPresetDefaultPeriod,
) {
  for (const preset of tradeRecordPresets) {
    const matches = presetParamKeys.every((key) => {
      const presetValue = presetValueForKey(preset, key, defaultPeriod);
      const filterValue = filterValueForPresetKey(filters, key);

      return presetValue ? filterValue === presetValue : !filterValue;
    });

    if (matches) {
      return preset.id;
    }
  }

  return null;
}
