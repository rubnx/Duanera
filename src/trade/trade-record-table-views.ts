export const tradeRecordTableViewIds = [
  "commercial",
  "values",
  "logistics",
  "product",
  "provenance",
] as const;

export type TradeRecordTableViewId = (typeof tradeRecordTableViewIds)[number];

export const defaultTradeRecordTableView: TradeRecordTableViewId = "commercial";

export type TradeRecordTableView = {
  id: TradeRecordTableViewId;
  label: string;
  shortLabel: string;
  description: string;
};

export const tradeRecordTableViews: TradeRecordTableView[] = [
  {
    id: "commercial",
    label: "Resumen comercial",
    shortLabel: "Resumen",
    description:
      "Lectura general de producto, valor CIF/FOB, cantidad, país y logística.",
  },
  {
    id: "values",
    label: "Valores",
    shortLabel: "Valores",
    description:
      "Prioriza CIF/FOB, flete, seguro, precio unitario, cantidad y pesos.",
  },
  {
    id: "logistics",
    label: "Logística",
    shortLabel: "Logística",
    description:
      "Prioriza aduana, puerto relevante, vía de transporte, carga y trazabilidad.",
  },
  {
    id: "product",
    label: "Producto / arancel",
    shortLabel: "Producto",
    description:
      "Prioriza partida arancelaria, descripción fuente, referencia producto, unidades y valores.",
  },
  {
    id: "provenance",
    label: "Trazabilidad",
    shortLabel: "Trazabilidad",
    description:
      "Prioriza archivo fuente, lote, parser, payload, reconstruibilidad y fila cruda.",
  },
];

const tradeRecordTableViewSet = new Set<string>(tradeRecordTableViewIds);

export function parseTradeRecordTableView(
  value: string | null | undefined,
): TradeRecordTableViewId {
  return value && tradeRecordTableViewSet.has(value)
    ? (value as TradeRecordTableViewId)
    : defaultTradeRecordTableView;
}

export function tradeRecordTableViewById(id: TradeRecordTableViewId) {
  return (
    tradeRecordTableViews.find((view) => view.id === id) ??
    tradeRecordTableViews[0]
  );
}
