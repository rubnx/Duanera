import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db } from "@/db/client";
import { formatIntegerEsCl } from "@/lib/format";
import {
  getCodeTableRemediationReport,
  type CodeTableRemediationPriority,
} from "@/quality/code-table-remediation";
import { isInternalToolsEnabled } from "@/research/internal-research-access";
import { listTradeRecordPeriods } from "@/trade/trade-record-periods";
import { RemediationRowsTable } from "./remediation-rows-table";
import {
  QualityNavLinks,
  QualityPeriodScopeCard,
  resolveQualityPeriod,
  type DataQualityPageProps,
} from "../quality-period-scope";

export const dynamic = "force-dynamic";

const formatNumber = formatIntegerEsCl;

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

export default async function CodeTablesPage({ searchParams }: DataQualityPageProps) {
  if (!isInternalToolsEnabled()) {
    notFound();
  }

  const periods = await listTradeRecordPeriods(db);
  const period = await resolveQualityPeriod({ periods, searchParams });
  const report = await getCodeTableRemediationReport(db, period);
  const priorities: CodeTableRemediationPriority[] = ["high", "medium", "low"];

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 py-5 lg:px-6">
      <header className="flex flex-col gap-3 border-b pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <Badge variant="outline" className="w-fit">
            Diccionario QA interno
          </Badge>
          <h1 className="text-2xl font-semibold tracking-tight">
            Tablas de códigos Aduana {report.period.label}
          </h1>
          <p className="max-w-5xl text-sm leading-6 text-muted-foreground">
            Vista solo lectura para priorizar brechas entre códigos fuente DIN/DUS,
            campos normalizados y etiquetas oficiales cargadas. Sirve como cola interna
            de remediación; no cambia diccionarios ni certifica identidad de empresas.
          </p>
        </div>
        <QualityNavLinks period={report.period} />
      </header>

      <QualityPeriodScopeCard
        period={report.period}
        periods={periods}
        resetHref="/data-quality/code-tables"
      />

      <Card className="border-amber-500/30 bg-amber-50/40">
        <CardHeader>
          <CardTitle>Lectura segura</CardTitle>
          <CardDescription className="leading-6">
            Esta página diagnostica etiquetas oficiales faltantes o cobertura incierta.
            Los conteos se calculan para {report.period.label}; los enlaces usan rutas
            internas seguras y no exponen rutas locales, claves R2, credenciales ni
            identidad legal. Los correlativos importador/exportador siguen siendo
            identificadores anónimos de Aduana.
          </CardDescription>
        </CardHeader>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Período" value={report.period.label} />
        <Metric label="Dimensiones revisadas" value={formatNumber(report.summary.totalDimensions)} />
        <Metric
          help="Afectan filtros, rankings o resumen comercial visible."
          label="Brechas prioridad alta"
          value={formatNumber(report.summary.highPriorityGaps)}
        />
        <Metric
          help="Afectan comparabilidad de cantidades, unidades o moneda."
          label="Brechas prioridad media"
          value={formatNumber(report.summary.mediumPriorityGaps)}
        />
        <Metric
          help="Suma por dimensión; un registro puede aparecer en más de una brecha."
          label="Registros con códigos sin etiqueta"
          value={formatNumber(report.summary.recordsWithUndecodedCodes)}
        />
      </section>

      {priorities.map((priority) => {
        const rows = report.rows.filter((row) => row.priority === priority);
        return rows.length > 0 ? (
          <RemediationRowsTable key={priority} priority={priority} rows={rows} />
        ) : null;
      })}
    </main>
  );
}
