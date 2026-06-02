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
import { isInternalToolsEnabled } from "@/research/internal-research-access";
import {
  getMarch2026DataQualityReport,
  type DataQualityFieldCoverage,
  type DataQualityFinding,
  type DataQualityIssueGroup,
  type DataQualityIssueSample,
  type DataQualityLabelCoverage,
  type DataQualityPayloadCoverage,
  type DataQualitySourceBatchRemediation,
  type DataQualityStatus,
  type DataQualitySourceCoverage,
} from "@/quality/data-quality";
import type { TradeFlow } from "@/trade/trade-records";

export const dynamic = "force-dynamic";

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-CL", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("es-CL", {
    maximumFractionDigits: 1,
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
  }).format(value);
}

function formatMaybe(value: string | number | null | undefined, fallback = "Sin dato") {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  return String(value);
}

function flowLabel(value: TradeFlow | "unknown") {
  if (value === "import") {
    return "Importaciones";
  }

  if (value === "export") {
    return "Exportaciones";
  }

  return "Sin flujo";
}

function statusLabel(value: DataQualityStatus) {
  const labels: Record<DataQualityStatus, string> = {
    ok: "Confiable",
    review: "Revisar",
    warning: "Riesgo",
  };

  return labels[value];
}

function statusClasses(value: DataQualityStatus) {
  const classes: Record<DataQualityStatus, string> = {
    ok: "border-emerald-600/30 bg-emerald-50 text-emerald-900",
    review: "border-amber-600/30 bg-amber-50 text-amber-900",
    warning: "border-red-600/30 bg-red-50 text-red-900",
  };

  return classes[value];
}

function StatusBadge({ status }: { status: DataQualityStatus }) {
  return (
    <span
      className={`inline-flex w-fit items-center rounded-md border px-2 py-0.5 text-xs font-medium ${statusClasses(status)}`}
    >
      {statusLabel(status)}
    </span>
  );
}

function Metric({
  help,
  label,
  status,
  value,
}: {
  help?: string;
  label: string;
  status?: DataQualityStatus;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-background px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs text-muted-foreground">{label}</div>
        {status ? <StatusBadge status={status} /> : null}
      </div>
      <div className="mt-1 break-words font-mono text-sm font-medium">{value}</div>
      {help ? <div className="mt-1 text-xs leading-5 text-muted-foreground">{help}</div> : null}
    </div>
  );
}

function sourceRowStatus(row: DataQualitySourceCoverage): DataQualityStatus {
  if (row.failedRows > 0 || row.rawRows !== row.tradeRecords) {
    return "warning";
  }

  if (row.batchStatus !== "completed") {
    return "review";
  }

  return "ok";
}

function findingLead(finding: DataQualityFinding) {
  if (finding.status === "ok") {
    return "Se puede usar";
  }

  if (finding.status === "warning") {
    return "No confiar sin revisión";
  }

  return "Revisar contexto";
}

