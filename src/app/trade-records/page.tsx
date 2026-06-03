import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { TradeRecordCommercialComparison } from "@/components/trade-record-commercial-comparison";
import { TradeRecordIntelligenceSummary } from "@/components/trade-record-intelligence-summary";
import { TradeRecordPresetViews } from "@/components/trade-record-preset-views";
import { TradeRecordResultsTable } from "@/components/trade-record-results-table";
import { TradeRecordSearchFilters } from "@/components/trade-record-search-filters";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db } from "@/db/client";
import { loadTradeRecordFilterOptions } from "@/trade/trade-record-filter-options";
import { filtersToTradeRecordSearchParams } from "@/trade/trade-record-links";
import { activeTradeRecordPresetId } from "@/trade/trade-record-presets";
import {
  fallbackTradeRecordPeriod,
  formatTradeRecordPeriodScope,
  listTradeRecordPeriods,
} from "@/trade/trade-record-periods";
import { parseTradeRecordTableView } from "@/trade/trade-record-table-views";
import {
  searchTradeRecords,
  TradeRecordSearchError,
} from "@/trade/trade-record-search";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type TradeRecordsSearchResult = Awaited<ReturnType<typeof searchTradeRecords>>;

function defaultSearchInput(defaultPeriod: string) {
  return {
    tradeFlow: "import",
    periodFrom: defaultPeriod,
    periodTo: defaultPeriod,
    limit: "25",
  };
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function performanceNote(result: TradeRecordsSearchResult) {
  const warnings = result.meta.performanceWarnings;
  if (warnings.length === 0) {
    return undefined;
  }

  const reasons = warnings.map((warning) => warning.message).join(" ");
  return `${reasons} Tiempos internos: lista ${result.meta.timingMs.list} ms, resumen ${result.meta.timingMs.summary} ms, comparación ${result.meta.timingMs.comparison} ms, etiquetas ${result.meta.timingMs.labels} ms, total ${result.meta.timingMs.total} ms.`;
}

function buildPageHref(
  params: Record<string, string | string[] | undefined>,
  nextValues: { offset?: number; after?: string },
) {
  const next = new URLSearchParams();

  for (const [key, rawValue] of Object.entries(params)) {
    const value = firstValue(rawValue);
    if (value && key !== "offset" && key !== "after") {
      next.set(key, value);
    }
  }

  if (nextValues.offset && nextValues.offset > 0) {
    next.set("offset", String(nextValues.offset));
  }

  if (nextValues.after) {
    next.set("after", nextValues.after);
  }

  const query = next.toString();
  return query ? `/trade-records?${query}` : "/trade-records";
}

export default async function TradeRecordsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const availablePeriods = await listTradeRecordPeriods(db);
  const latestPeriod = availablePeriods[0]?.value ?? fallbackTradeRecordPeriod;
  const defaultInput = defaultSearchInput(latestPeriod);
  const defaultPresetPeriod = {
    periodFrom: latestPeriod,
    periodTo: latestPeriod,
  };
  const tableView = parseTradeRecordTableView(firstValue(params.view));
  const availablePeriodScope = formatTradeRecordPeriodScope(availablePeriods);
  const searchInput = {
    tradeFlow: firstValue(params.tradeFlow) ?? defaultInput.tradeFlow,
    periodFrom: firstValue(params.periodFrom) ?? defaultInput.periodFrom,
    periodTo: firstValue(params.periodTo) ?? defaultInput.periodTo,
    hsCodePrefix: firstValue(params.hsCodePrefix),
    q: firstValue(params.q),
    importer: firstValue(params.importer),
    exporter: firstValue(params.exporter),
    originCountry: firstValue(params.originCountry),
    destinationCountry: firstValue(params.destinationCountry),
    customsOffice: firstValue(params.customsOffice),
    transportMode: firstValue(params.transportMode),
    port: firstValue(params.port),
    minItemValue: firstValue(params.minItemValue),
    maxItemValue: firstValue(params.maxItemValue),
    minDeclarationFob: firstValue(params.minDeclarationFob),
    maxDeclarationFob: firstValue(params.maxDeclarationFob),
    minQuantity: firstValue(params.minQuantity),
    maxQuantity: firstValue(params.maxQuantity),
    minGrossWeightItem: firstValue(params.minGrossWeightItem),
    maxGrossWeightItem: firstValue(params.maxGrossWeightItem),
    minGrossWeightTotal: firstValue(params.minGrossWeightTotal),
    maxGrossWeightTotal: firstValue(params.maxGrossWeightTotal),
    sort: firstValue(params.sort),
    limit: firstValue(params.limit) ?? defaultInput.limit,
    offset: firstValue(params.offset),
    after: firstValue(params.after),
  };

  let result: TradeRecordsSearchResult;
  let searchError: string | null = null;
  const filterOptions = await loadTradeRecordFilterOptions(db);

  try {
    result = await searchTradeRecords(db, searchInput);
  } catch (error) {
    if (!(error instanceof TradeRecordSearchError)) {
      throw error;
    }

    searchError = error.message;
    result = await searchTradeRecords(db, defaultInput);
  }

  const previousOffset = Math.max(result.pagination.offset - result.pagination.limit, 0);
  const nextOffset = result.pagination.offset + result.pagination.limit;
  const effectiveSearchParams = {
    ...filtersToTradeRecordSearchParams(result.filters),
    view: tableView,
  };
  const hasCursor = Boolean(searchInput.after);
  const hasPrevious = result.pagination.offset > 0 && !hasCursor;
  const hasNext =
    Boolean(result.pagination.nextCursor) || (!hasCursor && nextOffset < result.pagination.total);
  const nextHref = result.pagination.nextCursor
    ? buildPageHref(effectiveSearchParams, { after: result.pagination.nextCursor })
    : buildPageHref(effectiveSearchParams, { offset: nextOffset });
  const activePresetId = activeTradeRecordPresetId(result.filters, defaultPresetPeriod);
  const usesOffsetMode = result.pagination.paginationMode === "offset";
  const searchPerformanceNote = performanceNote(result);

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 py-5 lg:px-6">
      <header className="flex flex-col gap-3 border-b pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <Badge variant="outline" className="w-fit">
            Demo interno
          </Badge>
          <h1 className="text-2xl font-semibold tracking-tight">Registros Aduana</h1>
          <p className="max-w-3xl break-words text-sm text-muted-foreground">
            Base dev con registros Aduana disponibles para {availablePeriodScope}. La
            búsqueda sin filtros usa el último mes cargado ({latestPeriod}) para evitar
            consultas amplias por defecto. Los IDs de importador/exportador son
            correlativos anónimos de Aduana, no identidades legales verificadas.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link
            href="/sources"
            className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Fuentes
          </Link>
          <Link
            href="/"
            className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Inicio
          </Link>
        </div>
      </header>

      <TradeRecordPresetViews
        activePresetId={activePresetId}
        defaultPeriod={defaultPresetPeriod}
      />

      <TradeRecordSearchFilters
        filterOptions={filterOptions}
        result={result}
        usesOffsetMode={usesOffsetMode}
      />

      {searchError ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle>Filtro inválido</CardTitle>
            <CardDescription>
              {searchError} Se muestran los registros por defecto.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {searchPerformanceNote ? (
        <Card className="border-amber-500/30 bg-amber-50/50">
          <CardHeader>
            <CardTitle>Nota de rendimiento</CardTitle>
            <CardDescription className="break-words">
              {searchPerformanceNote}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <TradeRecordIntelligenceSummary
        filterOptions={filterOptions}
        params={effectiveSearchParams}
        result={result}
      />

      <TradeRecordCommercialComparison
        filterOptions={filterOptions}
        params={effectiveSearchParams}
        result={result}
      />

      <TradeRecordResultsTable
        hasCursor={hasCursor}
        params={effectiveSearchParams}
        result={result}
        view={tableView}
      />

      <nav className="flex items-center justify-between">
        <Link
          aria-disabled={!hasPrevious}
          href={hasPrevious ? buildPageHref(effectiveSearchParams, { offset: previousOffset }) : "#"}
          tabIndex={hasPrevious ? undefined : -1}
          className="inline-flex h-8 items-center rounded-lg border border-border px-2.5 text-sm font-medium aria-disabled:pointer-events-none aria-disabled:opacity-40 hover:bg-muted"
        >
          Anterior
        </Link>
        <Link
          aria-disabled={!hasNext}
          href={hasNext ? nextHref : "#"}
          tabIndex={hasNext ? undefined : -1}
          className="inline-flex h-8 items-center rounded-lg border border-border px-2.5 text-sm font-medium aria-disabled:pointer-events-none aria-disabled:opacity-40 hover:bg-muted"
        >
          Siguiente
        </Link>
      </nav>
    </main>
  );
}
