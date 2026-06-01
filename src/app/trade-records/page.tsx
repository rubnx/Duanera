import Link from "next/link";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/db/client";
import { productDisplayFromRaw } from "@/trade/trade-record-display";
import {
  loadTradeRecordFilterOptions,
  type TradeRecordFilterOption,
  type TradeRecordFilterOptions,
} from "@/trade/trade-record-filter-options";
import {
  buildTradeRecordSearchHref,
  filtersToTradeRecordSearchParams,
  type TradeRecordDrilldownTarget,
} from "@/trade/trade-record-links";
import {
  activeTradeRecordPresetId,
  buildTradeRecordPresetHref,
  tradeRecordPresetCategories,
  tradeRecordPresets,
  type TradeRecordPreset,
} from "@/trade/trade-record-presets";
import {
  searchTradeRecords,
  TradeRecordSearchError,
} from "@/trade/trade-record-search";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type TradeRecordsSearchResult = Awaited<ReturnType<typeof searchTradeRecords>>;
type TradeRecordRow = TradeRecordsSearchResult["data"][number];
type SummaryRank = TradeRecordsSearchResult["summary"]["rankings"]["countries"][number];
type ComparisonRow =
  TradeRecordsSearchResult["comparison"]["groups"]["products"][number];

const defaultSearchInput = {
  tradeFlow: "import",
  periodFrom: "2026-03",
  periodTo: "2026-03",
  limit: "25",
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatMoney(value: string | null, currency?: string) {
  if (!value) {
    return "—";
  }

  return currency ? `${value} ${currency}` : value;
}

function formatDecimal(value: string | number | null | undefined, fractionDigits = 2) {
  if (value === null || value === undefined) {
    return "—";
  }

  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue)) {
    return String(value);
  }

  return new Intl.NumberFormat("es-CL", {
    maximumFractionDigits: fractionDigits,
  }).format(numericValue);
}

function formatSummaryValue(
  value: string | null,
  suffix?: string,
  fractionDigits = 2,
) {
  if (!value) {
    return "—";
  }

  return suffix
    ? `${formatDecimal(value, fractionDigits)} ${suffix}`
    : formatDecimal(value, fractionDigits);
}

function formatCodeLabel(code: string | null, label?: string) {
  if (!code && !label) {
    return "—";
  }

  if (code && label) {
    return `${code} · ${label}`;
  }

  return code ?? label ?? "—";
}

function formatQuantity(value: string | null, unitCode: string | null, unitLabel?: string) {
  if (!value) {
    return "—";
  }

  return `${value} ${unitLabel ?? unitCode ?? ""}`.trim();
}

function optionLabel(options: TradeRecordFilterOption[], value: string | undefined) {
  if (!value) {
    return undefined;
  }

  return options.find((option) => option.value === value)?.displayLabel ?? value;
}

function optionName(options: TradeRecordFilterOption[], value: string | undefined) {
  if (!value) {
    return undefined;
  }

  return options.find((option) => option.value === value)?.label ?? value;
}

function summaryCodeLabel(
  options: TradeRecordFilterOption[],
  code: string | null | undefined,
  labelRaw?: string | null,
) {
  if (!code && !labelRaw) {
    return "—";
  }

  const decoded = code ? options.find((option) => option.value === code)?.label : undefined;
  return formatCodeLabel(code ?? null, decoded ?? labelRaw ?? undefined);
}

function sortLabel(value: string | undefined) {
  const labels: Record<string, string> = {
    source: "Orden fuente",
    item_value_desc: "Mayor valor item",
    item_value_asc: "Menor valor item",
    declaration_fob_desc: "Mayor FOB declaración",
    quantity_desc: "Mayor cantidad",
    gross_weight_desc: "Mayor peso bruto",
  };

  return value ? labels[value] ?? value : undefined;
}

function rangeLabel(from: string | undefined, to: string | undefined) {
  if (from && to) {
    return `${from} a ${to}`;
  }

  if (from) {
    return `desde ${from}`;
  }

  if (to) {
    return `hasta ${to}`;
  }

  return undefined;
}

function itemValueFilterLabel(filters: TradeRecordsSearchResult["filters"]) {
  if (filters.tradeFlow === "import") {
    return "Valor CIF item";
  }

  if (filters.tradeFlow === "export") {
    return "Valor FOB item";
  }

  return "Valor item CIF/FOB";
}

