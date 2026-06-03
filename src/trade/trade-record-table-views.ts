export const tradeRecordTableViewIds = [
  "commercial",
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
    label: "Comercial",
    shortLabel: "Comercial",
    description:
      "Lectura general de producto, valor, cantidad, país, logística y fuente.",
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
    label: "Producto / HS",
    shortLabel: "Producto",
    description:
      "Prioriza partida HS, descripción fuente, referencia producto, unidades y valores.",
  },
  {
    id: "provenance",
    label: "Fuente",
    shortLabel: "Fuente",
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
