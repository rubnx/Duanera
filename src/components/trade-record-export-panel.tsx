import { AlertTriangle, Download, FileText } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  buildTradeRecordExportHref,
  createTradeRecordExportPlan,
} from "@/trade/trade-record-export";
import type { TradeRecordSearchResponse } from "@/trade/trade-record-search";
import type { TradeRecordTableViewId } from "@/trade/trade-record-table-views";

export function TradeRecordExportPanel({
  params,
  result,
  view,
}: {
  params: Record<string, string | string[] | undefined>;
  result: TradeRecordSearchResponse;
  view: TradeRecordTableViewId;
}) {
  const plan = createTradeRecordExportPlan({
    filters: result.filters,
    totalRows: result.pagination.total,
    view,
  });
  const downloadHref = buildTradeRecordExportHref(params, "/api/trade-records/export");
  const xlsxHref = buildTradeRecordExportHref(params, "/api/trade-records/export-xlsx");
  const previewHref = buildTradeRecordExportHref(
    params,
    "/api/trade-records/export-preview",
  );
  const visibleColumns = plan.columns.slice(0, 8);
  const hiddenColumnCount = Math.max(plan.columns.length - visibleColumns.length, 0);
  const estimatedRowsLabel =
    plan.estimatedRows === null
      ? "sin conteo por búsqueda amplia"
      : `${plan.estimatedRows} registros filtrados`;

  return (
    <Card className={cn(plan.allowed ? "border-border" : "border-amber-500/30")}>
      <CardHeader className="flex flex-col gap-3 border-b lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-col gap-1.5">
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-4" aria-hidden="true" />
            Exportación CSV/XLSX controlada
          </CardTitle>
          <CardDescription className="max-w-4xl break-words">
            Vista {plan.viewLabel.toLowerCase()}, {estimatedRowsLabel} y tope de{" "}
            {plan.rowCap} filas. La exportación usa solo campos Aduana normalizados
            y conserva advertencias de identidad y trazabilidad. CSV y XLSX usan la
            misma política de seguridad.
          </CardDescription>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link
            href={previewHref}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Ver plan JSON
          </Link>
          {plan.allowed ? (
            <>
              <Link
                href={downloadHref}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <Download className="size-3.5" aria-hidden="true" />
                Descargar CSV
              </Link>
              <Link
                href={xlsxHref}
                className={buttonVariants({ variant: "default", size: "sm" })}
              >
                <Download className="size-3.5" aria-hidden="true" />
                Descargar XLSX
              </Link>
            </>
          ) : (
            <span
              aria-disabled="true"
              className={buttonVariants({
                variant: "secondary",
                size: "sm",
                className: "pointer-events-none opacity-60",
              })}
            >
              <AlertTriangle className="size-3.5" aria-hidden="true" />
              Exportación bloqueada
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
        <section className="flex min-w-0 flex-col gap-2" aria-label="Filtros exportados">
          <div className="text-xs font-medium uppercase text-muted-foreground">
            Filtros aplicados a la exportación
          </div>
          <div className="flex flex-wrap gap-1.5">
            {plan.appliedFilters.map((filter) => (
              <Badge key={filter} variant="secondary" className="max-w-full break-words">
                {filter}
              </Badge>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {visibleColumns.map((column) => (
              <Badge key={column.key} variant="outline">
                {column.label}
              </Badge>
            ))}
            {hiddenColumnCount > 0 ? (
              <Badge variant="outline">+{hiddenColumnCount} columnas</Badge>
            ) : null}
          </div>
        </section>
        <section className="flex min-w-0 flex-col gap-2" aria-label="Advertencias de exportación">
          {plan.warnings.length > 0 ? (
            <div className="rounded-md border border-amber-500/30 bg-amber-50/50 p-3 text-sm">
              <div className="mb-1 font-medium">Antes de descargar</div>
              <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
                {plan.warnings.map((warning) => (
                  <li key={warning.code}>{warning.message}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-50/50 p-3 text-sm">
              <div className="font-medium">Exportación permitida</div>
              <div className="text-muted-foreground">
                El resultado está acotado y dentro del tope CSV/XLSX MVP.
              </div>
            </div>
          )}
          <ul className="space-y-1 text-xs text-muted-foreground">
            {plan.caveats.map((caveat) => (
              <li key={caveat}>{caveat}</li>
            ))}
          </ul>
        </section>
      </CardContent>
    </Card>
  );
}
