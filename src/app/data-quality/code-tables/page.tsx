import Link from "next/link";
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
  getMarch2026CodeTableRemediationReport,
  type CodeTableRemediationPriority,
} from "@/quality/code-table-remediation";
import { isInternalToolsEnabled } from "@/research/internal-research-access";
import { RemediationRowsTable } from "./remediation-rows-table";

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

export default async function CodeTablesPage() {
  if (!isInternalToolsEnabled()) {
    notFound();
  }

  const report = await getMarch2026CodeTableRemediationReport(db);
  const priorities: CodeTableRemediationPriority[] = ["high", "medium", "low"];

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 py-5 lg:px-6">
      <header className="flex flex-col gap-3 border-b pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <Badge variant="outline" className="w-fit">
            Diccionario QA interno
          </Badge>
          <h1 className="text-2xl font-semibold tracking-tight">
            Tablas de códigos Aduana Marzo 2026
          </h1>
          <p className="max-w-5xl text-sm leading-6 text-muted-foreground">
            Vista solo lectura para priorizar brechas entre códigos fuente DIN/DUS,
            campos normalizados y etiquetas oficiales cargadas. Sirve como cola interna
            de remediación; no cambia diccionarios ni certifica identidad de empresas.
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
            href="/data-quality/remediation"
            className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Remediación
          </Link>
          <Link
            href="/data-quality/field-mapping"
            className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Mapeo de campos
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
            Esta página diagnostica etiquetas oficiales faltantes o cobertura incierta.
            Los enlaces usan rutas internas seguras y no exponen rutas locales, claves R2,
            credenciales ni identidad legal. Los correlativos importador/exportador siguen
            siendo identificadores anónimos de Aduana.
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
