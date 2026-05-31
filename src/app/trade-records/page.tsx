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

function participant(record: Awaited<ReturnType<typeof searchTradeRecords>>["data"][number]) {
  if (record.tradeFlow === "import") {
    return record.importerCorrelativeId ?? "—";
  }

  return record.exporterPrimaryCorrelativeId ?? record.exporterSecondaryCorrelativeId ?? "—";
}

function valueForFlow(record: Awaited<ReturnType<typeof searchTradeRecords>>["data"][number]) {
  return record.tradeFlow === "import"
    ? formatMoney(record.itemCifValue, record.decodedLabels.currency)
    : formatMoney(record.itemFobValue, record.decodedLabels.currency);
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
            Los filtros viajan por URL y usan el servicio `trade-records`.
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
              <Label htmlFor="q">Producto</Label>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Flujo</TableHead>
                <TableHead>Periodo</TableHead>
                <TableHead>HS</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Correlativo</TableHead>
                <TableHead>País</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Cantidad</TableHead>
                <TableHead>Fuente</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                    No encontramos registros con estos filtros. Prueba ampliar el rango
                    de fechas o usar una partida HS más general.
                  </TableCell>
                </TableRow>
              ) : (
                result.data.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <Badge variant="secondary">
                        {record.tradeFlow === "import" ? "Importación" : "Exportación"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {record.periodYear}-{String(record.periodMonth).padStart(2, "0")}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {record.hsCodeNormalized ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-[340px]">
                      <Link
                        href={`/trade-records/${record.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {record.productDescriptionRaw ?? "Sin descripción"}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{participant(record)}</TableCell>
                    <TableCell className="max-w-[220px] text-xs">
                      {record.tradeFlow === "import"
                        ? formatCodeLabel(
                            record.originCountryCode,
                            record.decodedLabels.originCountry,
                          )
                        : formatCodeLabel(
                            record.destinationCountryCode,
                            record.decodedLabels.destinationCountry,
                          )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{valueForFlow(record)}</TableCell>
                    <TableCell className="text-xs">
                      {record.quantity ?? "—"}{" "}
                      {record.decodedLabels.quantityUnit ?? record.quantityUnitCode ?? ""}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {record.sourceFilename} · fila {record.rawRowNumber}
                    </TableCell>
                  </TableRow>
                ))
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
