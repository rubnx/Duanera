import { ArrowLeft } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { db } from "@/db/client";
import { enrichTradeRecordWithLabels } from "@/trade/trade-record-labels";
import { getTradeRecordById } from "@/trade/trade-records";

type PageProps = {
  params: Promise<{ id: string }>;
};

type DetailRecord = NonNullable<
  Awaited<ReturnType<typeof enrichTradeRecordWithLabels>>
>;

function formatCodeLabel(code: string | null, label?: string) {
  if (!code && !label) {
    return "-";
  }

  if (code && label) {
    return `${code} · ${label}`;
  }

  return code ?? label ?? "-";
}

function formatMoney(value: string | null, currency?: string) {
  if (!value) {
    return "-";
  }

  return currency ? `${value} ${currency}` : value;
}

function formatJson(value: unknown) {
  if (value === null || value === undefined) {
    return "-";
  }

  return JSON.stringify(value, null, 2);
}

function formatPrunedAt(value: Date | string | null) {
  if (!value) {
    return "-";
  }

  return value instanceof Date ? value.toISOString() : value;
}

function participantLabel(record: DetailRecord) {
  if (record.tradeFlow === "import") {
    return {
      label: "Correlativo importador",
      value: record.importerCorrelativeId ?? "-",
    };
  }

  return {
    label: "Correlativo exportador",
    value:
      record.exporterPrimaryCorrelativeId ??
      record.exporterSecondaryCorrelativeId ??
      "-",
  };
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
        {value ?? "-"}
      </dd>
    </div>
  );
}