function summaryCountryTitle(filters: TradeRecordsSearchResult["filters"]) {
  if (filters.tradeFlow === "export") {
    return "Top países destino";
  }

  if (filters.tradeFlow === "import") {
    return "Top países origen";
  }

  return "Top países";
}

function summaryPortTitle(filters: TradeRecordsSearchResult["filters"]) {
  if (filters.tradeFlow === "export") {
    return "Top puertos embarque";
  }

  if (filters.tradeFlow === "import") {
    return "Top puertos desembarque";
  }

  return "Top puertos relevantes";
}

function performanceNote(result: TradeRecordsSearchResult) {
  const warnings = result.meta.performanceWarnings;
  if (warnings.length === 0) {
    return undefined;
  }

  const reasons = warnings.map((warning) => warning.message).join(" ");
  return `${reasons} Tiempos internos: lista ${result.meta.timingMs.list} ms, resumen ${result.meta.timingMs.summary} ms, comparación ${result.meta.timingMs.comparison} ms, etiquetas ${result.meta.timingMs.labels} ms, total ${result.meta.timingMs.total} ms.`;
}

function activeFilterItems(
  result: TradeRecordsSearchResult,
  filterOptions: TradeRecordFilterOptions,
) {
  const filters = result.filters;
  const items = [
    {
      label: "Flujo",
      value: filters.tradeFlow === "export" ? "Exportaciones" : "Importaciones",
    },
    {
      label: "Período",
      value:
        filters.periodFrom && filters.periodTo
          ? `${filters.periodFrom} a ${filters.periodTo}`
          : undefined,
    },
    { label: "HS", value: filters.hsCodePrefix },
    { label: "Producto", value: filters.productQuery },
    {
      label: "Importador Aduana",
      value: filters.importerCorrelativeId
        ? `${filters.importerCorrelativeId} · correlativo anónimo`
        : undefined,
    },
    {
      label: "Exportador Aduana",
      value: filters.exporterCorrelativeId
        ? `${filters.exporterCorrelativeId} · correlativo anónimo`
        : undefined,
    },
    {
      label: "País origen",
      value: optionLabel(filterOptions.countries, filters.originCountryCode),
    },
    {
      label: "País destino",
      value: optionLabel(filterOptions.countries, filters.destinationCountryCode),
    },
    {
      label: "Aduana",
      value: optionLabel(filterOptions.customsOffices, filters.customsOfficeCode),
    },
    {
      label: "Vía transporte",
      value: optionLabel(filterOptions.transportModes, filters.transportModeCode),
    },
    {
      label: "Puerto relevante",
      value: optionLabel(filterOptions.ports, filters.portCode),
    },
    {
      label: itemValueFilterLabel(filters),
      value: rangeLabel(filters.minItemValue, filters.maxItemValue),
    },
    {
      label: "FOB declaración",
      value: rangeLabel(filters.minDeclarationFob, filters.maxDeclarationFob),
    },
    {
      label: "Cantidad",
      value: rangeLabel(filters.minQuantity, filters.maxQuantity),
    },
    {
      label: "Peso bruto item",
      value: rangeLabel(filters.minGrossWeightItem, filters.maxGrossWeightItem),
    },
    {
      label: "Peso bruto total",
      value: rangeLabel(filters.minGrossWeightTotal, filters.maxGrossWeightTotal),
    },
    {
      label: "Orden",
      value: filters.sort && filters.sort !== "source" ? sortLabel(filters.sort) : undefined,
    },
  ];

  return items.filter((item): item is { label: string; value: string } => Boolean(item.value));
}

function participant(record: TradeRecordRow) {
  if (record.tradeFlow === "import") {
    return {
      label: "Importador Aduana",
      value: record.importerCorrelativeId ?? "—",
    };
  }

  return {
    label: "Exportador Aduana",
    value:
      record.exporterPrimaryCorrelativeId ??
      record.exporterSecondaryCorrelativeId ??
      "—",
  };
}

function LookupSelect({
  id,
  label,
  name,
  options,
  placeholder,
  value,
}: {
  id: string;
  label: string;
  name: string;
  options: TradeRecordFilterOption[];
  placeholder: string;
  value?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        name={name}
        defaultValue={value ?? ""}
        className="h-8 w-full min-w-0 rounded-lg border border-input bg-background px-2.5 text-sm"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.displayLabel}
          </option>
        ))}
      </select>
    </div>
  );
}

