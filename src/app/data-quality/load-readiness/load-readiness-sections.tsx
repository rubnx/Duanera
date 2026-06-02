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
import { formatIntegerEsCl } from "@/lib/format";
import {
  loadReadinessDecisionLabel,
  loadReadinessDecisionSummary,
  loadReadinessStatusLabel,
  type LoadReadinessArea,
  type LoadReadinessDecision,
  type LoadReadinessLink,
} from "@/quality/load-readiness";

const formatNumber = formatIntegerEsCl;

type LoadReadinessStatus = LoadReadinessArea["status"];

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

export function LoadReadinessDecisionCard({
  decision,
}: {
  decision: LoadReadinessDecision;
}) {
  return (
    <Card className={decisionClasses(decision)}>
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <CardTitle>Decisión operacional: {loadReadinessDecisionLabel(decision)}</CardTitle>
          <DecisionBadge decision={decision} />
        </div>
        <CardDescription className="leading-6 text-current opacity-80">
          {loadReadinessDecisionSummary(decision)}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

export function LoadReadinessSummaryMetrics({
  periodLabel,
  summary,
}: {
  periodLabel: string;
  summary: {
    blockedAreas: number;
    readyAreas: number;
    reviewAreas: number;
    totalAreas: number;
  };
}) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Metric label="Período evidencia" value={periodLabel} />
      <Metric label="Áreas listas" value={formatNumber(summary.readyAreas)} />
      <Metric label="Áreas a revisar" value={formatNumber(summary.reviewAreas)} />
      <Metric label="Áreas bloqueadas" value={formatNumber(summary.blockedAreas)} />
      <Metric
        help="Go solo si no hay áreas bloqueadas; review-first si no hay blockers pero quedan revisiones."
        label="Áreas evaluadas"
        value={formatNumber(summary.totalAreas)}
      />
    </section>
  );
}

export function LoadReadinessAreaCards({ areas }: { areas: LoadReadinessArea[] }) {
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

export function LoadReadinessAreaTable({ areas }: { areas: LoadReadinessArea[] }) {
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
