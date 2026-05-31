import Link from "next/link";

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
import {
  loadTradeRecordFilterOptions,
  type TradeRecordFilterOption,
  type TradeRecordFilterOptions,
} from "@/trade/trade-record-filter-options";
import {
  searchTradeRecords,
  TradeRecordSearchError,
} from "@/trade/trade-record-search";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type TradeRecordsSearchResult = Awaited<ReturnType<typeof searchTradeRecords>>;
type TradeRecordRow = TradeRecordsSearchResult["data"][number];

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
  const hasCursor = Boolean(searchInput.after);
  const hasPrevious = result.pagination.offset > 0 && !hasCursor;
  const hasNext =
    Boolean(result.pagination.nextCursor) || (!hasCursor && nextOffset < result.pagination.total);
  const nextHref = result.pagination.nextCursor
    ? buildPageHref(params, { after: result.pagination.nextCursor })
    : buildPageHref(params, { offset: nextOffset });
  const activeFilters = activeFilterItems(result, filterOptions);

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 py-5 lg:px-6">
      <header className="flex flex-col gap-3 border-b pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1">
          <Badge variant="outline" className="w-fit">
            Demo interno
          </Badge>
          <h1 className="text-2xl font-semibold tracking-tight">Registros Aduana</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
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

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>
            Busca por flujo, período, partida HS, producto, etiquetas decodificadas y
            correlativos anónimos de Aduana. Puerto relevante usa desembarque en
            importaciones y embarque en exportaciones.
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
          </form>
          <div className="mt-4 border-t pt-3">
            <div className="mb-2 text-xs font-medium text-muted-foreground">
              Filtros activos
            </div>
            <div className="flex flex-wrap gap-2">
              {activeFilters.map((filter) => (
                <Badge key={`${filter.label}:${filter.value}`} variant="outline">
                  {filter.label}: {filter.value}
                </Badge>
              ))}
            </div>
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
                  const period = `${record.periodYear}-${String(record.periodMonth).padStart(
                    2,
                    "0",
                  )}`;

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
                          <Link
                            href={`/trade-records/${record.id}`}
                            className="font-medium leading-snug underline-offset-4 hover:underline"
                          >
                            {record.productDescriptionRaw ?? "Sin descripción"}
                          </Link>
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex flex-col gap-1">
                          <div className="text-xs text-muted-foreground">
                            {participantSummary.label}
                          </div>
                          <div className="font-mono text-xs">{participantSummary.value}</div>
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
                          <div>
                            <span className="text-muted-foreground">{port.label}: </span>
                            {port.value}
                          </div>
                          <div>
                            <span className="text-muted-foreground">Vía: </span>
                            {formatCodeLabel(
                              record.transportModeCode,
                              record.decodedLabels.transportMode,
                            )}
                          </div>
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
          href={hasPrevious ? buildPageHref(params, { offset: previousOffset }) : "#"}
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
