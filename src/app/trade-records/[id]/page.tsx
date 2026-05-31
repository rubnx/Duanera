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
import {
  isNonZeroDecimal,
  productAttributeEntries,
  productDisplayFromRaw,
} from "@/trade/trade-record-display";
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
    return "No informado";
  }

  if (code && label) {
    return `${code} · ${label}`;
  }

  return code ?? label ?? "No informado";
}

function formatMoney(value: string | null, currency?: string) {
  if (!value) {
    return "No informado";
  }

  return currency ? `${value} ${currency}` : value;
}

function formatQuantity(value: string | null, unit?: string) {
  if (!value) {
    return "No informado";
  }

  return unit ? `${value} ${unit}` : value;
}

function formatJson(value: unknown) {
  if (value === null || value === undefined) {
    return "No informado";
  }

  return JSON.stringify(value, null, 2);
}

function formatPrunedAt(value: Date | string | null) {
  if (!value) {
    return "No informado";
  }

  return value instanceof Date ? value.toISOString() : value;
}

function formatPayloadRetentionMode(value: string) {
  const labels: Record<string, string> = {
    full_postgres: "Completo en Postgres",
    errors_and_warnings: "Solo errores y advertencias",
    pruned_after_normalization: "Podado después de normalizar",
  };

  return labels[value] ?? value;
}

function formatPayloadRetainedReason(value: string | null) {
  if (!value) {
    return "No informado";
  }

  const labels: Record<string, string> = {
    existing_full_postgres_payload: "Payload completo retenido de carga existente",
    parse_error: "Retenido por error de parseo",
    parse_warning: "Retenido por advertencia de parseo",
    pending_post_normalization_prune: "Pendiente de poda posterior a normalización",
    pruned_after_normalization: "Podado después de normalizar",
  };

  return labels[value] ?? value;
}

function participantLabel(record: DetailRecord) {
  if (record.tradeFlow === "import") {
    return {
      label: "Correlativo importador Aduana",
      value: record.importerCorrelativeId ?? "No informado",
    };
  }

  return {
    label: "Correlativo exportador Aduana",
    value:
      record.exporterPrimaryCorrelativeId ??
      record.exporterSecondaryCorrelativeId ??
      "No informado",
  };
}

