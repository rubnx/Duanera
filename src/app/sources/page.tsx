import Link from "next/link";

import { Badge } from "@/components/ui/badge";
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
import { db } from "@/db/client";
import {
  listSourceProvenance,
  sourceDisplayFilename,
  sourcePeriodLabel,
  sourceTradeRecordsHref,
  type SourceProvenanceSummary,
} from "@/sources/source-provenance";

export const dynamic = "force-dynamic";

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-CL", {
    maximumFractionDigits: 0,
  }).format(value);
}

function flowLabel(value: string | null) {
  if (value === "import") {
    return "Importaciones";
  }

  if (value === "export") {
    return "Exportaciones";
  }

  return "Referencia";
}

function sourceTypeLabel(source: SourceProvenanceSummary) {
  const labels: Record<string, string> = {
    compressed_source_file: "Archivo oficial comprimido",
    direct_source_file: "Archivo directo",
    reference_file: "Referencia oficial",
  };

  return labels[source.fileRole] ?? source.fileRole;
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    completed: "Completado",
    failed: "Fallido",
    metadata_seeded: "Metadatos cargados",
    partial: "Parcial",
    pending: "Pendiente",
  };

  return labels[value] ?? value;
}

function countSummary(sources: SourceProvenanceSummary[]) {
  return sources.reduce(
    (summary, source) => ({
      sources: summary.sources + 1,
      batches: summary.batches + source.importBatchCount,
      rawRows: summary.rawRows + source.rawRowCount,
      tradeRecords: summary.tradeRecords + source.tradeRecordCount,
    }),
    {
      sources: 0,
      batches: 0,
      rawRows: 0,
      tradeRecords: 0,
    },
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-muted/20 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-sm font-medium">{value}</div>
    </div>
  );
}

export default async function SourcesPage() {
  const sources = await listSourceProvenance(db);
  const totals = countSummary(sources);

  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-4 py-5 lg:px-6">
      <header className="flex flex-col gap-3 border-b pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <Badge variant="outline" className="w-fit">
            Proveniencia
          </Badge>
          <h1 className="text-2xl font-semibold tracking-tight">
            Fuentes e importaciones
          </h1>
          <p className="max-w-4xl text-sm leading-6 text-muted-foreground">
            Inventario solo lectura de archivos fuente, lotes de importación y conteos
            derivados. Esta vista muestra trazabilidad operativa sin exponer rutas
            locales, credenciales, claves privadas de R2 ni URLs de bucket.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link
            href="/trade-records"
            className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Registros
          </Link>
          <Link
            href="/"
            className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Inicio
          </Link>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Archivos fuente" value={formatNumber(totals.sources)} />
        <Metric label="Lotes" value={formatNumber(totals.batches)} />
        <Metric label="Filas crudas" value={formatNumber(totals.rawRows)} />
        <Metric
          label="Registros normalizados"
          value={formatNumber(totals.tradeRecords)}
        />
      </section>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Archivos registrados</CardTitle>
          <CardDescription>
            Incluye archivos oficiales de datos, diccionarios y tablas de códigos.
            Los conteos provienen de las tablas actuales de dev y pueden incluir fuentes
            sin registros normalizados.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[980px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Fuente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Flujo / período</TableHead>
                  <TableHead className="text-right">Filas crudas</TableHead>
                  <TableHead className="text-right">Registros</TableHead>
                  <TableHead>Lotes</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sources.map((source) => (
                  <TableRow key={source.id}>
                    <TableCell className="max-w-[320px] align-top">
                      <Link
                        href={`/sources/${source.id}`}
                        className="block break-words font-medium underline-offset-4 hover:underline"
                      >
                        {sourceDisplayFilename(source)}
                      </Link>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {source.sourceDomain}
                        {source.sourceName ? ` · ${source.sourceName}` : ""}
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div>{sourceTypeLabel(source)}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Estado {statusLabel(source.processingStatus)}
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div>{flowLabel(source.tradeFlow)}</div>
                      <div className="mt-1 font-mono text-xs text-muted-foreground">
                        {sourcePeriodLabel(source)}
                      </div>
                    </TableCell>
                    <TableCell className="align-top text-right font-mono text-xs">
                      {formatNumber(source.rawRowCount)}
                    </TableCell>
                    <TableCell className="align-top text-right font-mono text-xs">
                      {formatNumber(source.tradeRecordCount)}
                    </TableCell>
                    <TableCell className="align-top text-sm">
                      {formatNumber(source.importBatchCount)}
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex flex-col gap-1 text-xs">
                        <Link
                          href={`/sources/${source.id}`}
                          className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                        >
                          Ver fuente
                        </Link>
                        {source.tradeRecordCount > 0 ? (
                          <Link
                            href={sourceTradeRecordsHref({ sourceFileId: source.id })}
                            className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                          >
                            Ver registros
                          </Link>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
