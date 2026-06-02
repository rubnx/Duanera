import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ComparisonSection,
  type ComparisonRow,
} from "@/components/trade-record-comparison-section";
import { productDisplayFromRaw } from "@/trade/trade-record-display";
import type { TradeRecordFilterOptions } from "@/trade/trade-record-filter-options";
import { buildTradeRecordSearchHref } from "@/trade/trade-record-links";
import type { TradeRecordSearchResponse } from "@/trade/trade-record-search";
import {
  tradeRecordSummaryCodeLabel,
  tradeRecordSummaryCountryTitle,
  tradeRecordSummaryPortTitle,
} from "@/trade/trade-record-summary-labels";

function comparisonParticipantTitle(filters: TradeRecordSearchResponse["filters"]) {
  if (filters.tradeFlow === "export") {
    return "Correlativos exportador Aduana";
  }

  if (filters.tradeFlow === "import") {
    return "Correlativos importador Aduana";
  }

  return "Correlativos Aduana";
}

function comparisonParticipantHref(
  params: Record<string, string | string[] | undefined>,
  filters: TradeRecordSearchResponse["filters"],
  code: string,
) {
  return buildTradeRecordSearchHref(params, {
    type: filters.tradeFlow === "export" ? "exporter" : "importer",
    code,
  });
}

export function TradeRecordCommercialComparison({
  filterOptions,
  params,
  result,
}: {
  filterOptions: TradeRecordFilterOptions;
  params: Record<string, string | string[] | undefined>;
  result: TradeRecordSearchResponse;
}) {
  const { comparison, filters } = result;

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Comparación comercial</CardTitle>
        <CardDescription>
          Top {comparison.limit} por dimensión para comparar el resultado filtrado
          completo. Los promedios unitarios solo se muestran cuando moneda y unidad son
          comparables.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {comparison.skippedReason === "broad_result_set" ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-50/50 px-3 py-2 text-sm text-muted-foreground">
            Comparación omitida para esta búsqueda amplia. Agrega un filtro de HS,
            producto, país, aduana, puerto, rango comercial o correlativo anónimo para
            comparar grupos sin ejecutar una agregación demasiado pesada.
          </div>
        ) : (
          <div className="space-y-4">
            <ComparisonSection
              title="Productos / HS"
              description="Agrupado por prefijo HS de 6 dígitos con una descripción fuente de muestra."
              rows={comparison.groups.products}
              filterOptions={filterOptions}
              hrefFor={(row) =>
                buildTradeRecordSearchHref(params, {
                  type: "hsCodePrefix",
                  code: row.code,
                })
              }
              labelFor={(row) => ({
                title: `HS ${row.code}`,
                detail: row.productDescriptionRaw
                  ? productDisplayFromRaw(row.productDescriptionRaw).title
                  : undefined,
              })}
            />
            <ComparisonSection
              title={tradeRecordSummaryCountryTitle(filters)}
              description="País comercial relevante para el flujo: origen en importaciones, destino en exportaciones."
              rows={comparison.groups.countries}
              filterOptions={filterOptions}
              hrefFor={(row) =>
                buildTradeRecordSearchHref(params, {
                  type: "country",
                  code: row.code,
                  tradeFlow: filters.tradeFlow,
                })
              }
              labelFor={(row) => ({
                title: tradeRecordSummaryCodeLabel(
                  filterOptions.countries,
                  row.code,
                  row.labelRaw,
                ),
              })}
            />
            <ComparisonSection
              title="Aduanas"
              description="Oficinas Aduana con más registros dentro de los filtros actuales."
              rows={comparison.groups.customsOffices}
              filterOptions={filterOptions}
              hrefFor={(row) =>
                buildTradeRecordSearchHref(params, {
                  type: "customsOffice",
                  code: row.code,
                })
              }
              labelFor={(row) => ({
                title: tradeRecordSummaryCodeLabel(
                  filterOptions.customsOffices,
                  row.code,
                  row.labelRaw,
                ),
              })}
            />
            <ComparisonSection
              title={tradeRecordSummaryPortTitle(filters)}
              description="Puerto relevante para el flujo: desembarque en importaciones, embarque en exportaciones."
              rows={comparison.groups.ports}
              filterOptions={filterOptions}
              hrefFor={(row) =>
                buildTradeRecordSearchHref(params, {
                  type: "port",
                  code: row.code,
                })
              }
              labelFor={(row) => ({
                title: tradeRecordSummaryCodeLabel(filterOptions.ports, row.code, row.labelRaw),
              })}
            />
            <ComparisonSection
              title={comparisonParticipantTitle(filters)}
              description="Correlativos anónimos de la fuente Aduana; no representan identidad legal verificada."
              rows={comparison.groups.participants}
              filterOptions={filterOptions}
              hrefFor={(row) => comparisonParticipantHref(params, filters, row.code)}
              labelFor={(row) => ({
                title: `${row.code} · correlativo anónimo`,
              })}
            />
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Comparación read-only en Postgres MVP. Úsala como contexto direccional de marzo
          2026; cantidades, monedas y correlativos conservan las limitaciones de la
          fuente.
        </p>
      </CardContent>
    </Card>
  );
}
