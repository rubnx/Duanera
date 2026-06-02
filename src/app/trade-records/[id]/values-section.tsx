import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { isNonZeroDecimal } from "@/trade/trade-record-display";
import type { TradeRecordWithLabels } from "@/trade/trade-record-labels";
import type { TradeRecordDetail } from "@/trade/trade-records";
import {
  DetailField,
  formatDetailCodeLabel,
  formatDetailMoney,
  formatDetailQuantity,
} from "./detail-fields";

type DetailRecord = TradeRecordWithLabels<TradeRecordDetail>;

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

export function TradeRecordValuesSection({ record }: { record: DetailRecord }) {
  const valuesCopy = valueSectionCopy(record);
  const exportAdditionalValues = [
    { label: "Flete declaración", value: record.freightValue },
    { label: "Seguro declaración", value: record.insuranceValue },
    { label: "CIF declaración", value: record.cifValue },
  ].filter((field) => isNonZeroDecimal(field.value));

  return (
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
                        value={formatDetailMoney(
                          field.value,
                          record.decodedLabels.currency,
                        )}
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
  );
}
