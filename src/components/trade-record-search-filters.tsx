import Link from "next/link";

import { TradeRecordActiveFilters } from "@/components/trade-record-active-filters";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type TradeRecordFilterOption,
  type TradeRecordFilterOptions,
} from "@/trade/trade-record-filter-options";
import type { TradeRecordSearchResponse } from "@/trade/trade-record-search";

function LookupSelect({
  id,
  label,
  name,
  options,
  placeholder,
  value,
}: {
  id: string;
  label: string;
  name: string;
  options: TradeRecordFilterOption[];
  placeholder: string;
  value?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        name={name}
        defaultValue={value ?? ""}
        className="h-8 w-full min-w-0 rounded-lg border border-input bg-background px-2.5 text-sm"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.displayLabel}
          </option>
        ))}
      </select>
    </div>
  );
}

function RangeInput({
  id,
  label,
  name,
  placeholder,
  value,
}: {
  id: string;
  label: string;
  name: string;
  placeholder: string;
  value?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        type="text"
        inputMode="decimal"
        pattern="[0-9]+([,.][0-9]+)?"
        defaultValue={value ?? ""}
        placeholder={placeholder}
      />
    </div>
  );
}

export function TradeRecordSearchFilters({
  filterOptions,
  result,
  usesOffsetMode,
}: {
  filterOptions: TradeRecordFilterOptions;
  result: TradeRecordSearchResponse;
  usesOffsetMode: boolean;
}) {
  const usesPeriodRange =
    result.filters.periodFrom &&
    result.filters.periodTo &&
    result.filters.periodFrom !== result.filters.periodTo;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Filtros</CardTitle>
        <CardDescription className="break-words">
          Busca por flujo, período, partida HS, producto, etiquetas decodificadas y
          correlativos anónimos de Aduana. Puerto embarque y puerto desembarque
          se filtran de forma independiente. Los rangos comerciales usan valor CIF
          item en importaciones y valor FOB item en exportaciones.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-6 [&>*]:min-w-0">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tradeFlow">Flujo</Label>
            <select
              id="tradeFlow"
              name="tradeFlow"
              defaultValue={result.filters.tradeFlow ?? "import"}
              className="h-8 w-full min-w-0 rounded-lg border border-input bg-background px-2.5 text-sm"
            >
              <option value="import">Importaciones</option>
              <option value="export">Exportaciones</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="periodFrom">Desde</Label>
            <Input
              id="periodFrom"
              name="periodFrom"
              defaultValue={result.filters.periodFrom ?? ""}
              placeholder="YYYY-MM"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="periodTo">Hasta</Label>
            <Input
              id="periodTo"
              name="periodTo"
              defaultValue={result.filters.periodTo ?? ""}
              placeholder="YYYY-MM"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="hsCodePrefix">Código HS</Label>
            <Input
              id="hsCodePrefix"
              name="hsCodePrefix"
              defaultValue={result.filters.hsCodePrefix ?? ""}
              placeholder="4011"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="q">Producto / atributos</Label>
            <Input
              id="q"
              name="q"
              defaultValue={result.filters.productQuery ?? ""}
              placeholder="neumáticos"
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Button type="submit" className="sm:flex-1">
              Buscar
            </Button>
            <Link
              href="/trade-records"
              className="inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-border px-2.5 text-sm font-medium hover:bg-muted"
            >
              Limpiar
            </Link>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="importer">Correlativo importador</Label>
            <Input
              id="importer"
              name="importer"
              defaultValue={result.filters.importerCorrelativeId ?? ""}
              placeholder="10998"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="exporter">Correlativo exportador</Label>
            <Input
              id="exporter"
              name="exporter"
              defaultValue={result.filters.exporterCorrelativeId ?? ""}
              placeholder="3904"
            />
          </div>
          <LookupSelect
            id="originCountry"
            name="originCountry"
            label="País origen"
            value={result.filters.originCountryCode}
            options={filterOptions.countries}
            placeholder="Todos los orígenes"
          />
          <LookupSelect
            id="destinationCountry"
            name="destinationCountry"
            label="País destino"
            value={result.filters.destinationCountryCode}
            options={filterOptions.countries}
            placeholder="Todos los destinos"
          />
          <LookupSelect
            id="customsOffice"
            name="customsOffice"
            label="Aduana"
            value={result.filters.customsOfficeCode}
            options={filterOptions.customsOffices}
            placeholder="Todas las aduanas"
          />
          <LookupSelect
            id="transportMode"
            name="transportMode"
            label="Vía transporte"
            value={result.filters.transportModeCode}
            options={filterOptions.transportModes}
            placeholder="Todas las vías"
          />
          <LookupSelect
            id="embarkPort"
            name="embarkPort"
            label="Puerto embarque"
            value={result.filters.embarkPortCode}
            options={filterOptions.ports}
            placeholder="Todos los puertos"
          />
          <LookupSelect
            id="disembarkPort"
            name="disembarkPort"
            label="Puerto desembarque"
            value={result.filters.disembarkPortCode}
            options={filterOptions.ports}
            placeholder="Todos los puertos"
          />
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor="sort">Orden</Label>
            <select
              id="sort"
              name="sort"
              defaultValue={result.filters.sort ?? "source"}
              className="h-8 w-full min-w-0 rounded-lg border border-input bg-background px-2.5 text-sm"
            >
              <option value="source">Orden fuente</option>
              <option value="item_value_desc">Mayor valor item</option>
              <option value="item_value_asc">Menor valor item</option>
              <option value="declaration_fob_desc">Mayor FOB declaración</option>
              <option value="quantity_desc">Mayor cantidad</option>
              <option value="gross_weight_desc">Mayor peso bruto</option>
            </select>
          </div>
          <RangeInput
            id="minItemValue"
            name="minItemValue"
            label="Valor item desde"
            value={result.filters.minItemValue}
            placeholder="1000"
          />
          <RangeInput
            id="maxItemValue"
            name="maxItemValue"
            label="Valor item hasta"
            value={result.filters.maxItemValue}
            placeholder="50000"
          />
          <RangeInput
            id="minDeclarationFob"
            name="minDeclarationFob"
            label="FOB declaración desde"
            value={result.filters.minDeclarationFob}
            placeholder="1000"
          />
          <RangeInput
            id="maxDeclarationFob"
            name="maxDeclarationFob"
            label="FOB declaración hasta"
            value={result.filters.maxDeclarationFob}
            placeholder="50000"
          />
          <RangeInput
            id="minQuantity"
            name="minQuantity"
            label="Cantidad desde"
            value={result.filters.minQuantity}
            placeholder="10"
          />
          <RangeInput
            id="maxQuantity"
            name="maxQuantity"
            label="Cantidad hasta"
            value={result.filters.maxQuantity}
            placeholder="10000"
          />
          <RangeInput
            id="minGrossWeightItem"
            name="minGrossWeightItem"
            label="Peso item desde"
            value={result.filters.minGrossWeightItem}
            placeholder="10"
          />
          <RangeInput
            id="maxGrossWeightItem"
            name="maxGrossWeightItem"
            label="Peso item hasta"
            value={result.filters.maxGrossWeightItem}
            placeholder="10000"
          />
          <RangeInput
            id="minGrossWeightTotal"
            name="minGrossWeightTotal"
            label="Peso total desde"
            value={result.filters.minGrossWeightTotal}
            placeholder="10"
          />
          <RangeInput
            id="maxGrossWeightTotal"
            name="maxGrossWeightTotal"
            label="Peso total hasta"
            value={result.filters.maxGrossWeightTotal}
            placeholder="10000"
          />
        </form>
        <TradeRecordActiveFilters
          filterOptions={filterOptions}
          result={result}
          usesPeriodRange={Boolean(usesPeriodRange)}
          usesOffsetMode={usesOffsetMode}
        />
      </CardContent>
    </Card>
  );
}
