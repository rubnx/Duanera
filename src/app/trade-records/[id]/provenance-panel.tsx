import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  sourceFilenameLabel,
  sourceTradeRecordsHref,
} from "@/sources/source-provenance";
import {
  formatBoolean,
  formatPayloadRetainedReason,
  formatPayloadRetentionMode,
  formatPayloadStorageKind,
} from "@/trade/trade-record-provenance";
import type { TradeRecordDetail } from "@/trade/trade-records";
import type { TradeRecordWithLabels } from "@/trade/trade-record-labels";

type DetailRecord = TradeRecordWithLabels<TradeRecordDetail>;

function recordTradeFlow(value: string) {
  return value === "import" || value === "export" ? value : undefined;
}

function formatPrunedAt(value: Date | string | null) {
  if (!value) {
    return "No informado";
  }

  return value instanceof Date ? value.toISOString() : value;
}

function Field({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | number | null | undefined;
  mono?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className={mono ? "break-words font-mono text-xs" : "break-words text-sm"}>
        {value ?? "No informado"}
      </dd>
    </div>
  );
}

export function ProvenancePanel({ record }: { record: DetailRecord }) {
  const sourceFilename = sourceFilenameLabel(record.sourceFilename) ?? "No informado";
  const sourceHref = `/sources/${record.sourceFileId}`;
  const batchHref = `${sourceHref}#batch-${record.importBatchId}`;
  const sourceRecordsHref = sourceTradeRecordsHref({
    sourceFileId: record.sourceFileId,
    tradeFlow: recordTradeFlow(record.tradeFlow),
  });
  const batchRecordsHref = sourceTradeRecordsHref({
    sourceFileId: record.sourceFileId,
    importBatchId: record.importBatchId,
    tradeFlow: recordTradeFlow(record.tradeFlow),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Proveniencia</CardTitle>
        <CardDescription>
          Trazabilidad a fuente, lote y fila cruda. No se muestran rutas locales,
          claves privadas de R2, URLs privadas de bucket ni credenciales.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/20 p-3">
          <div>
            <div className="text-xs font-medium text-muted-foreground">
              Archivo fuente
            </div>
            <Link
              href={sourceHref}
              className="mt-1 block break-words text-sm font-medium underline-offset-4 hover:underline"
            >
              {sourceFilename}
            </Link>
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            <Link
              href={sourceHref}
              className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Ver fuente
            </Link>
            <Link
              href={batchHref}
              className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Ver lote
            </Link>
            {sourceRecordsHref ? (
              <Link
                href={sourceRecordsHref}
                className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Registros de la fuente
              </Link>
            ) : null}
            {batchRecordsHref ? (
              <Link
                href={batchRecordsHref}
                className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Registros del lote
              </Link>
            ) : null}
          </div>
        </div>

        <dl className="grid gap-4">
          <Field label="ID fuente" value={record.sourceFileId} mono />
          <Field label="Lote de importación" value={record.importBatchId} mono />
          <Field label="Estado lote" value={record.importBatchStatus} />
          <Field
            label="Parser"
            value={`${record.parserName} ${record.parserVersion}`}
            mono
          />
          <Field label="Fila cruda" value={record.rawRowNumber} mono />
          <Field label="ID fila cruda" value={record.rawTradeRowId} mono />
          <Field
            label="Retención de payload"
            value={formatPayloadRetentionMode(record.payloadRetentionMode)}
          />
          <Field
            label="Ubicación de payload"
            value={formatPayloadStorageKind(record.payloadStorageKind)}
          />
          <Field
            label="Estado de payload"
            value={formatPayloadRetainedReason(record.payloadRetainedReason)}
          />
          <Field
            label="Payload reconstruible"
            value={formatBoolean(record.payloadReconstructable)}
          />
          <Field label="Hash payload" value={record.payloadHashSha256} mono />
          <Field label="Payload podado" value={formatPrunedAt(record.payloadPrunedAt)} />
        </dl>
      </CardContent>
    </Card>
  );
}