function valueSectionCopy(record: DetailRecord) {
  if (record.tradeFlow === "import") {
    return {
      title: "Valores de importación",
      description:
        "Montos y medidas útiles para revisar costo CIF, base FOB, flete, seguro y unidad declarada.",
    };
  }

  return {
    title: "Valores de exportación",
    description:
      "Campos FOB y contexto logístico de exportación. No se muestran campos CIF en cero que no aportan lectura comercial.",
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
        {value ?? "No informado"}
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
  const valuesCopy = valueSectionCopy(record);
  const product = productDisplayFromRaw(record.productDescriptionRaw);
  const productAttributes = productAttributeEntries(record.productAttributes);
  const exportAdditionalValues = [
    { label: "Flete declaración", value: record.freightValue },
    { label: "Seguro declaración", value: record.insuranceValue },
    { label: "CIF declaración", value: record.cifValue },
  ].filter((field) => isNonZeroDecimal(field.value));

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
              {record.tradeFlow === "import" ? "Importación" : "Exportación"}
            </Badge>
            <Badge variant="outline">{period}</Badge>
            <Badge variant="outline">{record.hsCodeNormalized ?? "HS sin normalizar"}</Badge>
          </div>
          <h1 className="max-w-5xl text-2xl font-semibold tracking-tight">
            {product.title}
          </h1>
          {product.details.length > 0 || product.sourceReference ? (
            <div className="flex max-w-4xl flex-col gap-1 text-sm text-muted-foreground">
              {product.sourceReference ? (
                <div>
                  Referencia fuente:{" "}
                  <span className="font-mono text-xs">{product.sourceReference}</span>
                </div>
              ) : null}
              {product.details.length > 0 ? <div>{product.details.join(" · ")}</div> : null}
            </div>
          ) : null}
          <p className="max-w-4xl text-sm text-muted-foreground">
            Este detalle conserva la trazabilidad al archivo fuente, lote de importación
            y fila cruda. Los correlativos son identificadores anónimos de Aduana, no
            nombres legales ni RUTs de importador/exportador.
          </p>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Producto y operación</CardTitle>
              <CardDescription>Campos normalizados desde la fila Aduana.</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 md:grid-cols-2">
                <Field label="Declaración" value={record.declarationIdRaw} mono />
                <Field label="Item" value={record.itemNumber} />
                <Field label="Fecha aceptación" value={record.acceptanceDate} />
                <Field label={participant.label} value={participant.value} mono />
                <Field label="Descripción fuente" value={record.productDescriptionRaw} />
                <Field
                  label="Referencia producto fuente"
                  value={product.sourceReference ?? "No informado"}
                  mono
                />
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
              <CardTitle>{valuesCopy.title}</CardTitle>
              <CardDescription>{valuesCopy.description}</CardDescription>
            </CardHeader>
            <CardContent>
              {record.tradeFlow === "import" ? (
                <dl className="grid gap-4 md:grid-cols-3">
                  <Field
                    label="CIF item"
                    value={formatMoney(record.itemCifValue, record.decodedLabels.currency)}
                    mono
                  />
                  <Field
                    label="FOB declaración"
                    value={formatMoney(
                      record.declarationFobValue,
                      record.decodedLabels.currency,
                    )}
                    mono
                  />
                  <Field
                    label="CIF declaración"
                    value={formatMoney(record.cifValue, record.decodedLabels.currency)}
                    mono
                  />
                  <Field
                    label="Flete"
                    value={formatMoney(record.freightValue, record.decodedLabels.currency)}
                    mono
                  />
                  <Field
                    label="Seguro"
                    value={formatMoney(record.insuranceValue, record.decodedLabels.currency)}
                    mono
                  />
                  <Field
                    label="Precio unitario"
                    value={formatMoney(record.unitPriceValue, record.decodedLabels.currency)}
                    mono
                  />
                  <Field
                    label="Cantidad"
                    value={formatQuantity(record.quantity, record.decodedLabels.quantityUnit)}
                    mono
                  />
                  <Field label="Peso bruto total" value={record.grossWeightTotal} mono />
                  <Field label="Peso bruto item" value={record.grossWeightItem} mono />
                </dl>
              ) : (
                <div className="flex flex-col gap-4">
                  <dl className="grid gap-4 md:grid-cols-3">
                    <Field
                      label="FOB item"
                      value={formatMoney(record.itemFobValue, record.decodedLabels.currency)}
                      mono
                    />
                    <Field
                      label="FOB declaración"
                      value={formatMoney(
                        record.declarationFobValue,
                        record.decodedLabels.currency,
                      )}
                      mono
                    />
                    <Field
                      label="Precio unitario FOB"
                      value={formatMoney(record.unitPriceValue, record.decodedLabels.currency)}
                      mono
                    />
                    <Field
                      label="Cantidad"
                      value={formatQuantity(record.quantity, record.decodedLabels.quantityUnit)}
                      mono
                    />
                    <Field label="Peso bruto item" value={record.grossWeightItem} mono />
                    <Field label="Peso bruto total" value={record.grossWeightTotal} mono />
                    <Field
                      label="País destino"
                      value={formatCodeLabel(
                        record.destinationCountryCode,
                        record.decodedLabels.destinationCountry,
                      )}
                    />
                    <Field
                      label="Puerto embarque"
                      value={formatCodeLabel(
                        record.embarkPortCode,
                        record.decodedLabels.embarkPort,
                      )}
                    />
                    <Field
                      label="Puerto desembarque"
                      value={formatCodeLabel(
                        record.disembarkPortCode,
                        record.decodedLabels.disembarkPort,
                      )}
                    />
                    <Field
                      label="Vía transporte"
                      value={formatCodeLabel(
                        record.transportModeCode,
                        record.decodedLabels.transportMode,
                      )}
                    />
                  </dl>
                  {exportAdditionalValues.length > 0 ? (
                    <>
                      <Separator />
                      <div className="flex flex-col gap-3">
                        <div>
                          <h3 className="text-sm font-medium">
                            Costos declarados adicionales
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            Se muestran solo cuando la fuente trae valores distintos de
                            cero; FOB sigue siendo la lectura principal de exportación.
                          </p>
                        </div>
                        <dl className="grid gap-4 md:grid-cols-3">
                          {exportAdditionalValues.map((field) => (
                            <Field
                              key={field.label}
                              label={field.label}
                              value={formatMoney(field.value, record.decodedLabels.currency)}
                              mono
                            />
                          ))}
                        </dl>
                      </div>
                    </>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Geografía y logística</CardTitle>
              <CardDescription>Códigos decodificados cuando existe tabla oficial.</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 md:grid-cols-2">
                <Field
                  label="País origen"
                  value={formatCodeLabel(
                    record.originCountryCode,
                    record.decodedLabels.originCountry,
                  )}
                />
                <Field
                  label="País adquisición"
                  value={formatCodeLabel(
                    record.acquisitionCountryCode,
                    record.decodedLabels.acquisitionCountry,
                  )}
                />
                <Field
                  label="País consignación"
                  value={formatCodeLabel(
                    record.consignmentCountryCode,
                    record.decodedLabels.consignmentCountry,
                  )}
                />
                <Field
                  label="País destino"
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
                  label="Vía transporte"
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
              <CardDescription>Trazabilidad mínima para auditar el registro.</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4">
                <Field label="Archivo fuente" value={record.sourceFilename} />
                <Field label="Fila cruda" value={record.rawRowNumber} />
                <Field label="Raw row ID" value={record.rawTradeRowId} mono />
                <Field label="Lote" value={record.importBatchId} mono />
                <Field label="Estado lote" value={record.importBatchStatus} />
                <Field label="Parser" value={`${record.parserName} ${record.parserVersion}`} />
                <Field
                  label="Retención payload"
                  value={formatPayloadRetentionMode(record.payloadRetentionMode)}
                />
                <Field
                  label="Estado payload"
                  value={formatPayloadRetainedReason(record.payloadRetainedReason)}
                />
                <Field label="Payload hash" value={record.payloadHashSha256} mono />
                <Field label="Payload podado" value={formatPrunedAt(record.payloadPrunedAt)} />
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Atributos producto</CardTitle>
              <CardDescription>
                Campos auxiliares de la fuente, normalizados solo para lectura.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {productAttributes.length > 0 ? (
                <dl className="grid gap-3">
                  {productAttributes.map((attribute) => (
                    <Field
                      key={`${attribute.label}:${attribute.value}`}
                      label={attribute.label}
                      value={attribute.value}
                    />
                  ))}
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No hay atributos auxiliares informados para este item.
                </p>
              )}
            </CardContent>
          </Card>
        </aside>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Fila cruda</CardTitle>
          <CardDescription>
            Vista de auditoría. Puede incluir partes operativas del documento, pero no se
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
