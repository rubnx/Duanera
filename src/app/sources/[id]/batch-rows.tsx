import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNullableIntegerEsCl } from "@/lib/format";
import {
  sourceProcessingStatusLabel,
  sourceTradeFlow,
  sourceTradeRecordsHref,
  type ImportBatchProvenance,
  type SourceProvenanceDetail,
} from "@/sources/source-provenance";

const formatNumber = formatNullableIntegerEsCl;

function formatDateTime(value: Date | null) {
  if (!value) {
    return "No informado";
  }

  return value.toISOString();
}

export function BatchRows({
  batches,
  source,
}: {
  batches: ImportBatchProvenance[];
  source: SourceProvenanceDetail;
}) {
  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[980px]">
        <TableHeader>
          <TableRow>
            <TableHead>Lote</TableHead>
            <TableHead>Parser</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Filas declaradas</TableHead>
            <TableHead className="text-right">Filas crudas</TableHead>
            <TableHead className="text-right">Registros</TableHead>
            <TableHead>Fechas</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {batches.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="h-16 text-center text-muted-foreground">
                Esta fuente no tiene lotes de importación registrados.
              </TableCell>
            </TableRow>
          ) : (
            batches.map((batch) => {
              const batchRecordsHref = sourceTradeRecordsHref({
                sourceFileId: source.id,
                importBatchId: batch.id,
                tradeFlow: sourceTradeFlow(source.tradeFlow),
              });

              return (
                <TableRow key={batch.id} id={`batch-${batch.id}`} className="scroll-mt-4">
                  <TableCell className="max-w-[220px] align-top font-mono text-xs">
                    {batch.id}
                  </TableCell>
                  <TableCell className="align-top">
                    <div>{batch.parserName}</div>
                    <div className="mt-1 font-mono text-xs text-muted-foreground">
                      {batch.parserVersion}
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <Badge variant={batch.status === "completed" ? "secondary" : "outline"}>
                      {sourceProcessingStatusLabel(batch.status)}
                    </Badge>
                    {batch.warningSummary || batch.errorSummary ? (
                      <div className="mt-2 max-w-[240px] text-xs text-muted-foreground">
                        {batch.warningSummary ?? batch.errorSummary}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="align-top text-right font-mono text-xs">
                    {formatNumber(batch.rowsTotal)}
                  </TableCell>
                  <TableCell className="align-top text-right font-mono text-xs">
                    {formatNumber(batch.rawRowCount)}
                    <div className="mt-1 text-muted-foreground">
                      Parseadas {formatNumber(batch.parsedRawRowCount)} · Fallidas{" "}
                      {formatNumber(batch.failedRawRowCount)}
                    </div>
                  </TableCell>
                  <TableCell className="align-top text-right font-mono text-xs">
                    {formatNumber(batch.tradeRecordCount)}
                  </TableCell>
                  <TableCell className="align-top text-xs">
                    <div>Inicio {formatDateTime(batch.startedAt)}</div>
                    <div className="mt-1 text-muted-foreground">
                      Fin {formatDateTime(batch.completedAt)}
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    {batch.tradeRecordCount > 0 && batchRecordsHref ? (
                      <Link
                        href={batchRecordsHref}
                        className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                      >
                        Ver registros
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sin registros</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
