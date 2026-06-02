import Link from "next/link";

import { DataQualityStatusBadge } from "@/components/data-quality-status-badge";
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
import { formatIntegerEsCl, formatPercentEsCl } from "@/lib/format";
import {
  fieldMappingConfidenceLabel,
  fieldMappingGroupLabel,
  type FieldMappingConfidence,
  type FieldMappingGroup,
  type FieldMappingRow,
} from "@/quality/field-mapping";
import type { TradeFlow } from "@/trade/trade-records";

const formatNumber = formatIntegerEsCl;
const formatPercent = formatPercentEsCl;

function flowLabel(value: TradeFlow) {
  return value === "import" ? "Importaciones" : "Exportaciones";
}

function confidenceClasses(value: FieldMappingConfidence) {
  const classes: Record<FieldMappingConfidence, string> = {
    verified: "border-emerald-600/30 bg-emerald-50 text-emerald-900",
    inferred: "border-blue-600/30 bg-blue-50 text-blue-900",
    needs_review: "border-amber-600/30 bg-amber-50 text-amber-900",
  };

  return classes[value];
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

export function MappingRowsTable({
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
                    <DataQualityStatusBadge status={row.status} />
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
