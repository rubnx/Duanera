import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TradeRecordFilterOptions } from "@/trade/trade-record-filter-options";
import {
  formatTradeDecimal,
  formatTradeSummaryValue,
} from "@/trade/trade-record-format";
import type { TradeRecordSearchResponse } from "@/trade/trade-record-search";

export type ComparisonRow =
  TradeRecordSearchResponse["comparison"]["groups"]["products"][number];

function optionName(
  options: Array<{ value: string; label: string }>,
  value: string | undefined,
) {
  if (!value) {
    return undefined;
  }

  return options.find((option) => option.value === value)?.label ?? value;
}

function comparisonCurrencySuffix(
  row: ComparisonRow,
  filterOptions: TradeRecordFilterOptions,
) {
  if (row.currencyIsMixed) {
    return "moneda mixta";
  }

  return row.currencyCode ? optionName(filterOptions.currencies, row.currencyCode) : undefined;
}

function comparisonQuantityLabel(
  row: ComparisonRow,
  filterOptions: TradeRecordFilterOptions,
) {
  if (row.quantityUnitIsMixed) {
    return {
      value: "—",
      note: "Unidades mixtas",
    };
  }

  const unit = row.quantityUnitCode
    ? optionName(filterOptions.quantityUnits, row.quantityUnitCode)
    : undefined;

  return {
    value: formatTradeSummaryValue(row.quantity, unit),
    note: undefined,
  };
}

export function ComparisonSection({
  description,
  emptyLabel = "Sin datos comparables",
  filterOptions,
  hrefFor,
  labelFor,
  rows,
  title,
}: {
  description: string;
  emptyLabel?: string;
  filterOptions: TradeRecordFilterOptions;
  hrefFor: (row: ComparisonRow) => string;
  labelFor: (row: ComparisonRow) => { title: string; detail?: string };
  rows: ComparisonRow[];
  title: string;
}) {
  return (
    <section className="min-w-0 rounded-lg border border-border">
      <div className="border-b px-3 py-2">
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="overflow-x-auto">
        <Table className="min-w-[920px]">
          <TableHeader>
            <TableRow>
              <TableHead>Grupo</TableHead>
              <TableHead className="text-right">Registros</TableHead>
              <TableHead>Valor item</TableHead>
              <TableHead>FOB declaración</TableHead>
              <TableHead>Cantidad</TableHead>
              <TableHead>Peso bruto</TableHead>
              <TableHead>Precio unitario prom.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-16 text-center text-muted-foreground">
                  {emptyLabel}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const label = labelFor(row);
                const currencySuffix = comparisonCurrencySuffix(row, filterOptions);
                const quantity = comparisonQuantityLabel(row, filterOptions);

                return (
                  <TableRow key={`${title}:${row.code}`}>
                    <TableCell className="max-w-[280px] align-top whitespace-normal">
                      <Link
                        href={hrefFor(row)}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {label.title}
                      </Link>
                      {label.detail ? (
                        <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {label.detail}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="align-top text-right font-mono text-xs">
                      {formatTradeDecimal(row.records, 0)}
                    </TableCell>
                    <TableCell className="align-top font-mono text-xs">
                      {formatTradeSummaryValue(row.totalItemValue, currencySuffix)}
                      {row.currencyIsMixed ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Monedas mixtas
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="align-top font-mono text-xs">
                      {formatTradeSummaryValue(row.declarationFobValue, currencySuffix)}
                    </TableCell>
                    <TableCell className="align-top font-mono text-xs">
                      {quantity.value}
                      {quantity.note ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {quantity.note}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="align-top font-mono text-xs">
                      {formatTradeSummaryValue(row.grossWeightItem)}
                      <div className="mt-1 text-xs text-muted-foreground">
                        Total {formatTradeSummaryValue(row.grossWeightTotal)}
                      </div>
                    </TableCell>
                    <TableCell className="align-top font-mono text-xs">
                      {formatTradeSummaryValue(row.averageUnitPrice, currencySuffix)}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
