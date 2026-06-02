import Link from "next/link";

import { DataQualityStatusBadge } from "@/components/data-quality-status-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatNullableIntegerEsCl } from "@/lib/format";
import type { DataQualitySourceBatchRemediation } from "@/quality/data-quality";
import { sourceTradeFlowLabel } from "@/sources/source-provenance";

const formatNumber = formatNullableIntegerEsCl;

function QaMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-muted/20 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-sm font-medium">{value}</div>
    </div>
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

export function SourceQaContext({
  rows,
}: {
  rows: DataQualitySourceBatchRemediation[];
}) {
  const totalSignals = rows.reduce((total, row) => total + row.totalIssueSignals, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contexto QA marzo 2026</CardTitle>
        <CardDescription>
          Guía interna para priorizar revisión técnica por lote. No certifica calidad
          legal ni identifica empresas.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
          <QaMetric label="Lotes con señales" value={formatNumber(rows.length)} />
          <QaMetric label="Señales QA" value={formatNumber(totalSignals)} />
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Esta fuente no tiene señales QA priorizadas para marzo 2026 en la base dev
            actual.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {rows.map((row) => (
              <article
                key={`${row.sourceFileId}:${row.importBatchId}:${row.tradeFlow}`}
                className="rounded-lg border border-border bg-background p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <DataQualityStatusBadge status={row.status} />
                  <span className="font-mono text-xs text-muted-foreground">
                    {formatNumber(row.totalIssueSignals)} señales
                  </span>
                </div>
                <div className="mt-2 font-mono text-xs">
                  Lote {row.importBatchId.slice(0, 8)}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {sourceTradeFlowLabel(row.tradeFlow)} · {row.parserName} {row.parserVersion}
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {issueCountSummary(row)}
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {row.nextStep}
                </p>
                <div className="mt-3 flex flex-wrap gap-3 text-xs">
                  <Link
                    href={row.sourceHref}
                    className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    Ir al lote
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
              </article>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
