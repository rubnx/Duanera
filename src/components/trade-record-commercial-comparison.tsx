import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { productDisplayFromRaw } from "@/trade/trade-record-display";
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

type ComparisonRow =
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

function comparisonParticipantTitle(filters: TradeRecordSearchResponse["filters"]) {
  if (filters.tradeFlow === "export") {
    return "Correlativos exportador Aduana";
  }

  if (filters.tradeFlow === "import") {
    return "Correlativos importador Aduana";
  }

  return "Correlativos Aduana";
}

function comparisonParticipantHref(
  params: Record<string, string | string[] | undefined>,
  filters: TradeRecordSearchResponse["filters"],
  code: string,
) {
  return buildTradeRecordSearchHref(params, {
    type: filters.tradeFlow === "export" ? "exporter" : "importer",
    code,
  });
}

function ComparisonSection({
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

export function TradeRecordCommercialComparison({
  filterOptions,
  params,
  result,
}: {
  filterOptions: TradeRecordFilterOptions;
  params: Record<string, string | string[] | undefined>;
  result: TradeRecordSearchResponse;
}) {
  const { comparison, filters } = result;

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Comparación comercial</CardTitle>
        <CardDescription>
          Top {comparison.limit} por dimensión para comparar el resultado filtrado
          completo. Los promedios unitarios solo se muestran cuando moneda y unidad son
          comparables.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {comparison.skippedReason === "broad_result_set" ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-50/50 px-3 py-2 text-sm text-muted-foreground">
            Comparación omitida para esta búsqueda amplia. Agrega un filtro de HS,
            producto, país, aduana, puerto, rango comercial o correlativo anónimo para
            comparar grupos sin ejecutar una agregación demasiado pesada.
          </div>
        ) : (
          <div className="space-y-4">
            <ComparisonSection
              title="Productos / HS"
              description="Agrupado por prefijo HS de 6 dígitos con una descripción fuente de muestra."
              rows={comparison.groups.products}
              filterOptions={filterOptions}
              hrefFor={(row) =>
                buildTradeRecordSearchHref(params, {
                  type: "hsCodePrefix",
                  code: row.code,
                })
              }
              labelFor={(row) => ({
                title: `HS ${row.code}`,
                detail: row.productDescriptionRaw
                  ? productDisplayFromRaw(row.productDescriptionRaw).title
                  : undefined,
              })}
            />
            <ComparisonSection
              title={tradeRecordSummaryCountryTitle(filters)}
              description="País comercial relevante para el flujo: origen en importaciones, destino en exportaciones."
              rows={comparison.groups.countries}
              filterOptions={filterOptions}
              hrefFor={(row) =>
                buildTradeRecordSearchHref(params, {
                  type: "country",
                  code: row.code,
                  tradeFlow: filters.tradeFlow,
                })
              }
              labelFor={(row) => ({
                title: tradeRecordSummaryCodeLabel(
                  filterOptions.countries,
                  row.code,
                  row.labelRaw,
                ),
              })}
            />
            <ComparisonSection
              title="Aduanas"
              description="Oficinas Aduana con más registros dentro de los filtros actuales."
              rows={comparison.groups.customsOffices}
              filterOptions={filterOptions}
              hrefFor={(row) =>
                buildTradeRecordSearchHref(params, {
                  type: "customsOffice",
                  code: row.code,
                })
              }
              labelFor={(row) => ({
                title: tradeRecordSummaryCodeLabel(
                  filterOptions.customsOffices,
                  row.code,
                  row.labelRaw,
                ),
              })}
            />
            <ComparisonSection
              title={tradeRecordSummaryPortTitle(filters)}
              description="Puerto relevante para el flujo: desembarque en importaciones, embarque en exportaciones."
              rows={comparison.groups.ports}
              filterOptions={filterOptions}
              hrefFor={(row) =>
                buildTradeRecordSearchHref(params, {
                  type: "port",
                  code: row.code,
                })
              }
              labelFor={(row) => ({
                title: tradeRecordSummaryCodeLabel(filterOptions.ports, row.code, row.labelRaw),
              })}
            />
            <ComparisonSection
              title={comparisonParticipantTitle(filters)}
              description="Correlativos anónimos de la fuente Aduana; no representan identidad legal verificada."
              rows={comparison.groups.participants}
              filterOptions={filterOptions}
              hrefFor={(row) => comparisonParticipantHref(params, filters, row.code)}
              labelFor={(row) => ({
                title: `${row.code} · correlativo anónimo`,
              })}
            />
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Comparación read-only en Postgres MVP. Úsala como contexto direccional de marzo
          2026; cantidades, monedas y correlativos conservan las limitaciones de la
          fuente.
        </p>
      </CardContent>
    </Card>
  );
}
