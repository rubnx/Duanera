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
import { formatIntegerEsCl } from "@/lib/format";
import type { DataQualitySourceBatchRemediation } from "@/quality/data-quality";
import type { TradeFlow } from "@/trade/trade-records";

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
  periodLabel,
  rows,
}: {
  periodLabel: string;
  rows: DataQualitySourceBatchRemediation[];
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Fuentes y lotes para remediación QA</CardTitle>
        <CardDescription>
          Ranking interno de fuentes/lotes con señales QA de {periodLabel}. Es guía de
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
                    No hay fuentes/lotes con señales QA priorizadas para {periodLabel}.
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
