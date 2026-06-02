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
import { getMarch2026LoadReadinessReport } from "@/quality/load-readiness";
import { isInternalToolsEnabled } from "@/research/internal-research-access";
import {
  LoadReadinessAreaCards,
  LoadReadinessAreaTable,
  LoadReadinessDecisionCard,
  LoadReadinessSummaryMetrics,
} from "./load-readiness-sections";

export const dynamic = "force-dynamic";

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

      <LoadReadinessDecisionCard decision={report.decision} />

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

      <LoadReadinessSummaryMetrics
        periodLabel={report.period.label}
        summary={report.summary}
      />

      <div className="hidden min-w-0 lg:block">
        <LoadReadinessAreaTable areas={report.areas} />
      </div>
      <LoadReadinessAreaCards areas={report.areas} />
    </main>
  );
}
