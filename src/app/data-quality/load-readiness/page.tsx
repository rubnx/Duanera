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
  getMarch2026LoadReadinessReport,
  loadReadinessDecisionLabel,
  loadReadinessDecisionSummary,
  loadReadinessStatusLabel,
  type LoadReadinessArea,
  type LoadReadinessDecision,
  type LoadReadinessLink,
  type LoadReadinessStatus,
} from "@/quality/load-readiness";
import { formatIntegerEsCl } from "@/lib/format";
import { isInternalToolsEnabled } from "@/research/internal-research-access";

export const dynamic = "force-dynamic";

const formatNumber = formatIntegerEsCl;

function decisionClasses(value: LoadReadinessDecision) {
  const classes: Record<LoadReadinessDecision, string> = {
    go: "border-emerald-600/30 bg-emerald-50 text-emerald-900",
    "no-go": "border-red-600/30 bg-red-50 text-red-900",
    "review-first": "border-amber-600/30 bg-amber-50 text-amber-900",
  };

  return classes[value];
}

function statusClasses(value: LoadReadinessStatus) {
  const classes: Record<LoadReadinessStatus, string> = {
    blocked: "border-red-600/30 bg-red-50 text-red-900",
    ready: "border-emerald-600/30 bg-emerald-50 text-emerald-900",
    review: "border-amber-600/30 bg-amber-50 text-amber-900",
  };

  return classes[value];
}

function DecisionBadge({ decision }: { decision: LoadReadinessDecision }) {
  return (
    <span
      className={`inline-flex w-fit items-center rounded-md border px-2 py-0.5 text-xs font-medium ${decisionClasses(decision)}`}
    >
      {loadReadinessDecisionLabel(decision)}
    </span>
  );
}

