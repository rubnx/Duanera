import type { TradeFlow } from "@/trade/trade-records";

type FlowLabelVariant = "plural" | "singular";

type FlowField = {
  label: string;
  name: string;
};

export type TradeFlowUiConfig = {
  flow: TradeFlow;
  countryFilter: FlowField;
  grossWeightFilters: Array<FlowField & { maxName: string; minName: string }>;
  incompatibleParams: string[];
  itemValueLabel: "CIF" | "FOB";
  participant: FlowField;
  primaryPortFilter: FlowField;
  secondaryPortFilter: FlowField;
};

export function normalizeTradeFlowUi(value: string | null | undefined): TradeFlow {
  return value === "export" ? "export" : "import";
}

export function formatTradeFlowLabel(
  value: string | null | undefined,
  variant: FlowLabelVariant = "singular",
) {
  if (value === "import") {
    return variant === "plural" ? "Importaciones" : "Importación";
  }

  if (value === "export") {
    return variant === "plural" ? "Exportaciones" : "Exportación";
  }

  return "Flujo no seleccionado";
}

export function tradeFlowUiConfig(value: string | null | undefined): TradeFlowUiConfig {
  const flow = normalizeTradeFlowUi(value);

  if (flow === "export") {
    return {
      flow,
      countryFilter: {
        label: "País destino",
        name: "destinationCountry",
      },
      grossWeightFilters: [
        {
          label: "Peso bruto ítem",
          maxName: "maxGrossWeightItem",
          minName: "minGrossWeightItem",
          name: "grossWeightItem",
        },
        {
          label: "Peso bruto total",
          maxName: "maxGrossWeightTotal",
          minName: "minGrossWeightTotal",
          name: "grossWeightTotal",
        },
      ],
      incompatibleParams: [
        "importer",
        "originCountry",
      ],
      itemValueLabel: "FOB",
      participant: {
        label: "ID exportador",
        name: "exporter",
      },
      primaryPortFilter: {
        label: "Puerto embarque",
        name: "embarkPort",
      },
      secondaryPortFilter: {
        label: "Puerto desembarque destino",
        name: "disembarkPort",
      },
    };
  }

  return {
    flow,
    countryFilter: {
      label: "País origen",
      name: "originCountry",
    },
    grossWeightFilters: [
      {
        label: "Peso bruto total",
        maxName: "maxGrossWeightTotal",
        minName: "minGrossWeightTotal",
        name: "grossWeightTotal",
      },
    ],
    incompatibleParams: [
      "destinationCountry",
      "exporter",
      "maxGrossWeightItem",
      "minGrossWeightItem",
    ],
    itemValueLabel: "CIF",
    participant: {
      label: "ID importador",
      name: "importer",
    },
    primaryPortFilter: {
      label: "Puerto desembarque",
      name: "disembarkPort",
    },
    secondaryPortFilter: {
      label: "Puerto embarque ruta",
      name: "embarkPort",
    },
  };
}
