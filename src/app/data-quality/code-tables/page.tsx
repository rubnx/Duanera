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
  codeTableRemediationDimensionLabel,
  codeTableRemediationPriorityLabel,
  getMarch2026CodeTableRemediationReport,
  type CodeTableRemediationPriority,
  type CodeTableRemediationRow,
} from "@/quality/code-table-remediation";
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

function priorityClasses(value: CodeTableRemediationPriority) {
  const classes: Record<CodeTableRemediationPriority, string> = {
    high: "border-red-600/30 bg-red-50 text-red-900",
    medium: "border-amber-600/30 bg-amber-50 text-amber-900",
    low: "border-slate-300 bg-slate-50 text-slate-700",
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

function PriorityBadge({ priority }: { priority: CodeTableRemediationPriority }) {
  return (
    <span
      className={`inline-flex w-fit items-center rounded-md border px-2 py-0.5 text-xs font-medium ${priorityClasses(priority)}`}
    >
      Prioridad {codeTableRemediationPriorityLabel(priority)}
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

function SourceFields({ row }: { row: CodeTableRemediationRow }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="font-mono text-xs text-muted-foreground">
        Normalizado: {row.normalizedField}
      </div>
      {row.sourceFields.map((field) => (
        <div key={`${row.id}:${field.name}`} className="text-xs">
          <div className="font-mono">
            {field.ordinal ? `#${field.ordinal} ` : ""}
            {field.name}
            {field.isCoded ? <span className="ml-2 text-muted-foreground">código</span> : null}
          </div>
          <div className="mt-1 break-words text-muted-foreground">
            Layout: {field.layoutCodeTableKey ?? "Sin tabla declarada"}
          </div>
        </div>
      ))}
    </div>
  );
}

function DictionaryContext({ row }: { row: CodeTableRemediationRow }) {
  return (
    <div className="flex flex-col gap-1 text-xs">
      <div className="break-words font-mono">Esperada: {row.codeTableKey}</div>
      <div className="text-muted-foreground">
        {row.codeTableFound ? "Tabla cargada" : "Tabla no encontrada en code_tables"}
      </div>
      {row.dictionaryProvenance ? (
        <>
          <div className="break-words text-muted-foreground">
            {row.dictionaryProvenance.tableName}
            {row.dictionaryProvenance.sourceSheetName
              ? ` · hoja ${row.dictionaryProvenance.sourceSheetName}`
              : ""}
          </div>
          {row.dictionaryProvenance.sourceHref ? (
            <Link
              href={row.dictionaryProvenance.sourceHref}
              className="font-medium underline-offset-4 hover:text-foreground hover:underline"
            >
              Ver fuente del diccionario
            </Link>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function UndecodedCodes({ row }: { row: CodeTableRemediationRow }) {
  if (row.topUndecodedCodes.length === 0) {
    return <span className="text-sm text-muted-foreground">Sin códigos faltantes</span>;
  }

  return (
    <div className="flex flex-col gap-1">
      {row.topUndecodedCodes.map((code) => (
        <Link
          key={`${row.id}:${code.normalizedCode}`}
          href={code.tradeRecordsHref}
          className="break-words font-mono text-xs underline-offset-4 hover:text-foreground hover:underline"
        >
          {code.code} · {formatNumber(code.records)} registros
        </Link>
      ))}
    </div>
  );
}

function ActionLinks({ row }: { row: CodeTableRemediationRow }) {
  return (
    <div className="flex flex-col gap-1 text-xs">
      <Link
        href={row.tradeRecordsHref}
        className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        Ver muestra de registros
      </Link>
      <Link
        href={row.fieldMappingHref}
        className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        Ver mapeo de campos
      </Link>
      {row.sourceContext ? (
        <>
          <Link
            href={row.sourceContext.sourceHref}
            className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Ver fuente/lote
          </Link>
          <Link
            href={row.sourceContext.tradeRecordsHref}
            className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Registros del lote
          </Link>
        </>
      ) : null}
    </div>
  );
}

function RemediationRowsTable({
  priority,
  rows,
}: {
  priority: CodeTableRemediationPriority;
  rows: CodeTableRemediationRow[];
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Prioridad {codeTableRemediationPriorityLabel(priority)}</CardTitle>
            <CardDescription>
              Items ordenados por impacto comercial y registros afectados, no por nombre
              de campo.
            </CardDescription>
          </div>
          <PriorityBadge priority={priority} />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[1320px]">
            <TableHeader>
              <TableRow>
                <TableHead>Dimensión / flujo</TableHead>
                <TableHead>Campos fuente</TableHead>
                <TableHead>Tabla de códigos</TableHead>
                <TableHead className="text-right">Cobertura</TableHead>
                <TableHead>Códigos sin etiqueta</TableHead>
                <TableHead>Próximo paso seguro</TableHead>
                <TableHead>Enlaces</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="max-w-[260px] align-top">
                    <div className="font-medium">{row.label}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {flowLabel(row.tradeFlow)} ·{" "}
                      {codeTableRemediationDimensionLabel(row.dimension)}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <StatusBadge status={row.status} />
                      <PriorityBadge priority={row.priority} />
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      {row.commercialUse}
                    </p>
                    {row.unsupportedReason ? (
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Límite actual: {row.unsupportedReason}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="max-w-[260px] align-top">
                    <SourceFields row={row} />
                  </TableCell>
                  <TableCell className="max-w-[300px] align-top">
                    <DictionaryContext row={row} />
                  </TableCell>
                  <TableCell className="align-top text-right font-mono text-xs">
                    {formatPercent(row.decodedPercent)}%
                    <div className="mt-1 text-muted-foreground">
                      {formatNumber(row.recordsWithDecodedCode)} /{" "}
                      {formatNumber(row.recordsWithCode)} registros
                    </div>
                    <div className="mt-2 text-muted-foreground">
                      Códigos {formatNumber(row.decodedCodes)} /{" "}
                      {formatNumber(row.distinctCodes)}
                    </div>
                    <div className="mt-1 text-muted-foreground">
                      Sin etiqueta: {formatNumber(row.undecodedCodes)}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[240px] align-top">
                    <UndecodedCodes row={row} />
                  </TableCell>
                  <TableCell className="max-w-[320px] align-top text-sm text-muted-foreground">
                    {row.nextAction}
                  </TableCell>
                  <TableCell className="max-w-[220px] align-top">
                    <ActionLinks row={row} />
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
