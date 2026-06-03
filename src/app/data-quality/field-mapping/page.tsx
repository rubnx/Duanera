import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MappingRowsTable } from "@/app/data-quality/field-mapping/mapping-rows-table";
import { db } from "@/db/client";
import {
  getFieldMappingReport,
  type FieldMappingGroup,
} from "@/quality/field-mapping";
import { formatIntegerEsCl } from "@/lib/format";
import { isInternalToolsEnabled } from "@/research/internal-research-access";
import { listTradeRecordPeriods } from "@/trade/trade-record-periods";
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

export default async function FieldMappingPage({ searchParams }: DataQualityPageProps) {
  if (!isInternalToolsEnabled()) {
    notFound();
  }

  const periods = await listTradeRecordPeriods(db);
  const period = await resolveQualityPeriod({ periods, searchParams });
  const report = await getFieldMappingReport(db, period);
  const groups: FieldMappingGroup[] = [
    "commercial_values",
    "quantity_weight",
    "geography_logistics",
    "hs_product",
    "anonymous_correlative",
    "provenance",
  ];

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 py-5 lg:px-6">
      <header className="flex flex-col gap-3 border-b pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <Badge variant="outline" className="w-fit">
            Diccionario QA interno
          </Badge>
          <h1 className="text-2xl font-semibold tracking-tight">
            Mapeo de campos Aduana {report.period.label}
          </h1>
          <p className="max-w-5xl text-sm leading-6 text-muted-foreground">
            Vista solo lectura para revisar cómo columnas DIN/DUS pasan a campos
            normalizados. Distingue mapeos directos, campos normalizados y señales que
            requieren revisión antes de usar resultados como evidencia comercial.
          </p>
        </div>
        <QualityNavLinks period={report.period} />
      </header>

      <QualityPeriodScopeCard
        period={report.period}
        periods={periods}
        resetHref="/data-quality/field-mapping"
      />

      <Card className="border-amber-500/30 bg-amber-50/40">
        <CardHeader>
          <CardTitle>Lectura segura</CardTitle>
          <CardDescription className="leading-6">
            Esta página no cambia datos ni certifica la interpretación legal de campos.
            La cobertura se calcula para {report.period.label}; las definiciones de
            layout siguen basadas en los DIN/DUS main conocidos. Los correlativos
            importador/exportador siguen siendo identificadores anónimos de Aduana, no
            empresas verificadas.
          </CardDescription>
        </CardHeader>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Período" value={report.period.label} />
        <Metric label="Mapeos revisados" value={formatNumber(report.summary.totalMappings)} />
        <Metric
          label="Mapeos directos"
          value={formatNumber(report.summary.verifiedMappings)}
        />
        <Metric
          label="Normalizados"
          value={formatNumber(report.summary.inferredMappings)}
        />
        <Metric
          help="Campos marcados explícitamente como pendientes de revisión de mapeo."
          label="Requieren revisión"
          value={formatNumber(report.summary.reviewMappings)}
        />
      </section>

      {groups.map((group) => {
        const rows = report.rows.filter((row) => row.group === group);
        return rows.length > 0 ? (
          <MappingRowsTable key={group} group={group} rows={rows} />
        ) : null;
      })}
    </main>
  );
}
