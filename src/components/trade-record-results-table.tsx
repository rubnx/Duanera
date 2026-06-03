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
import { TradeRecordResultsRow } from "@/components/trade-record-results-row";
import { cn } from "@/lib/utils";
import { buildTradeRecordSearchHref } from "@/trade/trade-record-links";
import {
  tradeRecordTableViewById,
  tradeRecordTableViews,
  type TradeRecordTableViewId,
} from "@/trade/trade-record-table-views";
import type { TradeRecordSearchResponse } from "@/trade/trade-record-search";

const tableViewHeaders = {
  commercial: [
    "Operación",
    "Producto",
    "Correlativo Aduana",
    "Valor item",
    "Cantidad / peso",
    "País",
    "Logística",
    "Fuente",
  ],
  logistics: [
    "Operación",
    "Logística",
    "País / ruta",
    "Producto",
    "Cantidad / peso",
    "Correlativo Aduana",
    "Fuente",
  ],
  product: [
    "Producto / HS",
    "Valores",
    "Cantidad / peso",
    "País",
    "Logística",
    "Correlativo Aduana",
    "Fuente",
  ],
  provenance: [
    "Fuente",
    "Operación",
    "Producto",
    "Correlativo Aduana",
    "Logística",
    "Valor item",
  ],
} satisfies Record<TradeRecordTableViewId, string[]>;

const tableViewMinWidths = {
  commercial: "min-w-[1320px]",
  logistics: "min-w-[1240px]",
  product: "min-w-[1220px]",
  provenance: "min-w-[1120px]",
} satisfies Record<TradeRecordTableViewId, string>;

function buildViewHref(
  params: Record<string, string | string[] | undefined>,
  view: TradeRecordTableViewId,
) {
  return buildTradeRecordSearchHref({
    ...params,
    view,
  });
}

export function TradeRecordResultsTable({
  hasCursor,
  params,
  result,
  view,
}: {
  hasCursor: boolean;
  params: Record<string, string | string[] | undefined>;
  result: TradeRecordSearchResponse;
  view: TradeRecordTableViewId;
}) {
  const activeView = tradeRecordTableViewById(view);
  const headers = tableViewHeaders[view];

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 border-b lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-col gap-1.5">
          <CardTitle>{result.pagination.total} registros</CardTitle>
          <CardDescription>
            Mostrando {result.data.length}
            {hasCursor
              ? " desde el cursor actual."
              : ` desde posición ${result.pagination.offset}.`}
            {" "}Vista {activeView.label.toLowerCase()}: {activeView.description} Esta
            tabla muestra campos Aduana normalizados; contexto operativo adicional de
            fuente requiere una vista de detalle o reconstrucción controlada. La
            columna de fuente conserva trazabilidad segura sin rutas locales, claves
            privadas ni URLs de bucket.
          </CardDescription>
        </div>
        <nav
          aria-label="Cambiar vista de tabla"
          className="flex max-w-full flex-wrap gap-1 rounded-lg border border-border bg-muted/30 p-1"
        >
          {tradeRecordTableViews.map((option) => {
            const isActive = option.id === view;

            return (
              <Link
                key={option.id}
                aria-current={isActive ? "page" : undefined}
                href={buildViewHref(params, option.id)}
                className={cn(
                  "inline-flex h-7 items-center rounded-md px-2.5 text-xs font-medium transition-colors",
                  isActive
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
                )}
              >
                {option.shortLabel}
              </Link>
            );
          })}
        </nav>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <Table className={tableViewMinWidths[view]}>
          <TableHeader>
            <TableRow>
              {headers.map((header) => (
                <TableHead key={header}>{header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={headers.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  No encontramos registros con estos filtros. Prueba ampliar el rango
                  de fechas o usar una partida HS más general.
                </TableCell>
              </TableRow>
            ) : (
              result.data.map((record) => (
                <TradeRecordResultsRow
                  key={record.id}
                  params={params}
                  record={record}
                  view={view}
                />
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