function RangeInput({
  id,
  label,
  name,
  placeholder,
  value,
}: {
  id: string;
  label: string;
  name: string;
  placeholder: string;
  value?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        type="text"
        inputMode="decimal"
        pattern="[0-9]+([,.][0-9]+)?"
        defaultValue={value ?? ""}
        placeholder={placeholder}
      />
    </div>
  );
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
                  Valor item {formatSummaryValue(item.totalItemValue, valueSuffix)}
                </div>
              </div>
              <div className="font-mono text-muted-foreground">
                {formatDecimal(item.records, 0)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function IntelligenceSummaryPanel({
  filterOptions,
  params,
  result,
}: {
  filterOptions: TradeRecordFilterOptions;
  params: Record<string, string | string[] | undefined>;
  result: TradeRecordsSearchResult;
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
    : formatSummaryValue(summary.totals.quantity, quantityUnit, 2);

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
            value={formatDecimal(summary.totals.records, 0)}
          />
          <SummaryMetric
            label={itemValueLabel}
            value={formatSummaryValue(summary.totals.itemValue, valueSuffix)}
            note={summary.totals.currencyIsMixed ? "Monedas mixtas" : undefined}
          />
          <SummaryMetric
            label="FOB declaración"
            value={formatSummaryValue(summary.totals.declarationFobValue, valueSuffix)}
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
            value={formatSummaryValue(summary.totals.grossWeightItem)}
          />
          <SummaryMetric
            label="Peso bruto total"
            value={formatSummaryValue(summary.totals.grossWeightTotal)}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-4">
          <SummaryRanking
            title={summaryCountryTitle(filters)}
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
              summaryCodeLabel(filterOptions.countries, item.code, item.labelRaw)
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
              summaryCodeLabel(filterOptions.customsOffices, item.code, item.labelRaw)
            }
          />
          <SummaryRanking
            title={summaryPortTitle(filters)}
            items={summary.rankings.ports}
            valueSuffix={valueSuffix}
            hrefFor={(item) =>
              buildTradeRecordSearchHref(params, {
                type: "port",
                code: item.code,
              })
            }
            labelFor={(item) =>
              summaryCodeLabel(filterOptions.ports, item.code, item.labelRaw)
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
    value: formatSummaryValue(row.quantity, unit),
    note: undefined,
  };
}

function comparisonParticipantTitle(filters: TradeRecordsSearchResult["filters"]) {
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
  filters: TradeRecordsSearchResult["filters"],
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
                      {formatDecimal(row.records, 0)}
                    </TableCell>
                    <TableCell className="align-top font-mono text-xs">
                      {formatSummaryValue(row.totalItemValue, currencySuffix)}
                      {row.currencyIsMixed ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Monedas mixtas
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="align-top font-mono text-xs">
                      {formatSummaryValue(row.declarationFobValue, currencySuffix)}
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
                      {formatSummaryValue(row.grossWeightItem)}
                      <div className="mt-1 text-xs text-muted-foreground">
                        Total {formatSummaryValue(row.grossWeightTotal)}
                      </div>
                    </TableCell>
                    <TableCell className="align-top font-mono text-xs">
                      {formatSummaryValue(row.averageUnitPrice, currencySuffix)}
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

function CommercialComparisonPanel({
  filterOptions,
  params,
  result,
}: {
  filterOptions: TradeRecordFilterOptions;
  params: Record<string, string | string[] | undefined>;
  result: TradeRecordsSearchResult;
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
              title={summaryCountryTitle(filters)}
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
                title: summaryCodeLabel(filterOptions.countries, row.code, row.labelRaw),
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
                title: summaryCodeLabel(filterOptions.customsOffices, row.code, row.labelRaw),
              })}
            />
            <ComparisonSection
              title={summaryPortTitle(filters)}
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
                title: summaryCodeLabel(filterOptions.ports, row.code, row.labelRaw),
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

function itemValueForFlow(record: TradeRecordRow) {
  if (record.tradeFlow === "import") {
    return {
      label: "CIF item",
      value: formatMoney(record.itemCifValue, record.decodedLabels.currency),
    };
  }

  return {
    label: "FOB item",
    value: formatMoney(record.itemFobValue, record.decodedLabels.currency),
  };
}

function countryForFlow(record: TradeRecordRow) {
  if (record.tradeFlow === "import") {
    return {
      label: "Origen",
      value: formatCodeLabel(record.originCountryCode, record.decodedLabels.originCountry),
    };
  }

  return {
    label: "Destino",
    value: formatCodeLabel(
      record.destinationCountryCode,
      record.decodedLabels.destinationCountry,
    ),
  };
}

function portForFlow(record: TradeRecordRow) {
  if (record.tradeFlow === "import") {
    return {
      label: "Desembarque",
      value: formatCodeLabel(
        record.disembarkPortCode,
        record.decodedLabels.disembarkPort,
      ),
    };
  }

  return {
    label: "Embarque",
    value: formatCodeLabel(record.embarkPortCode, record.decodedLabels.embarkPort),
  };
}

function buildPageHref(
  params: Record<string, string | string[] | undefined>,
  nextValues: { offset?: number; after?: string },
) {
  const next = new URLSearchParams();

  for (const [key, rawValue] of Object.entries(params)) {
    const value = firstValue(rawValue);
    if (value && key !== "offset" && key !== "after") {
      next.set(key, value);
    }
  }

  if (nextValues.offset && nextValues.offset > 0) {
    next.set("offset", String(nextValues.offset));
  }

  if (nextValues.after) {
    next.set("after", nextValues.after);
  }

  const query = next.toString();
  return query ? `/trade-records?${query}` : "/trade-records";
}

function FilterAction({
  href,
  children,
}: {
  href: string | null;
  children: ReactNode;
}) {
  if (!href) {
    return null;
  }

  return (
    <Link
      href={href}
      className="w-fit text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
    >
      {children}
    </Link>
  );
}

function drilldownHref(
  params: Record<string, string | string[] | undefined>,
  target: TradeRecordDrilldownTarget,
) {
  return buildTradeRecordSearchHref(params, target);
}

function PresetLink({
  isActive,
  preset,
}: {
  isActive: boolean;
  preset: TradeRecordPreset;
}) {
  return (
    <Link
      href={buildTradeRecordPresetHref(preset)}
      aria-current={isActive ? "page" : undefined}
      className={[
        "block min-w-0 rounded-lg border px-3 py-2 text-left transition-colors",
        isActive
          ? "border-primary bg-primary/5"
          : "border-border hover:border-foreground/30 hover:bg-muted/40",
      ].join(" ")}
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="truncate text-sm font-medium">{preset.title}</span>
        {isActive ? (
          <Badge variant="secondary" className="shrink-0">
            Activa
          </Badge>
        ) : null}
      </div>
      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
        {preset.description}
      </p>
    </Link>
  );
}

function PresetViewsPanel({ activePresetId }: { activePresetId: string | null }) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Vistas comerciales rápidas</CardTitle>
        <CardDescription>
          Atajos compartibles para explorar marzo 2026 con filtros existentes. Son
          vistas de conveniencia, no conclusiones de mercado verificadas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {tradeRecordPresetCategories.map((category) => {
          const presets = tradeRecordPresets.filter(
            (preset) => preset.category === category.id,
          );

          return (
            <section key={category.id} className="min-w-0">
              <h2 className="mb-2 text-xs font-medium text-muted-foreground">
                {category.label}
              </h2>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                {presets.map((preset) => (
                  <PresetLink
                    key={preset.id}
                    preset={preset}
                    isActive={activePresetId === preset.id}
                  />
                ))}
              </div>
            </section>
          );
        })}
        <p className="text-xs text-muted-foreground">
          Cada vista abre una URL normal de búsqueda. No aplica nombres de empresas ni
          identidades legales; los correlativos Aduana siguen siendo anónimos cuando
          aparecen en resultados.
        </p>
      </CardContent>
    </Card>
  );
}

export default async function TradeRecordsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const searchInput = {
    tradeFlow: firstValue(params.tradeFlow) ?? defaultSearchInput.tradeFlow,
    periodFrom: firstValue(params.periodFrom) ?? defaultSearchInput.periodFrom,
    periodTo: firstValue(params.periodTo) ?? defaultSearchInput.periodTo,
    hsCodePrefix: firstValue(params.hsCodePrefix),
    q: firstValue(params.q),
    importer: firstValue(params.importer),
    exporter: firstValue(params.exporter),
    originCountry: firstValue(params.originCountry),
    destinationCountry: firstValue(params.destinationCountry),
    customsOffice: firstValue(params.customsOffice),
    transportMode: firstValue(params.transportMode),
    port: firstValue(params.port),
    minItemValue: firstValue(params.minItemValue),
    maxItemValue: firstValue(params.maxItemValue),
    minDeclarationFob: firstValue(params.minDeclarationFob),
    maxDeclarationFob: firstValue(params.maxDeclarationFob),
    minQuantity: firstValue(params.minQuantity),
    maxQuantity: firstValue(params.maxQuantity),
    minGrossWeightItem: firstValue(params.minGrossWeightItem),
    maxGrossWeightItem: firstValue(params.maxGrossWeightItem),
    minGrossWeightTotal: firstValue(params.minGrossWeightTotal),
    maxGrossWeightTotal: firstValue(params.maxGrossWeightTotal),
    sort: firstValue(params.sort),
    limit: firstValue(params.limit) ?? defaultSearchInput.limit,
    offset: firstValue(params.offset),
    after: firstValue(params.after),
  };

  let result: TradeRecordsSearchResult;
  let searchError: string | null = null;
  const filterOptions = await loadTradeRecordFilterOptions(db);

  try {
    result = await searchTradeRecords(db, searchInput);
  } catch (error) {
    if (!(error instanceof TradeRecordSearchError)) {
      throw error;
    }

    searchError = error.message;
    result = await searchTradeRecords(db, defaultSearchInput);
  }

  const previousOffset = Math.max(result.pagination.offset - result.pagination.limit, 0);
  const nextOffset = result.pagination.offset + result.pagination.limit;
  const effectiveSearchParams = filtersToTradeRecordSearchParams(result.filters);
  const hasCursor = Boolean(searchInput.after);
  const hasPrevious = result.pagination.offset > 0 && !hasCursor;
  const hasNext =
    Boolean(result.pagination.nextCursor) || (!hasCursor && nextOffset < result.pagination.total);
  const nextHref = result.pagination.nextCursor
    ? buildPageHref(effectiveSearchParams, { after: result.pagination.nextCursor })
    : buildPageHref(effectiveSearchParams, { offset: nextOffset });
  const activeFilters = activeFilterItems(result, filterOptions);
  const activePresetId = activeTradeRecordPresetId(result.filters);
  const usesOffsetMode = result.pagination.paginationMode === "offset";
  const searchPerformanceNote = performanceNote(result);

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 py-5 lg:px-6">
      <header className="flex flex-col gap-3 border-b pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <Badge variant="outline" className="w-fit">
            Demo interno
          </Badge>
          <h1 className="text-2xl font-semibold tracking-tight">Registros Aduana</h1>
          <p className="max-w-3xl break-words text-sm text-muted-foreground">
            Muestra de importaciones y exportaciones de marzo 2026. Los IDs de
            importador/exportador son correlativos anónimos de Aduana, no identidades
            legales verificadas.
          </p>
        </div>
        <Link
          href="/"
          className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Inicio
        </Link>
      </header>

      <PresetViewsPanel activePresetId={activePresetId} />

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription className="break-words">
            Busca por flujo, período, partida HS, producto, etiquetas decodificadas y
            correlativos anónimos de Aduana. Puerto relevante usa desembarque en
            importaciones y embarque en exportaciones. Los rangos comerciales usan
            valor CIF item en importaciones y valor FOB item en exportaciones.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-6 [&>*]:min-w-0">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tradeFlow">Flujo</Label>
              <select
                id="tradeFlow"
                name="tradeFlow"
                defaultValue={result.filters.tradeFlow ?? "import"}
                className="h-8 w-full min-w-0 rounded-lg border border-input bg-background px-2.5 text-sm"
              >
                <option value="import">Importaciones</option>
                <option value="export">Exportaciones</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="periodFrom">Desde</Label>
              <Input
                id="periodFrom"
                name="periodFrom"
                defaultValue={result.filters.periodFrom ?? "2026-03"}
                placeholder="2026-03"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="periodTo">Hasta</Label>
              <Input
                id="periodTo"
                name="periodTo"
                defaultValue={result.filters.periodTo ?? "2026-03"}
                placeholder="2026-03"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="hsCodePrefix">Código HS</Label>
              <Input
                id="hsCodePrefix"
                name="hsCodePrefix"
                defaultValue={result.filters.hsCodePrefix ?? ""}
                placeholder="4011"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="q">Producto / atributos</Label>
              <Input
                id="q"
                name="q"
                defaultValue={result.filters.productQuery ?? ""}
                placeholder="neumáticos"
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <Button type="submit" className="sm:flex-1">
                Buscar
              </Button>
              <Link
                href="/trade-records"
                className="inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-border px-2.5 text-sm font-medium hover:bg-muted"
              >
                Limpiar
              </Link>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="importer">Correlativo importador</Label>
              <Input
                id="importer"
                name="importer"
                defaultValue={result.filters.importerCorrelativeId ?? ""}
                placeholder="10998"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="exporter">Correlativo exportador</Label>
              <Input
                id="exporter"
                name="exporter"
                defaultValue={result.filters.exporterCorrelativeId ?? ""}
                placeholder="3904"
              />
            </div>
            <LookupSelect
              id="originCountry"
              name="originCountry"
              label="País origen"
              value={result.filters.originCountryCode}
              options={filterOptions.countries}
              placeholder="Todos los orígenes"
            />
            <LookupSelect
              id="destinationCountry"
              name="destinationCountry"
              label="País destino"
              value={result.filters.destinationCountryCode}
              options={filterOptions.countries}
              placeholder="Todos los destinos"
            />
            <LookupSelect
              id="customsOffice"
              name="customsOffice"
              label="Aduana"
              value={result.filters.customsOfficeCode}
              options={filterOptions.customsOffices}
              placeholder="Todas las aduanas"
            />
            <LookupSelect
              id="transportMode"
              name="transportMode"
              label="Vía transporte"
              value={result.filters.transportModeCode}
              options={filterOptions.transportModes}
              placeholder="Todas las vías"
            />
            <LookupSelect
              id="port"
              name="port"
              label="Puerto relevante"
              value={result.filters.portCode}
              options={filterOptions.ports}
              placeholder="Todos los puertos"
            />
            <div className="flex min-w-0 flex-col gap-1.5">
              <Label htmlFor="sort">Orden</Label>
              <select
                id="sort"
                name="sort"
                defaultValue={result.filters.sort ?? "source"}
                className="h-8 w-full min-w-0 rounded-lg border border-input bg-background px-2.5 text-sm"
              >
                <option value="source">Orden fuente</option>
                <option value="item_value_desc">Mayor valor item</option>
                <option value="item_value_asc">Menor valor item</option>
                <option value="declaration_fob_desc">Mayor FOB declaración</option>
                <option value="quantity_desc">Mayor cantidad</option>
                <option value="gross_weight_desc">Mayor peso bruto</option>
              </select>
            </div>
            <RangeInput
              id="minItemValue"
              name="minItemValue"
              label="Valor item desde"
              value={result.filters.minItemValue}
              placeholder="1000"
            />
            <RangeInput
              id="maxItemValue"
              name="maxItemValue"
              label="Valor item hasta"
              value={result.filters.maxItemValue}
              placeholder="50000"
            />
            <RangeInput
              id="minDeclarationFob"
              name="minDeclarationFob"
              label="FOB declaración desde"
              value={result.filters.minDeclarationFob}
              placeholder="1000"
            />
            <RangeInput
              id="maxDeclarationFob"
              name="maxDeclarationFob"
              label="FOB declaración hasta"
              value={result.filters.maxDeclarationFob}
              placeholder="50000"
            />
            <RangeInput
              id="minQuantity"
              name="minQuantity"
              label="Cantidad desde"
              value={result.filters.minQuantity}
              placeholder="10"
            />
            <RangeInput
              id="maxQuantity"
              name="maxQuantity"
              label="Cantidad hasta"
              value={result.filters.maxQuantity}
              placeholder="10000"
            />
            <RangeInput
              id="minGrossWeightItem"
              name="minGrossWeightItem"
              label="Peso item desde"
              value={result.filters.minGrossWeightItem}
              placeholder="10"
            />
            <RangeInput
              id="maxGrossWeightItem"
              name="maxGrossWeightItem"
              label="Peso item hasta"
              value={result.filters.maxGrossWeightItem}
              placeholder="10000"
            />
            <RangeInput
              id="minGrossWeightTotal"
              name="minGrossWeightTotal"
              label="Peso total desde"
              value={result.filters.minGrossWeightTotal}
              placeholder="10"
            />
            <RangeInput
              id="maxGrossWeightTotal"
              name="maxGrossWeightTotal"
              label="Peso total hasta"
              value={result.filters.maxGrossWeightTotal}
              placeholder="10000"
            />
          </form>
          <div className="mt-4 border-t pt-3">
            <div className="mb-2 text-xs font-medium text-muted-foreground">
              Filtros activos
            </div>
            <div className="flex flex-wrap gap-2">
              {activeFilters.map((filter) => (
                <Badge
                  key={`${filter.label}:${filter.value}`}
                  variant="outline"
                  className="h-auto max-w-full justify-start whitespace-normal break-words text-left"
                >
                  {filter.label}: {filter.value}
                </Badge>
              ))}
            </div>
            {usesOffsetMode ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Los rangos comerciales, búsquedas de texto, correlativos y ordenamientos
                por valor usan paginación por posición para mantener el orden solicitado.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {searchError ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle>Filtro inválido</CardTitle>
            <CardDescription>
              {searchError} Se muestran los registros por defecto.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {searchPerformanceNote ? (
        <Card className="border-amber-500/30 bg-amber-50/50">
          <CardHeader>
            <CardTitle>Nota de rendimiento</CardTitle>
            <CardDescription className="break-words">
              {searchPerformanceNote}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <IntelligenceSummaryPanel
        filterOptions={filterOptions}
        params={effectiveSearchParams}
        result={result}
      />

      <CommercialComparisonPanel
        filterOptions={filterOptions}
        params={effectiveSearchParams}
        result={result}
      />

      <Card>
        <CardHeader className="border-b">
          <CardTitle>{result.pagination.total} registros</CardTitle>
          <CardDescription>
            Mostrando {result.data.length}
            {hasCursor
              ? " desde el cursor actual."
              : ` desde posición ${result.pagination.offset}.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table className="min-w-[1320px]">
            <TableHeader>
              <TableRow>
                <TableHead>Operación</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Correlativo Aduana</TableHead>
                <TableHead>Valor item</TableHead>
                <TableHead>Cantidad / peso</TableHead>
                <TableHead>País</TableHead>
                <TableHead>Logística</TableHead>
                <TableHead>Fuente</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    No encontramos registros con estos filtros. Prueba ampliar el rango
                    de fechas o usar una partida HS más general.
                  </TableCell>
                </TableRow>
              ) : (
                result.data.map((record) => {
                  const itemValue = itemValueForFlow(record);
                  const participantSummary = participant(record);
                  const country = countryForFlow(record);
                  const port = portForFlow(record);
                  const product = productDisplayFromRaw(record.productDescriptionRaw);
                  const period = `${record.periodYear}-${String(record.periodMonth).padStart(
                    2,
                    "0",
                  )}`;
                  const hsFilterHref = record.hsCodeNormalized
                    ? drilldownHref(effectiveSearchParams, {
                        type: "hsCodePrefix",
                        code: record.hsCodeNormalized,
                      })
                    : null;
                  const participantFilterHref =
                    record.tradeFlow === "import" && record.importerCorrelativeId
                      ? drilldownHref(effectiveSearchParams, {
                          type: "importer",
                          code: record.importerCorrelativeId,
                        })
                      : record.tradeFlow === "export" &&
                          (record.exporterPrimaryCorrelativeId ||
                            record.exporterSecondaryCorrelativeId)
                        ? drilldownHref(effectiveSearchParams, {
                            type: "exporter",
                            code:
                              record.exporterPrimaryCorrelativeId ??
                              record.exporterSecondaryCorrelativeId!,
                          })
                        : null;
                  const countryCode =
                    record.tradeFlow === "export"
                      ? record.destinationCountryCode
                      : record.originCountryCode;
                  const countryFilterHref = countryCode
                    ? drilldownHref(effectiveSearchParams, {
                        type: "country",
                        code: countryCode,
                        tradeFlow: record.tradeFlow === "export" ? "export" : "import",
                      })
                    : null;
                  const customsFilterHref = record.customsOfficeCode
                    ? drilldownHref(effectiveSearchParams, {
                        type: "customsOffice",
                        code: record.customsOfficeCode,
                      })
                    : null;
                  const portCode =
                    record.tradeFlow === "export"
                      ? record.embarkPortCode
                      : record.disembarkPortCode;
                  const portFilterHref = portCode
                    ? drilldownHref(effectiveSearchParams, {
                        type: "port",
                        code: portCode,
                      })
                    : null;

                  return (
                    <TableRow key={record.id}>
                      <TableCell className="align-top">
                        <div className="flex flex-col gap-1">
                          <Badge variant="secondary" className="w-fit">
                            {record.tradeFlow === "import" ? "Importación" : "Exportación"}
                          </Badge>
                          <div className="font-mono text-xs text-muted-foreground">{period}</div>
                          <div className="font-mono text-xs">
                            Declaración {record.declarationIdRaw ?? "—"} · Item{" "}
                            {record.itemNumber ?? "—"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {record.acceptanceDate ?? "Sin fecha aceptación"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[320px] align-top whitespace-normal">
                        <div className="flex flex-col gap-1">
                          <div className="font-mono text-xs text-muted-foreground">
                            HS {record.hsCodeNormalized ?? "—"}
                          </div>
                          <FilterAction href={hsFilterHref}>Filtrar HS</FilterAction>
                          <Link
                            href={`/trade-records/${record.id}`}
                            className="font-medium leading-snug underline-offset-4 hover:underline"
                          >
                            {product.title}
                          </Link>
                          {product.sourceReference ? (
                            <div className="font-mono text-xs text-muted-foreground">
                              Ref. fuente: {product.sourceReference}
                            </div>
                          ) : null}
                          {product.details.length > 0 ? (
                            <div className="line-clamp-2 text-xs text-muted-foreground">
                              {product.details.join(" · ")}
                            </div>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex flex-col gap-1">
                          <div className="text-xs text-muted-foreground">
                            {participantSummary.label}
                          </div>
                          <div className="font-mono text-xs">{participantSummary.value}</div>
                          <FilterAction href={participantFilterHref}>
                            Ver mismo correlativo
                          </FilterAction>
                          <div className="max-w-[170px] whitespace-normal text-xs text-muted-foreground">
                            Correlativo anónimo, no identidad legal.
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex flex-col gap-1">
                          <div className="text-xs text-muted-foreground">{itemValue.label}</div>
                          <div className="font-mono text-xs">{itemValue.value}</div>
                          <div className="text-xs text-muted-foreground">FOB declaración</div>
                          <div className="font-mono text-xs">
                            {formatMoney(
                              record.declarationFobValue,
                              record.decodedLabels.currency,
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex flex-col gap-1">
                          <div className="font-mono text-xs">
                            {formatQuantity(
                              record.quantity,
                              record.quantityUnitCode,
                              record.decodedLabels.quantityUnit,
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">Peso bruto item</div>
                          <div className="font-mono text-xs">
                            {record.grossWeightItem ?? "—"}
                          </div>
                          <div className="text-xs text-muted-foreground">Peso bruto total</div>
                          <div className="font-mono text-xs">
                            {record.grossWeightTotal ?? "—"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[210px] align-top whitespace-normal text-xs">
                        <div className="flex flex-col gap-1">
                          <div className="text-muted-foreground">{country.label}</div>
                          <div>{country.value}</div>
                          <FilterAction href={countryFilterHref}>
                            Filtrar país
                          </FilterAction>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[260px] align-top whitespace-normal text-xs">
                        <div className="flex flex-col gap-1">
                          <div>
                            <span className="text-muted-foreground">Aduana: </span>
                            {formatCodeLabel(
                              record.customsOfficeCode,
                              record.decodedLabels.customsOffice,
                            )}
                          </div>
                          <FilterAction href={customsFilterHref}>
                            Filtrar aduana
                          </FilterAction>
                          <div>
                            <span className="text-muted-foreground">{port.label}: </span>
                            {port.value}
                          </div>
                          <FilterAction href={portFilterHref}>Filtrar puerto</FilterAction>
                          <div>
                            <span className="text-muted-foreground">Vía: </span>
                            {formatCodeLabel(
                              record.transportModeCode,
                              record.decodedLabels.transportMode,
                            )}
                          </div>
                          {record.cargoTypeCode || record.decodedLabels.cargoType ? (
                            <div>
                              <span className="text-muted-foreground">Carga: </span>
                              {formatCodeLabel(
                                record.cargoTypeCode,
                                record.decodedLabels.cargoType,
                              )}
                            </div>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[220px] align-top whitespace-normal text-xs text-muted-foreground">
                        {record.sourceFilename} · fila {record.rawRowNumber}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <nav className="flex items-center justify-between">
        <Link
          aria-disabled={!hasPrevious}
          href={hasPrevious ? buildPageHref(effectiveSearchParams, { offset: previousOffset }) : "#"}
          className="inline-flex h-8 items-center rounded-lg border border-border px-2.5 text-sm font-medium aria-disabled:pointer-events-none aria-disabled:opacity-40 hover:bg-muted"
        >
          Anterior
        </Link>
        <Link
          aria-disabled={!hasNext}
          href={hasNext ? nextHref : "#"}
          className="inline-flex h-8 items-center rounded-lg border border-border px-2.5 text-sm font-medium aria-disabled:pointer-events-none aria-disabled:opacity-40 hover:bg-muted"
        >
          Siguiente
        </Link>
      </nav>
    </main>
  );
}
