import {
  formatTradeCodeLabel,
  formatTradeMoney,
  formatTradeQuantity,
} from "@/trade/trade-record-format";

const detailFallback = "No informado";

export function formatDetailCodeLabel(code: string | null, label?: string) {
  return formatTradeCodeLabel(code, label, detailFallback);
}

export function formatDetailMoney(value: string | null, currency?: string) {
  return formatTradeMoney(value, currency, detailFallback);
}

export function formatDetailQuantity(
  value: string | null,
  unitCode?: string | null,
  unitLabel?: string | null,
) {
  return formatTradeQuantity(value, unitCode, unitLabel, detailFallback);
}

export function formatDetailJson(value: unknown) {
  if (value === null || value === undefined) {
    return detailFallback;
  }

  return JSON.stringify(value, null, 2);
}

export function DetailField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | number | null | undefined;
  mono?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className={mono ? "break-words font-mono text-xs" : "break-words text-sm"}>
        {value ?? detailFallback}
      </dd>
    </div>
  );
}
