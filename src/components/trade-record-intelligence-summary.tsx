import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { TradeRecordFilterOptions } from "@/trade/trade-record-filter-options";
import {
  formatTradeDecimal,
  formatTradeSummaryValue,
} from "@/trade/trade-record-format";
import { buildTradeRecordSearchHref } from "@/trade/trade-record-links";
import type { TradeRecordSearchResponse } from "@/trade/trade-record-search";
import {
  tradeRecordSummaryCodeLabel,
  tradeRecordSummaryCountryTitle,
  tradeRecordSummaryPortTitle,
} from "@/trade/trade-record-summary-labels";

type SummaryRank =
  TradeRecordSearchResponse["summary"]["rankings"]["countries"][number];

function optionName(
  options: TradeRecordFilterOptions[keyof Pick<
    TradeRecordFilterOptions,
    "currencies" | "quantityUnits"
  >],
  value: string | undefined,
) {
  if (!value) {
    return undefined;
  }

  return options.find((option) => option.value === value)?.label ?? value;
}

function SummaryMetric({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-muted/20 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 break-words font-mono text-sm font-medium">{value}</div>
      {note ? <div className="mt-1 text-xs text-muted-foreground">{note}</div> : null}
    </div>
  );
}

function SummaryRanking({
  emptyLabel = "Sin datos",
  hrefFor,
  items,
  labelFor,
  title,
  valueSuffix,
}: {
  emptyLabel?: string;
  hrefFor?: (item: SummaryRank) => string;
  items: SummaryRank[];
  labelFor: (item: SummaryRank) => string;
  title: string;
  valueSuffix?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-2 text-xs font-medium text-muted-foreground">{title}</div>
      <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
        {items.length === 0 ? (
          <div className="px-3 py-2 text-xs text-muted-foreground">{emptyLabel}</div>
        ) : (
          items.map((item) => (
            <div
              key={`${title}:${item.code}`}
              className="grid grid-cols-[1fr_auto] gap-3 px-3 py-2 text-xs"
            >
              <div className="min-w-0">
                {hrefFor ? (
                  <Link
                    href={hrefFor(item)}
                    className="block truncate font-medium underline-offset-4 hover:underline"
                  >
                    {labelFor(item)}
                  </Link>
                ) : (
                  <div className="truncate font-medium">{labelFor(item)}</div>
                )}
                <div className="text-muted-foreground">
                  Valor item {formatTradeSummaryValue(item.totalItemValue, valueSuffix)}
                </div>
              </div>
              <div className="font-mono text-muted-foreground">
                {formatTradeDecimal(item.records, 0)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function TradeRecordIntelligenceSummary({
  filterOptions,
  params,
  result,
}: {
  filterOptions: TradeRecordFilterOptions;
  params: Record<string, string | string[] | undefined>;
  result: TradeRecordSearchResponse;
}) {
  const { filters, summary } = result;
  const currency = summary.totals.currencyCode
    ? optionName(filterOptions.currencies, summary.totals.currencyCode)
    : undefined;
  const quantityUnit = summary.totals.quantityUnitCode
    ? optionName(filterOptions.quantityUnits, summary.totals.quantityUnitCode)
    : undefined;
  const itemValueLabel =
    filters.tradeFlow === "export"
      ? "Valor FOB item"
      : filters.tradeFlow === "import"
        ? "Valor CIF item"
        : "Valor item CIF/FOB";
  const valueSuffix = summary.totals.currencyIsMixed ? "moneda mixta" : currency;
  const quantityValue = summary.totals.quantityUnitIsMixed
    ? "—"
    : formatTradeSummaryValue(summary.totals.quantity, quantityUnit, 2);

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Resumen del resultado</CardTitle>
        <CardDescription>
          Calculado sobre todos los registros que cumplen los filtros actuales, no solo
          sobre esta página.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <SummaryMetric
            label="Registros"
            value={formatTradeDecimal(summary.totals.records, 0)}
          />
          <SummaryMetric
            label={itemValueLabel}
            value={formatTradeSummaryValue(summary.totals.itemValue, valueSuffix)}
            note={summary.totals.currencyIsMixed ? "Monedas mixtas" : undefined}
          />
          <SummaryMetric
            label="FOB declaración"
            value={formatTradeSummaryValue(summary.totals.declarationFobValue, valueSuffix)}
          />
          <SummaryMetric
            label="Cantidad"
            value={quantityValue}
            note={
              summary.totals.quantityUnitIsMixed
                ? "No se suma: múltiples unidades"
                : undefined
            }
          />
          <SummaryMetric
            label="Peso bruto item"
            value={formatTradeSummaryValue(summary.totals.grossWeightItem)}
          />
          <SummaryMetric
            label="Peso bruto total"
            value={formatTradeSummaryValue(summary.totals.grossWeightTotal)}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-4">
          <SummaryRanking
            title={tradeRecordSummaryCountryTitle(filters)}
            items={summary.rankings.countries}
            valueSuffix={valueSuffix}
            hrefFor={(item) =>
              buildTradeRecordSearchHref(params, {
                type: "country",
                code: item.code,
                tradeFlow: filters.tradeFlow,
              })
            }
            labelFor={(item) =>
              tradeRecordSummaryCodeLabel(filterOptions.countries, item.code, item.labelRaw)
            }
          />
          <SummaryRanking
            title="Top aduanas"
            items={summary.rankings.customsOffices}
            valueSuffix={valueSuffix}
            hrefFor={(item) =>
              buildTradeRecordSearchHref(params, {
                type: "customsOffice",
                code: item.code,
              })
            }
            labelFor={(item) =>
              tradeRecordSummaryCodeLabel(
                filterOptions.customsOffices,
                item.code,
                item.labelRaw,
              )
            }
          />
          <SummaryRanking
            title={tradeRecordSummaryPortTitle(filters)}
            items={summary.rankings.ports}
            valueSuffix={valueSuffix}
            hrefFor={(item) =>
              buildTradeRecordSearchHref(params, {
                type: "port",
                code: item.code,
              })
            }
            labelFor={(item) =>
              tradeRecordSummaryCodeLabel(filterOptions.ports, item.code, item.labelRaw)
            }
          />
          <SummaryRanking
            title="Top partidas HS"
            items={summary.rankings.hsCodes}
            valueSuffix={valueSuffix}
            hrefFor={(item) =>
              buildTradeRecordSearchHref(params, {
                type: "hsCodePrefix",
                code: item.code,
              })
            }
            labelFor={(item) => `HS ${item.code}`}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Agregación read-only en Postgres MVP. En filtros muy amplios puede demorar más;
          los correlativos de importador/exportador siguen siendo anónimos, no identidades
          legales verificadas.
        </p>
      </CardContent>
    </Card>
  );
}
