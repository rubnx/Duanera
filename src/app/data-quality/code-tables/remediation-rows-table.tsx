import Link from "next/link";

import { DataQualityStatusBadge } from "@/components/data-quality-status-badge";
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
import { formatIntegerEsCl, formatPercentEsCl } from "@/lib/format";
import {
  codeTableRemediationDimensionLabel,
  codeTableRemediationPriorityLabel,
  type CodeTableRemediationPriority,
  type CodeTableRemediationRow,
} from "@/quality/code-table-remediation";
import type { TradeFlow } from "@/trade/trade-records";

const formatNumber = formatIntegerEsCl;
const formatPercent = formatPercentEsCl;

function flowLabel(value: TradeFlow) {
  return value === "import" ? "Importaciones" : "Exportaciones";
}

function priorityClasses(value: CodeTableRemediationPriority) {
  const classes: Record<CodeTableRemediationPriority, string> = {
    high: "border-red-600/30 bg-red-50 text-red-900",
    medium: "border-amber-600/30 bg-amber-50 text-amber-900",
    low: "border-slate-300 bg-slate-50 text-slate-700",
  };

  return classes[value];
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

function decodableRecordCount(row: CodeTableRemediationRow) {
  return row.recordsWithCode - row.recordsWithSpecialSourceCode;
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
          {row.sourceContext.tradeRecordsHref ? (
            <Link
              href={row.sourceContext.tradeRecordsHref}
              className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Registros del lote
            </Link>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export function RemediationRowsTable({
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
                      <DataQualityStatusBadge status={row.status} />
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
                      {formatNumber(decodableRecordCount(row))} registros decodificables
                    </div>
                    <div className="mt-2 text-muted-foreground">
                      Códigos {formatNumber(row.decodedCodes)} /{" "}
                      {formatNumber(row.distinctCodes)}
                    </div>
                    <div className="mt-1 text-muted-foreground">
                      Sin etiqueta: {formatNumber(row.undecodedCodes)}
                    </div>
                    {row.recordsWithSpecialSourceCode > 0 ? (
                      <div className="mt-1 text-muted-foreground">
                        Valor especial fuente:{" "}
                        {formatNumber(row.recordsWithSpecialSourceCode)}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="max-w-[240px] align-top">
                    <UndecodedCodes row={row} />
                    {row.sourceSpecialCodeNote ? (
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        {row.sourceSpecialCodeNote}
                      </p>
                    ) : null}
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
