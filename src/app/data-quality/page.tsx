import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { DataQualityStatusBadge } from "@/components/data-quality-status-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db } from "@/db/client";
import { isInternalToolsEnabled } from "@/research/internal-research-access";
import {
  getDataQualityReport,
  type DataQualityFinding,
  type DataQualityStatus,
} from "@/quality/data-quality";
import { formatIntegerEsCl } from "@/lib/format";
import type { TradeFlow } from "@/trade/trade-records";
import {
  FieldCoverageTable,
  LabelCoverageTable,
  PayloadCoverageTable,
  SourceCoverageTable,
  SourceBatchRemediationTable,
} from "./coverage-tables";
import { IssueGroupsSection } from "./issue-groups-section";
import {
  QualityNavLinks,
  QualityPeriodScopeCard,
  resolveQualityPeriod,
  type DataQualityPageProps,
} from "./quality-period-scope";
import { listTradeRecordPeriods } from "@/trade/trade-record-periods";

export const dynamic = "force-dynamic";

const formatNumber = formatIntegerEsCl;

function flowLabel(value: TradeFlow | "unknown") {
  if (value === "import") {
    return "Importaciones";
  }

  if (value === "export") {
    return "Exportaciones";
  }

  return "Sin flujo";
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
        {status ? <DataQualityStatusBadge status={status} /> : null}
      </div>
      <div className="mt-1 wrap-break-word font-mono text-sm font-medium">{value}</div>
      {help ? <div className="mt-1 text-xs leading-5 text-muted-foreground">{help}</div> : null}
    </div>
  );
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

export default async function DataQualityPage({ searchParams }: DataQualityPageProps) {
  if (!isInternalToolsEnabled()) {
    notFound();
  }

  const periods = await listTradeRecordPeriods(db);
  const period = await resolveQualityPeriod({ periods, searchParams });
  const report = await getDataQualityReport(db, period);
  const importFields = report.fieldCoverage.filter((field) => field.tradeFlow === "import");
  const exportFields = report.fieldCoverage.filter((field) => field.tradeFlow === "export");

  return (
    <main className="mx-auto flex w-full max-w-360 flex-col gap-4 px-4 py-5 lg:px-6">
      <header className="flex flex-col gap-3 border-b pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <Badge variant="outline" className="w-fit">
            Calidad interna
          </Badge>
          <h1 className="text-2xl font-semibold tracking-tight">
            Calidad y cobertura {report.period.label}
          </h1>
          <p className="max-w-5xl text-sm leading-6 text-muted-foreground">
            Panel interno solo lectura para decidir qué tan confiables son los registros
            Aduana normalizados del MVP. Mide cobertura, trazabilidad, etiquetas
            decodificadas y riesgos de uso comercial sin crear identidad de empresas.
          </p>
        </div>
        <QualityNavLinks period={report.period} />
      </header>

      <QualityPeriodScopeCard period={report.period} periods={periods} />

      <Card className="border-amber-500/30 bg-amber-50/40">
        <CardHeader>
          <CardTitle>Lectura segura</CardTitle>
          <CardDescription className="leading-6">
            Esta página es interna y no certifica calidad legal. Los valores se leen desde
            la base dev actual para el período seleccionado ({report.period.label}). Los
            correlativos importador/exportador son
            identificadores anónimos de Aduana, no RUTs, razones sociales ni identidades
            verificadas. Las métricas de importación y exportación se evalúan con campos
            distintos para no tratar CIF vacío como defecto de exportación.
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
                <DataQualityStatusBadge status={flow.status} />
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

      <SourceCoverageTable rows={report.sourceCoverage} />

      <section className="grid gap-4 xl:grid-cols-2">
        <FieldCoverageTable fields={importFields} title="Cobertura importaciones" />
        <FieldCoverageTable fields={exportFields} title="Cobertura exportaciones" />
      </section>

      <LabelCoverageTable rows={report.labelCoverage} />
      <PayloadCoverageTable rows={report.payloadCoverage} />
      <SourceBatchRemediationTable
        periodLabel={report.period.label}
        rows={report.sourceBatchRemediation}
      />
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
                <DataQualityStatusBadge status={finding.status} />
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
