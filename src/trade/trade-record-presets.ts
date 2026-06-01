import type { TradeRecordFilters } from "./trade-records";

export type TradeRecordPresetCategory =
  | "value"
  | "product"
  | "geography"
  | "logistics";

export type TradeRecordPresetParams = {
  tradeFlow: "import" | "export";
  periodFrom: string;
  periodTo: string;
  hsCodePrefix?: string;
  q?: string;
  originCountry?: string;
  destinationCountry?: string;
  customsOffice?: string;
  exporter?: string;
  importBatchId?: string;
  importer?: string;
  transportMode?: string;
  port?: string;
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
      periodFrom: "2026-03",
      periodTo: "2026-03",
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
      periodFrom: "2026-03",
      periodTo: "2026-03",
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
      periodFrom: "2026-03",
      periodTo: "2026-03",
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
      periodFrom: "2026-03",
      periodTo: "2026-03",
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
      periodFrom: "2026-03",
      periodTo: "2026-03",
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
      periodFrom: "2026-03",
      periodTo: "2026-03",
      destinationCountry: "225",
      sort: "item_value_desc",
      limit: "25",
    },
  },
  {
    id: "los-libertadores-imports",
    category: "logistics",
    title: "Importaciones Los Libertadores",
    description: "Puerto relevante 965 para revisar carga y aduanas asociadas.",
    params: {
      tradeFlow: "import",
      periodFrom: "2026-03",
      periodTo: "2026-03",
      port: "965",
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
      periodFrom: "2026-03",
      periodTo: "2026-03",
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
  "port",
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

export function buildTradeRecordPresetHref(preset: TradeRecordPreset) {
  const query = new URLSearchParams();

  for (const key of presetParamKeys) {
    setIfPresent(query, key, preset.params[key]);
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
    case "port":
      return filters.portCode;
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

export function activeTradeRecordPresetId(filters: TradeRecordFilters) {
  for (const preset of tradeRecordPresets) {
    const matches = presetParamKeys.every((key) => {
      const presetValue = preset.params[key];
      const filterValue = filterValueForPresetKey(filters, key);

      return presetValue ? filterValue === presetValue : !filterValue;
    });

    if (matches) {
      return preset.id;
    }
  }

  return null;
}