function StatusBadge({ status }: { status: LoadReadinessStatus }) {
  return (
    <span
      className={`inline-flex w-fit items-center rounded-md border px-2 py-0.5 text-xs font-medium ${statusClasses(status)}`}
    >
      {loadReadinessStatusLabel(status)}
    </span>
  );
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

function SafeLink({ item }: { item: LoadReadinessLink }) {
  if (!item.href) {
    return <span className="break-words">{item.label}</span>;
  }

  return (
    <Link
      href={item.href}
      className="break-words font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
    >
      {item.label}
    </Link>
  );
}

function AreaEvidence({ area }: { area: LoadReadinessArea }) {
  return (
    <div className="grid min-w-0 gap-2 sm:grid-cols-2">
      {area.evidence.map((item) => (
        <div
          key={`${area.key}:evidence:${item.label}:${item.href ?? "plain"}`}
          className="min-w-0 rounded-md border border-border bg-background px-3 py-2"
        >
          <div className="text-xs text-muted-foreground">
            <SafeLink item={item} />
          </div>
          <div className="mt-1 break-words font-mono text-xs font-medium">
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function AreaActions({ area }: { area: LoadReadinessArea }) {
  return (
    <ul className="flex min-w-0 flex-col gap-2 text-sm leading-6 text-muted-foreground">
      {area.actions.map((item) => (
        <li
          key={`${area.key}:action:${item.label}:${item.href ?? "plain"}`}
          className="flex min-w-0 gap-2"
        >
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
          <span className="min-w-0 break-words">
            {item.required ? (
              <span className="font-medium text-foreground">Requerido: </span>
            ) : (
              <span className="font-medium text-foreground">Vigilar: </span>
            )}
            <SafeLink item={item} />
          </span>
        </li>
      ))}
    </ul>
  );
}

function AreaCards({ areas }: { areas: LoadReadinessArea[] }) {
  return (
    <section className="grid min-w-0 gap-3 xl:grid-cols-2">
      {areas.map((area) => (
        <Card key={area.key} className="min-w-0">
          <CardHeader className="border-b">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <CardTitle>{area.title}</CardTitle>
              <StatusBadge status={area.status} />
            </div>
            <CardDescription className="leading-6">{area.summary}</CardDescription>
          </CardHeader>
          <CardContent className="flex min-w-0 flex-col gap-4 pt-4">
            <AreaEvidence area={area} />
            <AreaActions area={area} />
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

function AreaTable({ areas }: { areas: LoadReadinessArea[] }) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Checklist go/no-go</CardTitle>
        <CardDescription>
          Matriz operacional para decidir si cargar otro mes en dev. No es una
          aprobación de producción ni una certificación de identidad legal.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[960px]">
            <TableHeader>
              <TableRow>
                <TableHead>Área</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Evidencia principal</TableHead>
                <TableHead>Acción requerida</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {areas.map((area) => (
                <TableRow key={area.key}>
                  <TableCell className="max-w-[260px] align-top">
                    <div className="font-medium">{area.title}</div>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {area.summary}
                    </p>
                  </TableCell>
                  <TableCell className="align-top">
                    <StatusBadge status={area.status} />
                  </TableCell>
                  <TableCell className="max-w-[320px] align-top">
                    <div className="flex flex-col gap-1 text-xs">
                      {area.evidence.slice(0, 4).map((item) => (
                        <div key={`${area.key}:table:evidence:${item.label}`}>
                          <span className="text-muted-foreground">{item.label}: </span>
                          <span className="font-mono">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[360px] align-top text-sm text-muted-foreground">
                    {area.actions.find((action) => action.required)?.label ??
                      "Sin acción requerida"}
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

export default async function LoadReadinessPage() {
  if (!isInternalToolsEnabled()) {
    notFound();
  }

  const report = await getMarch2026LoadReadinessReport(db);

  return (
    <main className="mx-auto flex w-full min-w-0 max-w-[1440px] flex-col gap-4 overflow-x-hidden px-4 py-5 lg:px-6">
      <header className="flex flex-col gap-3 border-b pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <Badge variant="outline" className="w-fit">
            Gate interno de carga
          </Badge>
          <h1 className="text-2xl font-semibold tracking-tight">
            Preparación para cargar otro mes Aduana
          </h1>
          <p className="max-w-5xl text-sm leading-6 text-muted-foreground">
            Vista solo lectura para decidir si la evidencia March 2026 permite
            intentar una carga dev del siguiente mes. El resultado no garantiza
            calidad final, uso productivo ni identidad legal de empresas.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link
            href="/data-quality"
            className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Calidad
          </Link>
          <Link
            href="/data-quality/remediation"
            className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Remediación
          </Link>
          <Link
            href="/data-quality/field-mapping"
            className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Mapeo
          </Link>
          <Link
            href="/data-quality/code-tables"
            className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Códigos
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

      <Card className={decisionClasses(report.decision)}>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <CardTitle>Decisión operacional: {loadReadinessDecisionLabel(report.decision)}</CardTitle>
            <DecisionBadge decision={report.decision} />
          </div>
          <CardDescription className="leading-6 text-current opacity-80">
            {loadReadinessDecisionSummary(report.decision)}
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className="border-amber-500/30 bg-amber-50/40">
        <CardHeader>
          <CardTitle>Lectura segura</CardTitle>
          <CardDescription className="leading-6">
            Este gate usa señales internas de la base dev March 2026. No modifica datos,
            no carga archivos, no promueve producción y no convierte correlativos Aduana
            en RUTs, razones sociales ni identidades legales verificadas.
          </CardDescription>
        </CardHeader>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Período evidencia" value={report.period.label} />
        <Metric label="Áreas listas" value={formatNumber(report.summary.readyAreas)} />
        <Metric label="Áreas a revisar" value={formatNumber(report.summary.reviewAreas)} />
        <Metric label="Áreas bloqueadas" value={formatNumber(report.summary.blockedAreas)} />
        <Metric
          help="Go solo si no hay áreas bloqueadas; review-first si no hay blockers pero quedan revisiones."
          label="Áreas evaluadas"
          value={formatNumber(report.summary.totalAreas)}
        />
      </section>

      <div className="hidden min-w-0 lg:block">
        <AreaTable areas={report.areas} />
      </div>
      <AreaCards areas={report.areas} />
    </main>
  );
}