function FieldCoverageTable({
  fields,
  title,
}: {
  fields: DataQualityFieldCoverage[];
  title: string;
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          Cobertura de campos comerciales normalizados. Un campo completo no implica que
          el dato sea identidad legal o que sea comparable sin revisar unidad/flujo.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead>Campo</TableHead>
                <TableHead className="text-right">Cobertura</TableHead>
                <TableHead className="text-right">Registros</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Uso seguro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field) => (
                <TableRow key={`${field.tradeFlow}:${field.key}`}>
                  <TableCell className="align-top font-medium">{field.label}</TableCell>
                  <TableCell className="align-top text-right font-mono text-xs">
                    {formatPercent(field.percent)}%
                  </TableCell>
                  <TableCell className="align-top text-right font-mono text-xs">
                    {formatNumber(field.covered)} / {formatNumber(field.total)}
                  </TableCell>
                  <TableCell className="align-top">
                    <StatusBadge status={field.status} />
                  </TableCell>
                  <TableCell className="max-w-[360px] align-top text-sm text-muted-foreground">
                    {field.caveat}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function LabelCoverageTable({ rows }: { rows: DataQualityLabelCoverage[] }) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Etiquetas decodificadas</CardTitle>
        <CardDescription>
          Revisa si los códigos principales de Aduana tienen etiqueta disponible en las
          tablas cargadas. La UI debe conservar el código fuente aunque la etiqueta falte.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[960px]">
            <TableHeader>
              <TableRow>
                <TableHead>Flujo</TableHead>
                <TableHead>Dimensión</TableHead>
                <TableHead className="text-right">Códigos</TableHead>
                <TableHead className="text-right">Registros decodificados</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Códigos sin match</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={`${row.tradeFlow}:${row.key}:${row.label}`}>
                  <TableCell className="align-top">{flowLabel(row.tradeFlow)}</TableCell>
                  <TableCell className="align-top">
                    <div className="font-medium">{row.label}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{row.caveat}</div>
                  </TableCell>
                  <TableCell className="align-top text-right font-mono text-xs">
                    {formatNumber(row.decodedCodes)} / {formatNumber(row.distinctCodes)}
                  </TableCell>
                  <TableCell className="align-top text-right font-mono text-xs">
                    {formatPercent(row.percent)}%
                    <div className="mt-1 text-muted-foreground">
                      {formatNumber(row.recordsWithDecodedCode)} /{" "}
                      {formatNumber(row.recordsWithCode)}
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <StatusBadge status={row.status} />
                  </TableCell>
                  <TableCell className="max-w-[280px] align-top font-mono text-xs">
                    {row.undecodedCodes.length > 0
                      ? row.undecodedCodes.join(", ")
                      : "Sin faltantes"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function PayloadCoverageTable({ rows }: { rows: DataQualityPayloadCoverage[] }) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Payload crudo</CardTitle>
        <CardDescription>
          Estado de retención para auditoría y reproducibilidad. Esta vista no expone
          rutas locales ni claves privadas de almacenamiento.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[680px]">
            <TableHeader>
              <TableRow>
                <TableHead>Flujo</TableHead>
                <TableHead>Retención</TableHead>
                <TableHead>Almacenamiento</TableHead>
                <TableHead>Reconstruible</TableHead>
                <TableHead className="text-right">Filas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={`${row.tradeFlow}:${row.retentionMode}:${row.storageKind}:${row.reconstructable}`}
                >
                  <TableCell>{flowLabel(row.tradeFlow)}</TableCell>
                  <TableCell className="font-mono text-xs">{row.retentionMode}</TableCell>
                  <TableCell className="font-mono text-xs">{row.storageKind}</TableCell>
                  <TableCell>{row.reconstructable ? "Sí" : "No"}</TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {formatNumber(row.rows)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function issueCountSummary(row: DataQualitySourceBatchRemediation) {
  const counts = row.issueCounts;
  const parts = [
    counts.missingImportGrossWeightItem > 0
      ? `Peso item ${formatNumber(counts.missingImportGrossWeightItem)}`
      : null,
    counts.undecodedCustomsOffice > 0
      ? `Aduanas ${formatNumber(counts.undecodedCustomsOffice)}`
      : null,
    counts.undecodedPort > 0 ? `Puertos ${formatNumber(counts.undecodedPort)}` : null,
    counts.undecodedTransportMode > 0
      ? `Vías ${formatNumber(counts.undecodedTransportMode)}`
      : null,
    counts.missingOrZeroItemValue > 0
      ? `Valor item ${formatNumber(counts.missingOrZeroItemValue)}`
      : null,
    counts.missingOrZeroDeclarationFob > 0
      ? `FOB declaración ${formatNumber(counts.missingOrZeroDeclarationFob)}`
      : null,
    counts.quantityUnitValueReview > 0
      ? `Cantidad/unidad ${formatNumber(counts.quantityUnitValueReview)}`
      : null,
  ].filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join(" · ") : "Sin señales priorizadas";
}

function SourceBatchRemediationTable({
  rows,
}: {
  rows: DataQualitySourceBatchRemediation[];
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Fuentes y lotes para remediación QA</CardTitle>
        <CardDescription>
          Ranking interno de fuentes/lotes con señales QA de marzo 2026. Es guía de
          revisión técnica, no certificación legal ni evidencia de identidad de empresas.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[1120px]">
            <TableHeader>
              <TableRow>
                <TableHead>Fuente / lote</TableHead>
                <TableHead>Flujo / parser</TableHead>
                <TableHead className="text-right">Señales QA</TableHead>
                <TableHead>Detalle de señales</TableHead>
                <TableHead>Próximo paso</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-16 text-center text-muted-foreground">
                    No hay fuentes/lotes con señales QA priorizadas para marzo 2026.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={`${row.sourceFileId}:${row.importBatchId}:${row.tradeFlow}`}>
                    <TableCell className="max-w-[300px] align-top">
                      <Link
                        href={row.sourceHref}
                        className="block break-words font-medium underline-offset-4 hover:underline"
                      >
                        {row.filename}
                      </Link>
                      <div className="mt-1 font-mono text-xs text-muted-foreground">
                        Lote {row.importBatchId.slice(0, 8)}
                      </div>
                    </TableCell>
                    <TableCell className="align-top text-sm">
                      <div>{flowLabel(row.tradeFlow)}</div>
                      <div className="mt-1 font-mono text-xs text-muted-foreground">
                        {row.parserName} · {row.parserVersion}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Estado lote {row.batchStatus}
                      </div>
                    </TableCell>
                    <TableCell className="align-top text-right">
                      <div className="font-mono text-xs">
                        {formatNumber(row.totalIssueSignals)}
                      </div>
                      <div className="mt-1">
                        <StatusBadge status={row.status} />
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[300px] align-top text-sm text-muted-foreground">
                      {issueCountSummary(row)}
                      <div className="mt-1 font-mono text-xs">
                        Registros lote {formatNumber(row.tradeRecords)}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[320px] align-top text-sm text-muted-foreground">
                      {row.nextStep}
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex flex-col gap-1 text-xs">
                        <Link
                          href={row.sourceHref}
                          className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                        >
                          Ver fuente/lote
                        </Link>
                        {row.tradeRecordsHref ? (
                          <Link
                            href={row.tradeRecordsHref}
                            className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                          >
                            Ver registros filtrados
                          </Link>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function IssueSampleTable({ samples }: { samples: DataQualityIssueSample[] }) {
  if (samples.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
        Sin muestras para este criterio en la base dev actual.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[1040px]">
        <TableHeader>
          <TableRow>
            <TableHead>Registro</TableHead>
            <TableHead>Valor/cantidad</TableHead>
            <TableHead>Códigos</TableHead>
            <TableHead>Evidencia</TableHead>
            <TableHead>Fuente</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {samples.map((sample) => (
            <TableRow key={sample.id}>
              <TableCell className="max-w-[300px] align-top">
                <Link
                  href={sample.recordHref}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {flowLabel(sample.tradeFlow)} · fila {formatNumber(sample.rawRowNumber)}
                </Link>
                <div className="mt-1 font-mono text-xs text-muted-foreground">
                  {formatMaybe(sample.hsCodeNormalized)} · item {formatMaybe(sample.itemNumber)}
                </div>
                <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {formatMaybe(sample.productDescriptionRaw)}
                </div>
              </TableCell>
              <TableCell className="align-top text-xs">
                <div>
                  <span className="text-muted-foreground">{sample.itemValueLabel}: </span>
                  <span className="font-mono">{formatMaybe(sample.itemValue)}</span>
                </div>
                <div className="mt-1">
                  <span className="text-muted-foreground">FOB declaración: </span>
                  <span className="font-mono">
                    {formatMaybe(sample.declarationFobValue)}
                  </span>
                </div>
                <div className="mt-1">
                  <span className="text-muted-foreground">Cantidad: </span>
                  <span className="font-mono">
                    {formatMaybe(sample.quantity)} {formatMaybe(sample.quantityUnitCode, "")}
                  </span>
                </div>
                <div className="mt-1">
                  <span className="text-muted-foreground">Precio unitario: </span>
                  <span className="font-mono">{formatMaybe(sample.unitPriceValue)}</span>
                </div>
                <div className="mt-1">
                  <span className="text-muted-foreground">Peso item/total: </span>
                  <span className="font-mono">
                    {formatMaybe(sample.grossWeightItem)} /{" "}
                    {formatMaybe(sample.grossWeightTotal)}
                  </span>
                </div>
              </TableCell>
              <TableCell className="align-top font-mono text-xs">
                <div>Aduana {formatMaybe(sample.customsOfficeCode)}</div>
                <div className="mt-1">Puerto {formatMaybe(sample.relevantPortCode)}</div>
                <div className="mt-1">Vía {formatMaybe(sample.transportModeCode)}</div>
              </TableCell>
              <TableCell className="max-w-[260px] align-top text-sm text-muted-foreground">
                {sample.evidence}
              </TableCell>
              <TableCell className="max-w-[260px] align-top text-xs">
                <Link
                  href={sample.sourceHref}
                  className="block break-words font-medium underline-offset-4 hover:underline"
                >
                  {sample.sourceFilename}
                </Link>
                <div className="mt-1 font-mono text-muted-foreground">
                  Lote {sample.importBatchId.slice(0, 8)}
                </div>
                {sample.sourceTradeRecordsHref ? (
                  <Link
                    href={sample.sourceTradeRecordsHref}
                    className="mt-2 inline-flex font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    Ver registros de la fuente
                  </Link>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function IssueGroupCard({ group }: { group: DataQualityIssueGroup }) {
  return (
    <article className="rounded-lg border border-border bg-background">
      <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={group.status} />
            <span className="font-mono text-xs text-muted-foreground">
              {formatNumber(group.count)} registros
            </span>
          </div>
          <h2 className="mt-2 text-base font-semibold">{group.title}</h2>
          <p className="mt-1 max-w-4xl text-sm leading-6 text-muted-foreground">
            {group.description}
          </p>
        </div>
        <Link
          href={group.tradeRecordsHref}
          className="w-fit whitespace-nowrap text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Ver búsqueda relacionada
        </Link>
      </div>
      <div className="p-4">
        <div className="mb-3 text-xs text-muted-foreground">
          Mostrando hasta {group.sampleLimit} muestras. La lista relacionada puede ser
          amplia y no siempre filtra exactamente el criterio de QA.
        </div>
        <IssueSampleTable samples={group.samples} />
      </div>
    </article>
  );
}

function IssueGroupsSection({ groups }: { groups: DataQualityIssueGroup[] }) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Drilldowns de QA</CardTitle>
        <CardDescription>
          Muestras accionables para investigar campos comerciales incompletos, etiquetas
          faltantes y combinaciones de valor/cantidad que pueden confundir análisis. Las
          muestras enlazan a registro, fuente y lote sin exponer rutas locales.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 pt-4">
        {groups.map((group) => (
          <IssueGroupCard key={group.key} group={group} />
        ))}
      </CardContent>
    </Card>
  );
}

export default async function DataQualityPage() {
  if (!isInternalToolsEnabled()) {
    notFound();
  }

  const report = await getMarch2026DataQualityReport(db);
  const importFields = report.fieldCoverage.filter((field) => field.tradeFlow === "import");
  const exportFields = report.fieldCoverage.filter((field) => field.tradeFlow === "export");

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 py-5 lg:px-6">
      <header className="flex flex-col gap-3 border-b pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <Badge variant="outline" className="w-fit">
            Calidad interna
          </Badge>
          <h1 className="text-2xl font-semibold tracking-tight">
            Calidad y cobertura Marzo 2026
          </h1>
          <p className="max-w-5xl text-sm leading-6 text-muted-foreground">
            Panel interno solo lectura para decidir qué tan confiables son los registros
            Aduana normalizados del MVP. Mide cobertura, trazabilidad, etiquetas
            decodificadas y riesgos de uso comercial sin crear identidad de empresas.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link
            href="/data-quality/load-readiness"
            className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Preparación carga
          </Link>
          <Link
            href="/data-quality/remediation"
            className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Remediación
          </Link>
          <Link
            href="/data-quality/code-tables"
            className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Tablas de códigos
          </Link>
          <Link
            href="/data-quality/field-mapping"
            className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Mapeo de campos
          </Link>
          <Link
            href="/trade-records"
            className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Registros
          </Link>
          <Link
            href="/sources"
            className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Fuentes
          </Link>
          <Link
            href="/"
            className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Inicio
          </Link>
        </div>
      </header>

      <Card className="border-amber-500/30 bg-amber-50/40">
        <CardHeader>
          <CardTitle>Lectura segura</CardTitle>
          <CardDescription className="leading-6">
            Esta página es interna y no certifica calidad legal. Los valores se leen desde
            la base dev actual; los correlativos importador/exportador son identificadores
            anónimos de Aduana, no RUTs, razones sociales ni identidades verificadas. Las
            métricas de importación y exportación se evalúan con campos distintos para no
            tratar CIF vacío como defecto de exportación.
          </CardDescription>
        </CardHeader>
      </Card>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Metric label="Período" value={report.period.label} />
        <Metric label="Filas crudas" value={formatNumber(report.totals.rawRows)} />
        <Metric
          label="Registros normalizados"
          value={formatNumber(report.totals.tradeRecords)}
        />
        <Metric
          label="Filas fallidas"
          status={report.totals.failedRows === 0 ? "ok" : "warning"}
          value={formatNumber(report.totals.failedRows)}
        />
        <Metric
          label="Diferencia raw-normalizado"
          status={report.totals.rawToTradeDelta === 0 ? "ok" : "warning"}
          value={formatNumber(report.totals.rawToTradeDelta)}
        />
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        {report.flows.map((flow) => (
          <Card key={flow.tradeFlow}>
            <CardHeader className="border-b">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>{flowLabel(flow.tradeFlow)}</CardTitle>
                  <CardDescription>
                    Cobertura raw a registro normalizado para {report.period.label}.
                  </CardDescription>
                </div>
                <StatusBadge status={flow.status} />
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 pt-4 sm:grid-cols-2">
              <Metric label="Filas crudas" value={formatNumber(flow.rawRows)} />
              <Metric label="Parseadas" value={formatNumber(flow.parsedRows)} />
              <Metric label="Fallidas" value={formatNumber(flow.failedRows)} />
              <Metric label="Registros" value={formatNumber(flow.tradeRecords)} />
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Fuentes y lotes</CardTitle>
          <CardDescription>
            Cada fila enlaza a la fuente/lote y a los registros filtrados por esos IDs.
            Los nombres mostrados son nombres de archivo saneados, no rutas locales.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[1040px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Fuente</TableHead>
                  <TableHead>Flujo</TableHead>
                  <TableHead className="text-right">Crudas</TableHead>
                  <TableHead className="text-right">Parseadas</TableHead>
                  <TableHead className="text-right">Registros</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.sourceCoverage.map((row) => (
                  <TableRow key={`${row.sourceFileId}:${row.importBatchId}:${row.tradeFlow}`}>
                    <TableCell className="max-w-[340px] align-top">
                      <Link
                        href={row.sourceHref}
                        className="block break-words font-medium underline-offset-4 hover:underline"
                      >
                        {row.filename}
                      </Link>
                      <div className="mt-1 font-mono text-xs text-muted-foreground">
                        Lote {row.importBatchId.slice(0, 8)}
                      </div>
                    </TableCell>
                    <TableCell className="align-top">{flowLabel(row.tradeFlow)}</TableCell>
                    <TableCell className="align-top text-right font-mono text-xs">
                      {formatNumber(row.rawRows)}
                    </TableCell>
                    <TableCell className="align-top text-right font-mono text-xs">
                      {formatNumber(row.parsedRows)}
                    </TableCell>
                    <TableCell className="align-top text-right font-mono text-xs">
                      {formatNumber(row.tradeRecords)}
                    </TableCell>
                    <TableCell className="align-top">
                      <StatusBadge status={sourceRowStatus(row)} />
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex flex-col gap-1 text-xs">
                        <Link
                          href={row.sourceHref}
                          className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                        >
                          Ver fuente/lote
                        </Link>
                        {row.tradeRecordsHref ? (
                          <Link
                            href={row.tradeRecordsHref}
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

      <section className="grid gap-4 xl:grid-cols-2">
        <FieldCoverageTable fields={importFields} title="Cobertura importaciones" />
        <FieldCoverageTable fields={exportFields} title="Cobertura exportaciones" />
      </section>

      <LabelCoverageTable rows={report.labelCoverage} />
      <PayloadCoverageTable rows={report.payloadCoverage} />
      <SourceBatchRemediationTable rows={report.sourceBatchRemediation} />
      <IssueGroupsSection groups={report.issueGroups} />

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Hallazgos de uso comercial</CardTitle>
          <CardDescription>
            Lectura resumida para decidir qué revisar antes de ampliar datos o exponer la
            experiencia fuera del entorno interno.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 pt-4 md:grid-cols-2">
          {report.findings.map((finding) => (
            <article
              key={`${finding.title}:${finding.detail}`}
              className="rounded-lg border border-border bg-background p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={finding.status} />
                <span className="text-xs font-medium text-muted-foreground">
                  {findingLead(finding)}
                </span>
              </div>
              <h2 className="mt-2 text-sm font-semibold">{finding.title}</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {finding.detail}
              </p>
            </article>
          ))}
        </CardContent>
      </Card>
    </main>
  );
}
