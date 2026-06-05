import type { ReactNode } from "react";

import { CountryFlag } from "@/components/common/country-flag";
import {
  formatTradeCodeLabel,
  formatTradeDisplayCodeLabel,
  formatTradeMoney,
  formatTradeQuantity,
} from "@/trade/trade-record-format";

const detailFallback = "No informado";

export function formatDetailCodeLabel(code: string | null, label?: string) {
  return formatTradeCodeLabel(code, label, detailFallback);
}

export function formatDetailCountryLabel(code: string | null, label?: string) {
  return formatTradeDisplayCodeLabel({
    code,
    fallback: detailFallback,
    kind: "country",
    label,
  });
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
  value: ReactNode;
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

export function CountryDetailValue({
  countryCode,
  countryName,
}: {
  countryCode?: string | null;
  countryName: string;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <CountryFlag countryCode={countryCode} countryName={countryName} />
      <span>{countryName}</span>
    </span>
  );
}
