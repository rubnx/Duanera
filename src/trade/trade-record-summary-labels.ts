import { formatTradeCodeLabel } from "./trade-record-format";
import type { TradeRecordFilterOption } from "./trade-record-filter-options";

export function tradeRecordSummaryCodeLabel(
  options: TradeRecordFilterOption[],
  code: string | null | undefined,
  labelRaw?: string | null,
) {
  if (!code && !labelRaw) {
    return "—";
  }

  const decoded = code ? options.find((option) => option.value === code)?.label : undefined;
  return formatTradeCodeLabel(code ?? null, decoded ?? labelRaw ?? undefined);
}

export function tradeRecordSummaryCountryTitle(filters: { tradeFlow?: string }) {
  if (filters.tradeFlow === "export") {
    return "Top países destino";
  }

  if (filters.tradeFlow === "import") {
    return "Top países origen";
  }

  return "Top países";
}

export function tradeRecordSummaryPortTitle(filters: { tradeFlow?: string }) {
  if (filters.tradeFlow === "export") {
    return "Top puertos embarque";
  }

  if (filters.tradeFlow === "import") {
    return "Top puertos desembarque";
  }

  return "Top puertos relevantes";
}
