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
    limit: firstValue(params.limit) ?? defaultSearchInput.limit,
    offset: firstValue(params.offset),
    after: firstValue(params.after),
  };

  let result: TradeRecordsSearchResult;
  let searchError: string | null = null;

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
            Busca por flujo, período, partida HS, producto, atributos auxiliares y
            correlativos anónimos de Aduana.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tradeFlow">Flujo</Label>
              <select
                id="tradeFlow"
                name="tradeFlow"
                defaultValue={result.filters.tradeFlow ?? "import"}
                className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
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
            <div className="flex items-end gap-2">
              <Button type="submit" className="w-full">
                Buscar
              </Button>
              <Link
                href="/trade-records"
                className="inline-flex h-8 items-center rounded-lg border border-border px-2.5 text-sm font-medium hover:bg-muted"
              >
                Limpiar
              </Link>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="importer">Importador</Label>
              <Input
                id="importer"
                name="importer"
                defaultValue={result.filters.importerCorrelativeId ?? ""}
                placeholder="10998"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="exporter">Exportador</Label>
              <Input
                id="exporter"
                name="exporter"
                defaultValue={result.filters.exporterCorrelativeId ?? ""}
                placeholder="3904"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="originCountry">País origen</Label>
              <Input
                id="originCountry"
                name="originCountry"
                defaultValue={result.filters.originCountryCode ?? ""}
                placeholder="225"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="destinationCountry">País destino</Label>
              <Input
                id="destinationCountry"
                name="destinationCountry"
                defaultValue={result.filters.destinationCountryCode ?? ""}
                placeholder="225"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="customsOffice">Aduana</Label>
              <Input
                id="customsOffice"
                name="customsOffice"
                defaultValue={result.filters.customsOfficeCode ?? ""}
                placeholder="39"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="transportMode">Vía transporte</Label>
              <Input
                id="transportMode"
                name="transportMode"
                defaultValue={result.filters.transportModeCode ?? ""}
                placeholder="1"
              />
            </div>
          </form>
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
        <CardContent className="p-0">
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
