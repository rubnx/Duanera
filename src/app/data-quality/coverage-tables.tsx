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
import {
  type DataQualityFieldCoverage,
  type DataQualityLabelCoverage,
  type DataQualityPayloadCoverage,
  type DataQualitySourceBatchRemediation,
  type DataQualitySourceCoverage,
} from "@/quality/data-quality";
import { formatIntegerEsCl, formatPercentEsCl } from "@/lib/format";
import type { TradeFlow } from "@/trade/trade-records";

const formatNumber = formatIntegerEsCl;
const formatPercent = formatPercentEsCl;

function flowLabel(value: TradeFlow | "unknown") {
  if (value === "import") {
    return "Importaciones";
  }

  if (value === "export") {
    return "Exportaciones";
  }

  return "Sin flujo";
}

export function FieldCoverageTable({
  fields,
  title,
}: {
  fields: DataQualityFieldCoverage[];
  title: string;
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          Cobertura de campos comerciales normalizados. Un campo completo no implica que
          el dato sea identidad legal o que sea comparable sin revisar unidad/flujo.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead>Campo</TableHead>
                <TableHead className="text-right">Cobertura</TableHead>
                <TableHead className="text-right">Registros</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Uso seguro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field) => (
                <TableRow key={`${field.tradeFlow}:${field.key}`}>
                  <TableCell className="align-top font-medium">{field.label}</TableCell>
                  <TableCell className="align-top text-right font-mono text-xs">
                    {formatPercent(field.percent)}%
                  </TableCell>
                  <TableCell className="align-top text-right font-mono text-xs">
                    {formatNumber(field.covered)} / {formatNumber(field.total)}
                  </TableCell>
                  <TableCell className="align-top">
                    <DataQualityStatusBadge status={field.status} />
                  </TableCell>
                  <TableCell className="max-w-[360px] align-top text-sm text-muted-foreground">
                    {field.caveat}
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

export function LabelCoverageTable({ rows }: { rows: DataQualityLabelCoverage[] }) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Etiquetas decodificadas</CardTitle>
        <CardDescription>
          Revisa si los códigos principales de Aduana tienen etiqueta disponible en las
          tablas cargadas. La UI debe conservar el código fuente aunque la etiqueta falte.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[960px]">
            <TableHeader>
              <TableRow>
                <TableHead>Flujo</TableHead>
                <TableHead>Dimensión</TableHead>
                <TableHead className="text-right">Códigos</TableHead>
                <TableHead className="text-right">Registros decodificados</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Códigos sin match</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={`${row.tradeFlow}:${row.key}:${row.label}`}>
                  <TableCell className="align-top">{flowLabel(row.tradeFlow)}</TableCell>
                  <TableCell className="align-top">
                    <div className="font-medium">{row.label}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{row.caveat}</div>
                  </TableCell>
                  <TableCell className="align-top text-right font-mono text-xs">
                    {formatNumber(row.decodedCodes)} / {formatNumber(row.distinctCodes)}
                  </TableCell>
                  <TableCell className="align-top text-right font-mono text-xs">
                    {formatPercent(row.percent)}%
                    <div className="mt-1 text-muted-foreground">
                      {formatNumber(row.recordsWithDecodedCode)} /{" "}
                      {formatNumber(row.recordsWithCode)}
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <DataQualityStatusBadge status={row.status} />
                  </TableCell>
                  <TableCell className="max-w-[280px] align-top font-mono text-xs">
                    {row.undecodedCodes.length > 0
                      ? row.undecodedCodes.join(", ")
                      : "Sin faltantes"}
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

export function PayloadCoverageTable({ rows }: { rows: DataQualityPayloadCoverage[] }) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Payload crudo</CardTitle>
        <CardDescription>
          Estado de retención para auditoría y reproducibilidad. Esta vista no expone
          rutas locales ni claves privadas de almacenamiento.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[680px]">
            <TableHeader>
              <TableRow>
                <TableHead>Flujo</TableHead>
                <TableHead>Retención</TableHead>
                <TableHead>Almacenamiento</TableHead>
                <TableHead>Reconstruible</TableHead>
                <TableHead className="text-right">Filas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={`${row.tradeFlow}:${row.retentionMode}:${row.storageKind}:${row.reconstructable}`}
                >
                  <TableCell>{flowLabel(row.tradeFlow)}</TableCell>
                  <TableCell className="font-mono text-xs">{row.retentionMode}</TableCell>
                  <TableCell className="font-mono text-xs">{row.storageKind}</TableCell>
                  <TableCell>{row.reconstructable ? "Sí" : "No"}</TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {formatNumber(row.rows)}
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

function sourceRowStatus(row: DataQualitySourceCoverage) {
  if (row.failedRows > 0 || row.rawRows !== row.tradeRecords) {
    return "warning";
  }

  if (row.batchStatus !== "completed") {
    return "review";
  }

  return "ok";
}

export function SourceCoverageTable({ rows }: { rows: DataQualitySourceCoverage[] }) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Fuentes y lotes</CardTitle>
        <CardDescription>
          Cada fila enlaza a la fuente/lote y a los registros filtrados por esos IDs.
          Los nombres mostrados son nombres de archivo saneados, no rutas locales.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[1040px]">
            <TableHeader>
              <TableRow>
                <TableHead>Fuente</TableHead>
                <TableHead>Flujo</TableHead>
                <TableHead className="text-right">Crudas</TableHead>
                <TableHead className="text-right">Parseadas</TableHead>
                <TableHead className="text-right">Registros</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={`${row.sourceFileId}:${row.importBatchId}:${row.tradeFlow}`}>
                  <TableCell className="max-w-[340px] align-top">
                    <Link
                      href={row.sourceHref}
                      className="block break-words font-medium underline-offset-4 hover:underline"
                    >
                      {row.filename}
                    </Link>
                    <div className="mt-1 font-mono text-xs text-muted-foreground">
                      Lote {row.importBatchId.slice(0, 8)}
                    </div>
                  </TableCell>
                  <TableCell className="align-top">{flowLabel(row.tradeFlow)}</TableCell>
                  <TableCell className="align-top text-right font-mono text-xs">
                    {formatNumber(row.rawRows)}
                  </TableCell>
                  <TableCell className="align-top text-right font-mono text-xs">
                    {formatNumber(row.parsedRows)}
                  </TableCell>
                  <TableCell className="align-top text-right font-mono text-xs">
                    {formatNumber(row.tradeRecords)}
                  </TableCell>
                  <TableCell className="align-top">
                    <DataQualityStatusBadge status={sourceRowStatus(row)} />
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="flex flex-col gap-1 text-xs">
                      <Link
                        href={row.sourceHref}
                        className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                      >
                        Ver fuente/lote
                      </Link>
                      {row.tradeRecordsHref ? (
                        <Link
                          href={row.tradeRecordsHref}
                          className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                        >
                          Ver registros
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

function issueCountSummary(row: DataQualitySourceBatchRemediation) {
  const counts = row.issueCounts;
  const parts = [
    counts.missingImportGrossWeightItem > 0
      ? `Peso item ${formatNumber(counts.missingImportGrossWeightItem)}`
      : null,
    counts.undecodedCustomsOffice > 0
      ? `Aduanas ${formatNumber(counts.undecodedCustomsOffice)}`
      : null,
    counts.undecodedPort > 0 ? `Puertos ${formatNumber(counts.undecodedPort)}` : null,
    counts.undecodedTransportMode > 0
      ? `Vías ${formatNumber(counts.undecodedTransportMode)}`
      : null,
    counts.missingOrZeroItemValue > 0
      ? `Valor item ${formatNumber(counts.missingOrZeroItemValue)}`
      : null,
    counts.missingOrZeroDeclarationFob > 0
      ? `FOB declaración ${formatNumber(counts.missingOrZeroDeclarationFob)}`
      : null,
    counts.quantityUnitValueReview > 0
      ? `Cantidad/unidad ${formatNumber(counts.quantityUnitValueReview)}`
      : null,
  ].filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join(" · ") : "Sin señales priorizadas";
}

export function SourceBatchRemediationTable({
  rows,
}: {
  rows: DataQualitySourceBatchRemediation[];
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Fuentes y lotes para remediación QA</CardTitle>
        <CardDescription>
          Ranking interno de fuentes/lotes con señales QA de marzo 2026. Es guía de
          revisión técnica, no certificación legal ni evidencia de identidad de empresas.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[1120px]">
            <TableHeader>
              <TableRow>
                <TableHead>Fuente / lote</TableHead>
                <TableHead>Flujo / parser</TableHead>
                <TableHead className="text-right">Señales QA</TableHead>
                <TableHead>Detalle de señales</TableHead>
                <TableHead>Próximo paso</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-16 text-center text-muted-foreground">
                    No hay fuentes/lotes con señales QA priorizadas para marzo 2026.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={`${row.sourceFileId}:${row.importBatchId}:${row.tradeFlow}`}>
                    <TableCell className="max-w-[300px] align-top">
                      <Link
                        href={row.sourceHref}
                        className="block break-words font-medium underline-offset-4 hover:underline"
                      >
                        {row.filename}
                      </Link>
                      <div className="mt-1 font-mono text-xs text-muted-foreground">
                        Lote {row.importBatchId.slice(0, 8)}
                      </div>
                    </TableCell>
                    <TableCell className="align-top text-sm">
                      <div>{flowLabel(row.tradeFlow)}</div>
                      <div className="mt-1 font-mono text-xs text-muted-foreground">
                        {row.parserName} · {row.parserVersion}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Estado lote {row.batchStatus}
                      </div>
                    </TableCell>
                    <TableCell className="align-top text-right">
                      <div className="font-mono text-xs">
                        {formatNumber(row.totalIssueSignals)}
                      </div>
                      <div className="mt-1">
                        <DataQualityStatusBadge status={row.status} />
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[300px] align-top text-sm text-muted-foreground">
                      {issueCountSummary(row)}
                      <div className="mt-1 font-mono text-xs">
                        Registros lote {formatNumber(row.tradeRecords)}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[320px] align-top text-sm text-muted-foreground">
                      {row.nextStep}
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex flex-col gap-1 text-xs">
                        <Link
                          href={row.sourceHref}
                          className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                        >
                          Ver fuente/lote
                        </Link>
                        {row.tradeRecordsHref ? (
                          <Link
                            href={row.tradeRecordsHref}
                            className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                          >
                            Ver registros filtrados
                          </Link>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
