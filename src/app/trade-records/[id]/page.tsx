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
import {
  enrichTradeRecordWithLabels,
  enrichTradeRecordsWithLabels,
  type TradeRecordWithLabels,
} from "@/trade/trade-record-labels";
import {
  getTradeRecordById,
  listRelatedTradeRecords,
  type TradeRecordDetail,
} from "@/trade/trade-records";
import {
  DetailField,
  formatDetailCodeLabel,
  formatDetailJson,
  formatDetailMoney,
  formatDetailQuantity,
} from "./detail-fields";
import { ProvenancePanel } from "./provenance-panel";
import {
  RelatedRecordsSection,
  type RelatedRecord,
} from "./related-records-section";

type PageProps = {
  params: Promise<{ id: string }>;
};

type DetailRecord = TradeRecordWithLabels<TradeRecordDetail>;

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

export default async function TradeRecordDetailPage({ params }: PageProps) {
  const { id } = await params;
  const baseRecord = await getTradeRecordById(db, id);
  const record = await enrichTradeRecordWithLabels(db, baseRecord);

  if (!record) {
    notFound();
  }

  const relatedGroupsRaw = await listRelatedTradeRecords(db, record, 5);
  const relatedRecordsRaw = relatedGroupsRaw.flatMap((group) => group.records);
  const relatedRecordsById = new Map(
    relatedRecordsRaw.length > 0
      ? (await enrichTradeRecordsWithLabels(db, relatedRecordsRaw)).map((related) => [
          related.id,
          related,
        ])
      : [],
  );
  const relatedGroups = relatedGroupsRaw.map((group) => ({
    ...group,
    records: group.records
      .map((related) => relatedRecordsById.get(related.id))
      .filter((related): related is RelatedRecord => Boolean(related)),
  }));

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
                <DetailField label="Declaración" value={record.declarationIdRaw} mono />
                <DetailField label="Item" value={record.itemNumber} />
                <DetailField label="Fecha aceptación" value={record.acceptanceDate} />
                <DetailField label={participant.label} value={participant.value} mono />
                <DetailField label="Descripción fuente" value={record.productDescriptionRaw} />
                <DetailField
                  label="Referencia producto fuente"
                  value={product.sourceReference ?? "No informado"}
                  mono
                />
                <DetailField label="HS original" value={record.hsCodeRaw} mono />
                <DetailField label="HS normalizado" value={record.hsCodeNormalized} mono />
                <DetailField
                  label="Unidad cantidad"
                  value={formatDetailCodeLabel(
                    record.quantityUnitCode,
                    record.decodedLabels.quantityUnit,
                  )}
                />
                <DetailField label="Cantidad" value={record.quantity} mono />
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
                  <DetailField
                    label="CIF item"
                    value={formatDetailMoney(record.itemCifValue, record.decodedLabels.currency)}
                    mono
                  />
                  <DetailField
                    label="FOB declaración"
                    value={formatDetailMoney(
                      record.declarationFobValue,
                      record.decodedLabels.currency,
                    )}
                    mono
                  />
                  <DetailField
                    label="CIF declaración"
                    value={formatDetailMoney(record.cifValue, record.decodedLabels.currency)}
                    mono
                  />
                  <DetailField
                    label="Flete"
                    value={formatDetailMoney(record.freightValue, record.decodedLabels.currency)}
                    mono
                  />
                  <DetailField
                    label="Seguro"
                    value={formatDetailMoney(record.insuranceValue, record.decodedLabels.currency)}
                    mono
                  />
                  <DetailField
                    label="Precio unitario"
                    value={formatDetailMoney(record.unitPriceValue, record.decodedLabels.currency)}
                    mono
                  />
                  <DetailField
                    label="Cantidad"
                    value={formatDetailQuantity(record.quantity, record.decodedLabels.quantityUnit)}
                    mono
                  />
                  <DetailField label="Peso bruto total" value={record.grossWeightTotal} mono />
                  <DetailField label="Peso bruto item" value={record.grossWeightItem} mono />
                </dl>
              ) : (
                <div className="flex flex-col gap-4">
                  <dl className="grid gap-4 md:grid-cols-3">
                    <DetailField
                      label="FOB item"
                      value={formatDetailMoney(record.itemFobValue, record.decodedLabels.currency)}
                      mono
                    />
                    <DetailField
                      label="FOB declaración"
                      value={formatDetailMoney(
                        record.declarationFobValue,
                        record.decodedLabels.currency,
                      )}
                      mono
                    />
                    <DetailField
                      label="Precio unitario FOB"
                      value={formatDetailMoney(record.unitPriceValue, record.decodedLabels.currency)}
                      mono
                    />
                    <DetailField
                      label="Cantidad"
                      value={formatDetailQuantity(record.quantity, record.decodedLabels.quantityUnit)}
                      mono
                    />
                    <DetailField label="Peso bruto item" value={record.grossWeightItem} mono />
                    <DetailField label="Peso bruto total" value={record.grossWeightTotal} mono />
                    <DetailField
                      label="País destino"
                      value={formatDetailCodeLabel(
                        record.destinationCountryCode,
                        record.decodedLabels.destinationCountry,
                      )}
                    />
                    <DetailField
                      label="Puerto embarque"
                      value={formatDetailCodeLabel(
                        record.embarkPortCode,
                        record.decodedLabels.embarkPort,
                      )}
                    />
                    <DetailField
                      label="Puerto desembarque"
                      value={formatDetailCodeLabel(
                        record.disembarkPortCode,
                        record.decodedLabels.disembarkPort,
                      )}
                    />
                    <DetailField
                      label="Vía transporte"
                      value={formatDetailCodeLabel(
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
                            <DetailField
                              key={field.label}
                              label={field.label}
                              value={formatDetailMoney(field.value, record.decodedLabels.currency)}
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
                <DetailField
                  label="País origen"
                  value={formatDetailCodeLabel(
                    record.originCountryCode,
                    record.decodedLabels.originCountry,
                  )}
                />
                <DetailField
                  label="País adquisición"
                  value={formatDetailCodeLabel(
                    record.acquisitionCountryCode,
                    record.decodedLabels.acquisitionCountry,
                  )}
                />
                <DetailField
                  label="País consignación"
                  value={formatDetailCodeLabel(
                    record.consignmentCountryCode,
                    record.decodedLabels.consignmentCountry,
                  )}
                />
                <DetailField
                  label="País destino"
                  value={formatDetailCodeLabel(
                    record.destinationCountryCode,
                    record.decodedLabels.destinationCountry,
                  )}
                />
                <DetailField
                  label="Aduana"
                  value={formatDetailCodeLabel(
                    record.customsOfficeCode,
                    record.decodedLabels.customsOffice,
                  )}
                />
                <DetailField
                  label="Vía transporte"
                  value={formatDetailCodeLabel(
                    record.transportModeCode,
                    record.decodedLabels.transportMode,
                  )}
                />
                <DetailField
                  label="Puerto embarque"
                  value={formatDetailCodeLabel(record.embarkPortCode, record.decodedLabels.embarkPort)}
                />
                <DetailField
                  label="Puerto desembarque"
                  value={formatDetailCodeLabel(
                    record.disembarkPortCode,
                    record.decodedLabels.disembarkPort,
                  )}
                />
                <DetailField
                  label="Tipo carga"
                  value={formatDetailCodeLabel(record.cargoTypeCode, record.decodedLabels.cargoType)}
                />
              </dl>
            </CardContent>
          </Card>
        </div>

        <aside className="flex flex-col gap-4">
          <ProvenancePanel record={record} />

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
                    <DetailField
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

      <RelatedRecordsSection groups={relatedGroups} />

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
              {formatDetailJson(record.rawValues)}
            </pre>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
