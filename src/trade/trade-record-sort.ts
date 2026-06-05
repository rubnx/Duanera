export type TradeRecordSort =
  | "source"
  | "item_value_desc"
  | "item_value_asc"
  | "declaration_fob_desc"
  | "declaration_fob_asc"
  | "quantity_desc"
  | "quantity_asc"
  | "gross_weight_desc"
  | "gross_weight_asc";

export const tradeRecordSortValues = [
  "source",
  "item_value_desc",
  "item_value_asc",
  "declaration_fob_desc",
  "declaration_fob_asc",
  "quantity_desc",
  "quantity_asc",
  "gross_weight_desc",
  "gross_weight_asc",
] as const satisfies TradeRecordSort[];

export const tradeRecordSortLabels: Record<TradeRecordSort, string> = {
  source: "Orden fuente",
  item_value_desc: "Mayor valor",
  item_value_asc: "Menor valor",
  declaration_fob_desc: "Mayor US$ FOB",
  declaration_fob_asc: "Menor US$ FOB",
  quantity_desc: "Mayor cantidad",
  quantity_asc: "Menor cantidad",
  gross_weight_desc: "Mayor peso bruto",
  gross_weight_asc: "Menor peso bruto",
};

export function isTradeRecordSort(value: string): value is TradeRecordSort {
  return tradeRecordSortValues.includes(value as TradeRecordSort);
}

export function formatTradeRecordSortLabel(value: string | null | undefined) {
  if (!value) {
    return undefined;
  }

  return isTradeRecordSort(value) ? tradeRecordSortLabels[value] : value;
}
