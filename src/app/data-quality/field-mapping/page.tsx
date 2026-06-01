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
  fieldMappingConfidenceLabel,
  fieldMappingGroupLabel,
  getMarch2026FieldMappingReport,
  type FieldMappingConfidence,
  type FieldMappingGroup,
  type FieldMappingRow,
} from "@/quality/field-mapping";
import type { DataQualityStatus } from "@/quality/data-quality";
import { isInternalToolsEnabled } from "@/research/internal-research-access";
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

function flowLabel(value: TradeFlow) {
  return value === "import" ? "Importaciones" : "Exportaciones";
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

function confidenceClasses(value: FieldMappingConfidence) {
  const classes: Record<FieldMappingConfidence, string> = {
    verified: "border-emerald-600/30 bg-emerald-50 text-emerald-900",
    inferred: "border-blue-600/30 bg-blue-50 text-blue-900",
    needs_review: "border-amber-600/30 bg-amber-50 text-amber-900",
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

function ConfidenceBadge({ confidence }: { confidence: FieldMappingConfidence }) {
  return (
    <span
      className={`inline-flex w-fit items-center rounded-md border px-2 py-0.5 text-xs font-medium ${confidenceClasses(confidence)}`}
    >
      {fieldMappingConfidenceLabel(confidence)}
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

function RawFieldList({ row }: { row: FieldMappingRow }) {
  if (row.rawFields.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        Sin campo fuente mapeado en el normalizador actual.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {row.rawFields.map((field) => (
        <div key={field.name} className="font-mono text-xs">
          {field.ordinal ? `#${field.ordinal} ` : ""}
          {field.name}
          {field.isCoded ? (
            <span className="ml-2 text-muted-foreground">código</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function MappingRowsTable({
  group,
  rows,
}: {
  group: FieldMappingGroup;
  rows: FieldMappingRow[];
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>{fieldMappingGroupLabel(group)}</CardTitle>
        <CardDescription>
          Campos normalizados frente a columnas fuente Aduana. Cobertura cruda mide si la
          columna fuente trae valor en una muestra acotada; cobertura normalizada mide si
          el campo de trade_records quedó poblado en marzo 2026 completo.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[1280px]">
            <TableHeader>
              <TableRow>
                <TableHead>Campo normalizado</TableHead>
                <TableHead>Columnas fuente</TableHead>
                <TableHead className="text-right">Cobertura raw</TableHead>
                <TableHead className="text-right">Cobertura normalizada</TableHead>
                <TableHead>Muestras fuente</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Notas / enlaces</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="max-w-[260px] align-top">
                    <div className="font-medium">{row.label}</div>
                    <div className="mt-1 font-mono text-xs text-muted-foreground">
                      {row.normalizedField}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="outline">{flowLabel(row.tradeFlow)}</Badge>
                      <ConfidenceBadge confidence={row.confidence} />
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[260px] align-top">
                    <RawFieldList row={row} />
                  </TableCell>
                  <TableCell className="align-top text-right font-mono text-xs">
                    {formatPercent(row.rawCoveragePercent)}%
                    <div className="mt-1 text-muted-foreground">
                      {formatNumber(row.rawPresentRows)} /{" "}
                      {formatNumber(row.rawSampleRows)}
                    </div>
                  </TableCell>
                  <TableCell className="align-top text-right font-mono text-xs">
                    {formatPercent(row.normalizedCoveragePercent)}%
                    <div className="mt-1 text-muted-foreground">
                      {formatNumber(row.normalizedPresentRows)} /{" "}
                      {formatNumber(row.totalRows)}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[320px] align-top text-xs">
                    {row.sampleValues.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {row.sampleValues.map((value) => (
                          <span key={value} className="break-words font-mono">
                            {value}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Sin muestra no vacía</span>
                    )}
                  </TableCell>
                  <TableCell className="align-top">
                    <StatusBadge status={row.status} />
                  </TableCell>
                  <TableCell className="max-w-[360px] align-top text-sm text-muted-foreground">
                    <p className="leading-6">{row.note}</p>
                    {row.sourceLabel ? (
                      <div className="mt-2 break-words font-mono text-xs">
                        Fuente muestra: {row.sourceLabel}
                      </div>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-3 text-xs">
                      <Link
                        href={row.tradeRecordsHref}
                        className="font-medium underline-offset-4 hover:text-foreground hover:underline"
                      >
                        Ver registros del flujo
                      </Link>
                      {row.sourceHref ? (
                        <Link
                          href={row.sourceHref}
                          className="font-medium underline-offset-4 hover:text-foreground hover:underline"
                        >
                          Ver fuente/lote
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
  );
}

export default async function FieldMappingPage() {
  if (!isInternalToolsEnabled()) {
    notFound();
  }

  const report = await getMarch2026FieldMappingReport(db);
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
            Mapeo de campos Aduana Marzo 2026
          </h1>
          <p className="max-w-5xl text-sm leading-6 text-muted-foreground">
            Vista solo lectura para revisar cómo columnas DIN/DUS pasan a campos
            normalizados. Distingue mapeos directos, campos normalizados y señales que
            requieren revisión antes de usar resultados como evidencia comercial.
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
            Esta página no cambia datos ni certifica la interpretación legal de campos.
            Las muestras son valores fuente truncados por disponibilidad local. Los
            correlativos importador/exportador siguen siendo identificadores anónimos de
            Aduana, no empresas verificadas.
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
