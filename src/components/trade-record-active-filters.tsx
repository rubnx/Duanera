import { Badge } from "@/components/ui/badge";
import {
  type TradeRecordFilterOption,
  type TradeRecordFilterOptions,
} from "@/trade/trade-record-filter-options";
import type { TradeRecordSearchResponse } from "@/trade/trade-record-search";

function optionLabel(options: TradeRecordFilterOption[], value: string | undefined) {
  if (!value) {
    return undefined;
  }

  return options.find((option) => option.value === value)?.displayLabel ?? value;
}

function sortLabel(value: string | undefined) {
  const labels: Record<string, string> = {
    source: "Orden fuente",
    item_value_desc: "Mayor valor item",
    item_value_asc: "Menor valor item",
    declaration_fob_desc: "Mayor FOB declaración",
    quantity_desc: "Mayor cantidad",
    gross_weight_desc: "Mayor peso bruto",
  };

  return value ? labels[value] ?? value : undefined;
}

function rangeLabel(from: string | undefined, to: string | undefined) {
  if (from && to) {
    return `${from} a ${to}`;
  }

  if (from) {
    return `desde ${from}`;
  }

  if (to) {
    return `hasta ${to}`;
  }

  return undefined;
}

function itemValueFilterLabel(filters: TradeRecordSearchResponse["filters"]) {
  if (filters.tradeFlow === "import") {
    return "Valor CIF item";
  }

  if (filters.tradeFlow === "export") {
    return "Valor FOB item";
  }

  return "Valor item CIF/FOB";
}

function activeFilterItems(
  result: TradeRecordSearchResponse,
  filterOptions: TradeRecordFilterOptions,
) {
  const filters = result.filters;
  const items = [
    {
      label: "Flujo",
      value: filters.tradeFlow === "export" ? "Exportaciones" : "Importaciones",
    },
    {
      label: "Período",
      value:
        filters.periodFrom && filters.periodTo
          ? `${filters.periodFrom} a ${filters.periodTo}`
          : undefined,
    },
    { label: "HS", value: filters.hsCodePrefix },
    { label: "Producto", value: filters.productQuery },
    {
      label: "Importador Aduana",
      value: filters.importerCorrelativeId
        ? `${filters.importerCorrelativeId} · correlativo anónimo`
        : undefined,
    },
    {
      label: "Exportador Aduana",
      value: filters.exporterCorrelativeId
        ? `${filters.exporterCorrelativeId} · correlativo anónimo`
        : undefined,
    },
    {
      label: "País origen",
      value: optionLabel(filterOptions.countries, filters.originCountryCode),
    },
    {
      label: "País destino",
      value: optionLabel(filterOptions.countries, filters.destinationCountryCode),
    },
    {
      label: "Aduana",
      value: optionLabel(filterOptions.customsOffices, filters.customsOfficeCode),
    },
    {
      label: "Vía transporte",
      value: optionLabel(filterOptions.transportModes, filters.transportModeCode),
    },
    {
      label: "Puerto relevante",
      value: optionLabel(filterOptions.ports, filters.portCode),
    },
    {
      label: itemValueFilterLabel(filters),
      value: rangeLabel(filters.minItemValue, filters.maxItemValue),
    },
    {
      label: "FOB declaración",
      value: rangeLabel(filters.minDeclarationFob, filters.maxDeclarationFob),
    },
    {
      label: "Cantidad",
      value: rangeLabel(filters.minQuantity, filters.maxQuantity),
    },
    {
      label: "Peso bruto item",
      value: rangeLabel(filters.minGrossWeightItem, filters.maxGrossWeightItem),
    },
    {
      label: "Peso bruto total",
      value: rangeLabel(filters.minGrossWeightTotal, filters.maxGrossWeightTotal),
    },
    {
      label: "Orden",
      value:
        filters.sort && filters.sort !== "source"
          ? sortLabel(filters.sort)
          : undefined,
    },
  ];

  return items.filter((item): item is { label: string; value: string } =>
    Boolean(item.value),
  );
}

export function TradeRecordActiveFilters({
  filterOptions,
  result,
  usesPeriodRange,
  usesOffsetMode,
}: {
  filterOptions: TradeRecordFilterOptions;
  result: TradeRecordSearchResponse;
  usesPeriodRange: boolean;
  usesOffsetMode: boolean;
}) {
  const activeFilters = activeFilterItems(result, filterOptions);

  return (
    <div className="mt-4 border-t pt-3">
      <div className="mb-2 text-xs font-medium text-muted-foreground">
        Filtros activos
      </div>
      <div className="flex flex-wrap gap-2">
        {activeFilters.map((filter) => (
          <Badge
            key={`${filter.label}:${filter.value}`}
            variant="outline"
            className="h-auto max-w-full justify-start whitespace-normal break-words text-left"
          >
            {filter.label}: {filter.value}
          </Badge>
        ))}
      </div>
      {usesOffsetMode ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {usesPeriodRange
            ? "Los rangos de varios meses usan paginación por posición; para revisar mucho volumen, acota por un mes exacto, HS, país, puerto, aduana o rango comercial."
            : "Los rangos comerciales, búsquedas de texto, correlativos y ordenamientos por valor usan paginación por posición para mantener el orden solicitado."}
        </p>
      ) : null}
    </div>
  );
}
