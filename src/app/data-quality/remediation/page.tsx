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
import type { DataQualityStatus } from "@/quality/data-quality";
import {
  getMarch2026RemediationQueueReport,
  type RemediationQueueConfidence,
  type RemediationQueueImpact,
  type RemediationQueueIssueType,
  type RemediationQueueItem,
} from "@/quality/remediation-queue";
import { isInternalToolsEnabled } from "@/research/internal-research-access";
import type { TradeFlow } from "@/trade/trade-records";

export const dynamic = "force-dynamic";

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-CL", {
    maximumFractionDigits: 0,
  }).format(value);
}

function flowLabel(value: TradeFlow | "mixed" | null) {
  if (value === "import") {
    return "Importaciones";
  }

  if (value === "export") {
    return "Exportaciones";
  }

  if (value === "mixed") {
    return "Mixto";
  }

  return "Sin flujo único";
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

function issueTypeLabel(value: RemediationQueueIssueType) {
  const labels: Record<RemediationQueueIssueType, string> = {
    code_table: "Tabla de códigos",
    field_coverage: "Cobertura de campo",
    field_mapping: "Mapeo de campo",
    payload_retention: "Payload crudo",
    qa_drilldown: "Drilldown QA",
    source_batch: "Fuente/lote",
  };

  return labels[value];
}

function impactLabel(value: RemediationQueueImpact) {
  const labels: Record<RemediationQueueImpact, string> = {
    commercial_values: "Valores comerciales",
    comparability: "Comparabilidad",
    internal_context: "Contexto interno",
    payload: "Retención payload",
    provenance: "Proveniencia",
    visible_mvp: "MVP visible",
  };

  return labels[value];
}

function confidenceLabel(value: RemediationQueueConfidence) {
  const labels: Record<RemediationQueueConfidence, string> = {
    inferred_signal: "Señal inferida",
    needs_review: "Requiere revisión",
    verified_signal: "Señal verificada",
  };

  return labels[value];
}

function Metric({
  help,
  label,
  value,
}: {
  help?: string;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-background px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 break-words font-mono text-sm font-medium">{value}</div>
      {help ? <div className="mt-1 text-xs leading-5 text-muted-foreground">{help}</div> : null}
    </div>
  );
}

function LinkList({ item }: { item: RemediationQueueItem }) {
  return (
    <div className="flex flex-col gap-1 text-xs">
      {item.links.map((link) => (
        <Link
          key={`${item.id}:${link.href}`}
          href={link.href}
          className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}

function QueueTable({ items }: { items: RemediationQueueItem[] }) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Cola priorizada</CardTitle>
        <CardDescription>
          Ordenada por severidad, impacto en el MVP visible, registros afectados y
          confianza de la señal. Es una guía de trabajo interno, no una certificación de
          calidad legal.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[1320px]">
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Flujo / fuente</TableHead>
                <TableHead>Tipo e impacto</TableHead>
                <TableHead className="text-right">Afectados</TableHead>
                <TableHead>Próximo paso seguro</TableHead>
                <TableHead>Enlaces</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-16 text-center text-muted-foreground">
                    No hay items de remediación priorizados con la base dev actual.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="max-w-[340px] align-top">
                      <div className="font-medium">{item.title}</div>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {item.description}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <StatusBadge status={item.status} />
                        <Badge variant="outline">{confidenceLabel(item.confidence)}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[260px] align-top text-sm">
                      <div>{flowLabel(item.tradeFlow)}</div>
                      {item.sourceLabel ? (
                        <div className="mt-1 break-words text-xs text-muted-foreground">
                          {item.sourceLabel}
                        </div>
                      ) : (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Sin fuente/lote único
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[260px] align-top text-sm">
                      <div>{issueTypeLabel(item.issueType)}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Impacto: {impactLabel(item.impact)}
                      </div>
                    </TableCell>
                    <TableCell className="align-top text-right font-mono text-xs">
                      {formatNumber(item.affectedRecords)}
                      <div className="mt-1 text-muted-foreground">señales/registros</div>
                    </TableCell>
                    <TableCell className="max-w-[320px] align-top text-sm text-muted-foreground">
                      {item.nextAction}
                    </TableCell>
                    <TableCell className="max-w-[240px] align-top">
                      <LinkList item={item} />
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

export default async function DataQualityRemediationPage() {
  if (!isInternalToolsEnabled()) {
    notFound();
  }

  const report = await getMarch2026RemediationQueueReport(db);

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 py-5 lg:px-6">
      <header className="flex flex-col gap-3 border-b pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <Badge variant="outline" className="w-fit">
            Remediación QA interna
          </Badge>
          <h1 className="text-2xl font-semibold tracking-tight">
            Cola de remediación Marzo 2026
          </h1>
          <p className="max-w-5xl text-sm leading-6 text-muted-foreground">
            Vista solo lectura para decidir qué revisar antes de cargar más meses.
            Combina señales de cobertura, mapeo, tablas de códigos, payload crudo y
            fuente/lote sin modificar datos ni inferir identidad legal.
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
            href="/data-quality"
            className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Calidad
          </Link>
          <Link
            href="/data-quality/field-mapping"
            className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Mapeo de campos
          </Link>
          <Link
            href="/data-quality/code-tables"
            className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Tablas de códigos
          </Link>
          <Link
            href="/sources"
            className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Fuentes
          </Link>
          <Link
            href="/trade-records"
            className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Registros
          </Link>
        </div>
      </header>

      <Card className="border-amber-500/30 bg-amber-50/40">
        <CardHeader>
          <CardTitle>Lectura segura</CardTitle>
          <CardDescription className="leading-6">
            Esta cola no cambia datos ni confirma que una brecha ya esté resuelta. Los
            conteos son señales internas de la base dev actual; los correlativos Aduana
            siguen siendo anónimos y no son RUTs, razones sociales ni identidades
            verificadas.
          </CardDescription>
        </CardHeader>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Período" value={report.period.label} />
        <Metric label="Items priorizados" value={formatNumber(report.summary.totalItems)} />
        <Metric label="Riesgo" value={formatNumber(report.summary.warningItems)} />
        <Metric label="Revisar" value={formatNumber(report.summary.reviewItems)} />
        <Metric
          help="Suma de señales; un registro puede aparecer en más de un item."
          label="Señales afectadas"
          value={formatNumber(report.summary.affectedRecordSignals)}
        />
      </section>

      <QueueTable items={report.items} />
    </main>
  );
}