export default async function TradeRecordDetailPage({ params }: PageProps) {
  const { id } = await params;
  const record = await enrichTradeRecordWithLabels(db, await getTradeRecordById(db, id));

  if (!record) {
    notFound();
  }

  const participant = participantLabel(record);
  const period = `${record.periodYear}-${String(record.periodMonth).padStart(2, "0")}`;

  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-4 py-5 lg:px-6">
      <header className="flex flex-col gap-4 border-b pb-4">
        <Link
          href="/trade-records"
          className="inline-flex w-fit items-center gap-1 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <ArrowLeft className="size-4" />
          Registros
        </Link>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              {record.tradeFlow === "import" ? "Importacion" : "Exportacion"}
            </Badge>
            <Badge variant="outline">{period}</Badge>
            <Badge variant="outline">{record.hsCodeNormalized ?? "HS sin normalizar"}</Badge>
          </div>
          <h1 className="max-w-5xl text-2xl font-semibold tracking-tight">
            {record.productDescriptionRaw ?? "Registro sin descripcion de producto"}
          </h1>
          <p className="max-w-4xl text-sm text-muted-foreground">
            Este detalle conserva la trazabilidad al archivo fuente, lote de importacion
            y fila cruda. Los correlativos son identificadores anonimos de Aduana, no
            nombres legales ni RUTs de importador/exportador.
          </p>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Producto y operacion</CardTitle>
              <CardDescription>Campos normalizados desde la fila Aduana.</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 md:grid-cols-2">
                <Field label="Declaracion" value={record.declarationIdRaw} mono />
                <Field label="Item" value={record.itemNumber} />
                <Field label="Fecha aceptacion" value={record.acceptanceDate} />
                <Field label={participant.label} value={participant.value} mono />
                <Field label="HS original" value={record.hsCodeRaw} mono />
                <Field label="HS normalizado" value={record.hsCodeNormalized} mono />
                <Field
                  label="Unidad cantidad"
                  value={formatCodeLabel(
                    record.quantityUnitCode,
                    record.decodedLabels.quantityUnit,
                  )}
                />
                <Field label="Cantidad" value={record.quantity} mono />
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Valores</CardTitle>
              <CardDescription>Montos disponibles segun el flujo y la fuente.</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 md:grid-cols-3">
                <Field
                  label="Valor CIF item"
                  value={formatMoney(record.itemCifValue, record.decodedLabels.currency)}
                  mono
                />
                <Field
                  label="Valor FOB item"
                  value={formatMoney(record.itemFobValue, record.decodedLabels.currency)}
                  mono
                />
                <Field
                  label="Valor FOB declaracion"
                  value={formatMoney(
                    record.declarationFobValue,
                    record.decodedLabels.currency,
                  )}
                  mono
                />
                <Field label="Valor CIF declaracion" value={record.cifValue} mono />
                <Field label="Flete" value={record.freightValue} mono />
                <Field label="Seguro" value={record.insuranceValue} mono />
                <Field label="Precio unitario" value={record.unitPriceValue} mono />
                <Field label="Peso bruto total" value={record.grossWeightTotal} mono />
                <Field label="Peso bruto item" value={record.grossWeightItem} mono />
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Geografia y logistica</CardTitle>
              <CardDescription>Codigos decodificados cuando existe tabla oficial.</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 md:grid-cols-2">
                <Field
                  label="Pais origen"
                  value={formatCodeLabel(
                    record.originCountryCode,
                    record.decodedLabels.originCountry,
                  )}
                />
                <Field
                  label="Pais adquisicion"
                  value={formatCodeLabel(
                    record.acquisitionCountryCode,
                    record.decodedLabels.acquisitionCountry,
                  )}
                />
                <Field
                  label="Pais consignacion"
                  value={formatCodeLabel(
                    record.consignmentCountryCode,
                    record.decodedLabels.consignmentCountry,
                  )}
                />
                <Field
                  label="Pais destino"
                  value={formatCodeLabel(
                    record.destinationCountryCode,
                    record.decodedLabels.destinationCountry,
                  )}
                />
                <Field
                  label="Aduana"
                  value={formatCodeLabel(
                    record.customsOfficeCode,
                    record.decodedLabels.customsOffice,
                  )}
                />
                <Field
                  label="Via transporte"
                  value={formatCodeLabel(
                    record.transportModeCode,
                    record.decodedLabels.transportMode,
                  )}
                />
                <Field
                  label="Puerto embarque"
                  value={formatCodeLabel(record.embarkPortCode, record.decodedLabels.embarkPort)}
                />
                <Field
                  label="Puerto desembarque"
                  value={formatCodeLabel(
                    record.disembarkPortCode,
                    record.decodedLabels.disembarkPort,
                  )}
                />
                <Field
                  label="Tipo carga"
                  value={formatCodeLabel(record.cargoTypeCode, record.decodedLabels.cargoType)}
                />
              </dl>
            </CardContent>
          </Card>
        </div>

        <aside className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Proveniencia</CardTitle>
              <CardDescription>Trazabilidad minima para auditar el registro.</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4">
                <Field label="Archivo fuente" value={record.sourceFilename} />
                <Field label="Fila cruda" value={record.rawRowNumber} />
                <Field label="Raw row ID" value={record.rawTradeRowId} mono />
                <Field label="Lote" value={record.importBatchId} mono />
                <Field label="Estado lote" value={record.importBatchStatus} />
                <Field label="Parser" value={`${record.parserName} ${record.parserVersion}`} />
                <Field label="Retencion payload" value={record.payloadRetentionMode} />
                <Field label="Estado payload" value={record.payloadRetainedReason} />
                <Field label="Payload hash" value={record.payloadHashSha256} mono />
                <Field label="Payload podado" value={formatPrunedAt(record.payloadPrunedAt)} />
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Atributos producto</CardTitle>
              <CardDescription>Campos auxiliares confirmados cuando estan presentes.</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="max-h-[320px] overflow-auto rounded-lg bg-muted p-3 text-xs leading-relaxed">
                {formatJson(record.productAttributes)}
              </pre>
            </CardContent>
          </Card>
        </aside>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Fila cruda</CardTitle>
          <CardDescription>
            Vista de auditoria. Puede incluir partes operativas del documento, pero no se
            interpreta como identidad legal de importador/exportador.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div>
            <div className="mb-2 text-xs font-medium text-muted-foreground">Texto original</div>
            <pre className="max-h-[280px] overflow-auto rounded-lg bg-muted p-3 text-xs leading-relaxed">
              {record.rawText ??
                "Payload crudo podado. La trazabilidad se conserva por archivo fuente, fila, hash y metadatos."}
            </pre>
          </div>
          <Separator />
          <div>
            <div className="mb-2 text-xs font-medium text-muted-foreground">Valores parseados</div>
            <pre className="max-h-[420px] overflow-auto rounded-lg bg-muted p-3 text-xs leading-relaxed">
              {formatJson(record.rawValues)}
            </pre>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
