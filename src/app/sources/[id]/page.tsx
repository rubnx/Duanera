import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

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
  getSourceProvenanceById,
  sourceDisplayFilename,
  sourceFilenameLabel,
  sourcePeriodLabel,
  sourceTradeRecordsHref,
  type ImportBatchProvenance,
  type SourceFlowCoverage,
  type SourceProvenanceDetail,
} from "@/sources/source-provenance";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "No informado";
  }

  return new Intl.NumberFormat("es-CL", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatBytes(value: number | null) {
  if (!value) {
    return "No informado";
  }

  return new Intl.NumberFormat("es-CL", {
    maximumFractionDigits: 1,
    style: "unit",
    unit: "megabyte",
  }).format(value / 1_000_000);
}

function formatDateTime(value: Date | null) {
  if (!value) {
    return "No informado";
  }

  return value.toISOString();
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

function sourceTradeFlow(value: string | null) {
  return value === "import" || value === "export" ? value : undefined;
}

function fileRoleLabel(value: string) {
  const labels: Record<string, string> = {
    compressed_source_file: "Archivo oficial comprimido",
    direct_source_file: "Archivo directo",
    reference_file: "Referencia oficial",
  };

  return labels[value] ?? value;
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

function periodLabelForCoverage(coverage: SourceFlowCoverage) {
  return `${coverage.periodYear}-${String(coverage.periodMonth).padStart(2, "0")}`;
}

function Field({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | number | null | undefined;
  mono?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className={mono ? "break-words font-mono text-xs" : "break-words text-sm"}>
        {value ?? "No informado"}
      </dd>
    </div>
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

function BatchRows({
  batches,
  source,
}: {
  batches: ImportBatchProvenance[];
  source: SourceProvenanceDetail;
}) {
  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[980px]">
        <TableHeader>
          <TableRow>
            <TableHead>Lote</TableHead>
            <TableHead>Parser</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Filas declaradas</TableHead>
            <TableHead className="text-right">Filas crudas</TableHead>
            <TableHead className="text-right">Registros</TableHead>
            <TableHead>Fechas</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {batches.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="h-16 text-center text-muted-foreground">
                Esta fuente no tiene lotes de importación registrados.
              </TableCell>
            </TableRow>
          ) : (
            batches.map((batch) => (
              <TableRow key={batch.id} id={`batch-${batch.id}`} className="scroll-mt-4">
                <TableCell className="max-w-[220px] align-top font-mono text-xs">
                  {batch.id}
                </TableCell>
                <TableCell className="align-top">
                  <div>{batch.parserName}</div>
                  <div className="mt-1 font-mono text-xs text-muted-foreground">
                    {batch.parserVersion}
                  </div>
                </TableCell>
                <TableCell className="align-top">
                  <Badge variant={batch.status === "completed" ? "secondary" : "outline"}>
                    {statusLabel(batch.status)}
                  </Badge>
                  {batch.warningSummary || batch.errorSummary ? (
                    <div className="mt-2 max-w-[240px] text-xs text-muted-foreground">
                      {batch.warningSummary ?? batch.errorSummary}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell className="align-top text-right font-mono text-xs">
                  {formatNumber(batch.rowsTotal)}
                </TableCell>
                <TableCell className="align-top text-right font-mono text-xs">
                  {formatNumber(batch.rawRowCount)}
                  <div className="mt-1 text-muted-foreground">
                    Parseadas {formatNumber(batch.parsedRawRowCount)} · Fallidas{" "}
                    {formatNumber(batch.failedRawRowCount)}
                  </div>
                </TableCell>
                <TableCell className="align-top text-right font-mono text-xs">
                  {formatNumber(batch.tradeRecordCount)}
                </TableCell>
                <TableCell className="align-top text-xs">
                  <div>Inicio {formatDateTime(batch.startedAt)}</div>
                  <div className="mt-1 text-muted-foreground">
                    Fin {formatDateTime(batch.completedAt)}
                  </div>
                </TableCell>
                <TableCell className="align-top">
                  {batch.tradeRecordCount > 0 ? (
                    <Link
                      href={sourceTradeRecordsHref({
                        sourceFileId: source.id,
                        importBatchId: batch.id,
                        tradeFlow: sourceTradeFlow(source.tradeFlow),
                      })}
                      className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    >
                      Ver registros
                    </Link>
                  ) : (
                    <span className="text-xs text-muted-foreground">Sin registros</span>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export default async function SourceDetailPage({ params }: PageProps) {
  const { id } = await params;
  const source = await getSourceProvenanceById(db, id);

  if (!source) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-4 py-5 lg:px-6">
      <header className="flex flex-col gap-4 border-b pb-4">
        <Link
          href="/sources"
          className="inline-flex w-fit items-center gap-1 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <ArrowLeft className="size-4" />
          Fuentes
        </Link>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{flowLabel(source.tradeFlow)}</Badge>
            <Badge variant="outline">{sourcePeriodLabel(source)}</Badge>
            <Badge variant="outline">{statusLabel(source.processingStatus)}</Badge>
          </div>
          <h1 className="max-w-5xl break-words text-2xl font-semibold tracking-tight">
            {sourceDisplayFilename(source)}
          </h1>
          <p className="max-w-4xl text-sm leading-6 text-muted-foreground">
            Trazabilidad solo lectura del archivo fuente, sus lotes y los registros
            normalizados derivados. No se muestran rutas locales, claves de objeto R2,
            URLs privadas ni credenciales.
          </p>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Filas crudas" value={formatNumber(source.rawRowCount)} />
        <Metric label="Filas parseadas" value={formatNumber(source.parsedRawRowCount)} />
        <Metric label="Registros normalizados" value={formatNumber(source.tradeRecordCount)} />
        <Metric label="Lotes" value={formatNumber(source.importBatchCount)} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Archivo fuente</CardTitle>
            <CardDescription>
              Metadatos registrados en Postgres. Los archivos oficiales siguen
              preservados fuera de la base de datos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 md:grid-cols-2">
              <Field
                label="Nombre original"
                value={sourceFilenameLabel(source.originalFilename)}
              />
              <Field
                label="Nombre normalizado raw"
                value={sourceFilenameLabel(source.normalizedRawFilename)}
              />
              <Field
                label="Nombre normalizado working"
                value={sourceFilenameLabel(source.normalizedWorkingFilename)}
              />
              <Field label="Tipo fuente" value={fileRoleLabel(source.fileRole)} />
              <Field label="Dominio fuente" value={source.sourceDomain} />
              <Field label="Sistema fuente" value={source.sourceSystem} />
              <Field label="Categoría" value={source.sourceCategory} />
              <Field label="Método adquisición" value={source.acquisitionMethod} />
              <Field label="Formato" value={source.fileFormat} />
              <Field label="Compresión" value={source.compressionFormat} />
              <Field label="Tamaño" value={formatBytes(source.fileSizeBytes)} mono />
              <Field label="SHA-256" value={source.fileHashSha256} mono />
              <Field label="Período" value={sourcePeriodLabel(source)} />
              <Field label="Flujo" value={flowLabel(source.tradeFlow)} />
              <Field label="Notas licencia" value={source.licenseNotes} />
              <Field
                label="Página pública fuente"
                value={source.sourcePageUrl ? "Registrada en metadatos" : "No informado"}
              />
            </dl>
          </CardContent>
        </Card>

        <aside className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Acceso</CardTitle>
              <CardDescription>Enlaces seguros desde la trazabilidad.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              {source.tradeRecordCount > 0 ? (
                <Link
                  href={sourceTradeRecordsHref({
                    sourceFileId: source.id,
                    tradeFlow: sourceTradeFlow(source.tradeFlow),
                  })}
                  className="inline-flex h-8 w-fit items-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Ver registros de esta fuente
                </Link>
              ) : (
                <p className="text-muted-foreground">
                  Esta fuente no tiene registros normalizados vinculados.
                </p>
              )}
              {source.sourcePageUrl ? (
                <Link
                  href={source.sourcePageUrl}
                  className="w-fit text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Abrir página pública fuente
                </Link>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Los punteros de almacenamiento se validan internamente, pero no se
                muestran porque pueden contener rutas locales o claves privadas.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Almacenamiento</CardTitle>
              <CardDescription>Estado sin exponer ubicaciones privadas.</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4">
                <Field
                  label="Puntero raw registrado"
                  value={source.hasRawStoragePointer ? "Sí, oculto en UI" : "No informado"}
                />
                <Field
                  label="Puntero working registrado"
                  value={source.hasWorkingStoragePointer ? "Sí, oculto en UI" : "No informado"}
                />
                <Field label="Creado" value={formatDateTime(source.createdAt)} mono />
                <Field label="Actualizado" value={formatDateTime(source.updatedAt)} mono />
              </dl>
            </CardContent>
          </Card>
        </aside>
      </section>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Cobertura de registros</CardTitle>
          <CardDescription>
            Conteos por flujo y período derivados de filas crudas y registros
            normalizados vinculados a esta fuente.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Flujo</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-right">Filas crudas</TableHead>
                  <TableHead className="text-right">Registros</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {source.flowCoverage.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-16 text-center text-muted-foreground">
                      No hay cobertura de filas comerciales para esta fuente.
                    </TableCell>
                  </TableRow>
                ) : (
                  source.flowCoverage.map((coverage) => (
                    <TableRow
                      key={`${coverage.tradeFlow}:${coverage.periodYear}:${coverage.periodMonth}`}
                    >
                      <TableCell>{flowLabel(coverage.tradeFlow)}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {periodLabelForCoverage(coverage)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatNumber(coverage.rawRowCount)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatNumber(coverage.tradeRecordCount)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Lotes de importación</CardTitle>
          <CardDescription>
            Intentos de carga asociados al archivo. Los estados y conteos vienen de las
            tablas existentes de importación y normalización.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <BatchRows batches={source.importBatches} source={source} />
        </CardContent>
      </Card>
    </main>
  );
}
