import {
  ArrowDownIcon,
  ArrowUpIcon,
  BoxIcon,
  Building2Icon,
  DatabaseIcon,
  FileTextIcon,
  HelpCircleIcon,
  SearchIcon,
  ShieldCheckIcon,
  XIcon,
} from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"
import { and, eq, or, sql } from "drizzle-orm"

import { CountryFlag } from "@/components/common/country-flag"
import {
  AppShell,
  AppShellContent,
  AppShellMain,
  DataTable,
  DataTableActions,
  DataTableBody,
  DataTableCell,
  DataTableCount,
  DataTableEmpty,
  DataTableHead,
  DataTableHeader,
  DataTablePagination,
  DataTableRow,
  DataTableShell,
  DataTableTitle,
  DataTableToolbar,
  ExplorerSearchMemory,
  FilterBar,
  FilterBarActions,
  FilterBarGroup,
  GlobalSearch,
  SelectableDataTableRow,
  Sidebar,
  SidebarBrand,
  SidebarDataCard,
  SidebarFooter,
  SidebarInner,
  SidebarItem,
  SidebarSection,
} from "@/components/explorer"
import { ExplorerColumnHelp } from "@/components/explorer/explorer-column-help"
import { ExplorerDrawerProvider } from "@/components/explorer/explorer-drawer-context"
import { ExplorerExportPanel } from "@/components/explorer/explorer-export-panel"
import {
  ExplorerAdvancedFiltersPopover,
  ExplorerFlowFilterProvider,
  ExplorerPeriodFilterControl,
  ExplorerPrimaryFilterControls,
  ExplorerSortFilterControl,
  FilterInput,
} from "@/components/explorer/explorer-primary-filter-controls"
import { ExplorerRecordDetailDrawer } from "@/components/explorer/explorer-record-detail"
import { ExplorerSubmitButton } from "@/components/explorer/explorer-submit-button"
import { buttonVariants } from "@/components/ui/button"
import { FilterChip } from "@/components/ui/filter-chip"
import { StatusBadge, type StatusBadgeProps } from "@/components/ui/status-badge"
import { db } from "@/db/client"
import { sourceFiles } from "@/db/schema"
import { normalizeUuid } from "@/lib/ids"
import { cn } from "@/lib/utils"
import { sourceFilenameLabel } from "@/sources/source-provenance-helpers"
import {
  productAttributeDisplayFromRaw,
  productDisplayFromRaw,
} from "@/trade/trade-record-display"
import {
  loadTradeRecordFilterOptions,
  type TradeRecordFilterOption,
  type TradeRecordFilterOptions,
} from "@/trade/trade-record-filter-options"
import {
  formatTradeDecimal,
  formatTradeCurrencyLabel,
  formatTradeDisplayCodeLabel,
  formatTradeMoneyDisplay as formatTradeMoneyAmount,
  formatTradeQuantityDisplay,
  formatTradeQuantityUnitDisplay,
  formatTradeSummaryValue,
  type TradeDisplayCodeKind,
} from "@/trade/trade-record-format"
import { formatTradeFlowLabel, tradeFlowUiConfig } from "@/trade/trade-flow-ui"
import {
  fallbackTradeRecordPeriod,
  formatTradeRecordPeriodValue,
  formatTradeRecordPeriodScope,
  listProductTradeRecordPeriods,
} from "@/trade/trade-record-periods"
import { formatTradeRecordPeriodRangeLabel } from "@/trade/trade-record-period-labels"
import {
  buildTradeParticipantProfileHref,
  filtersToTradeRecordSearchParams,
} from "@/trade/trade-record-links"
import { createTradeRecordExportPlan } from "@/trade/trade-record-export"
import {
  searchTradeRecords,
  TradeRecordSearchError,
  type TradeRecordSearchResponse,
} from "@/trade/trade-record-search"
import {
  formatTradeRecordSortLabel,
  type TradeRecordSort,
} from "@/trade/trade-record-sort"
import { internalSourceCategories } from "@/trade/trade-record-where"
import {
  parseTradeRecordTableView,
  tradeRecordTableViewById,
  tradeRecordTableViews,
  type TradeRecordTableViewId,
} from "@/trade/trade-record-table-views"

export const dynamic = "force-dynamic"

type SearchParams = Promise<Record<string, string | string[] | undefined>>
type ExplorerRecord = TradeRecordSearchResponse["data"][number]
type ExplorerParams = Record<string, string | string[] | undefined>

const searchableParamKeys = [
  "tradeFlow",
  "periodFrom",
  "periodTo",
  "q",
  "hsCodePrefix",
  "importer",
  "exporter",
  "originCountry",
  "destinationCountry",
  "customsOffice",
  "transportMode",
  "embarkPort",
  "disembarkPort",
  "cargoType",
  "logisticsParty",
  "logisticsRole",
  "sort",
  "view",
  "ranking",
  "limit",
  "offset",
  "after",
  "minItemValue",
  "maxItemValue",
  "minDeclarationFob",
  "maxDeclarationFob",
  "minQuantity",
  "maxQuantity",
  "minGrossWeightItem",
  "maxGrossWeightItem",
  "minGrossWeightTotal",
  "maxGrossWeightTotal",
  "sourceFileId",
  "importBatchId",
] as const

const recordDetailDrawerId = "explorer-record-detail-drawer"
const rowActionDescriptionId = "explorer-row-action-description"
const resetSelectionAndPagination = {
  selected: null,
  offset: null,
  after: null,
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function paramText(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    const joined = value.filter((item) => item.trim()).join(",")
    return joined || undefined
  }

  return value
}

function defaultSearchInput(defaultPeriod: string) {
  return {
    tradeFlow: "import",
    periodFrom: defaultPeriod,
    periodTo: defaultPeriod,
    limit: "25",
  }
}

function buildExplorerHref(
  params: ExplorerParams,
  nextValues: Record<string, string | null | undefined>
) {
  const next = new URLSearchParams()

  for (const key of searchableParamKeys) {
    const value = paramText(params[key])
    if (value) {
      next.set(key, value)
    }
  }

  for (const [key, value] of Object.entries(nextValues)) {
    if (value === null || value === undefined || value === "") {
      next.delete(key)
    } else {
      next.set(key, value)
    }
  }

  const query = next.toString()
  return query ? `/explorer?${query}` : "/explorer"
}

function buildExplorerExportHref(params: ExplorerParams, endpoint: string) {
  const query = new URLSearchParams()

  for (const key of searchableParamKeys) {
    if (key === "limit" || key === "offset" || key === "after" || key === "ranking") {
      continue
    }

    const value = paramText(params[key])
    if (value) {
      query.set(key, value)
    }
  }

  const text = query.toString()
  return text ? `${endpoint}?${text}` : endpoint
}

function explorerNextPageHref(
  params: ExplorerParams,
  pagination: TradeRecordSearchResponse["pagination"],
  currentRowCount: number
) {
  if (pagination.nextCursor) {
    return buildExplorerHref(params, {
      after: pagination.nextCursor,
      offset: null,
      selected: null,
    })
  }

  if (firstValue(params.after)) {
    return null
  }

  if (pagination.offset + currentRowCount >= pagination.total) {
    return null
  }

  return buildExplorerHref(params, {
    after: null,
    offset: String(pagination.offset + pagination.limit),
    selected: null,
  })
}

function explorerPreviousPageHref(
  params: ExplorerParams,
  pagination: TradeRecordSearchResponse["pagination"]
) {
  if (firstValue(params.after)) {
    return buildExplorerHref(params, {
      after: null,
      offset: null,
      selected: null,
    })
  }

  if (pagination.offset <= 0) {
    return null
  }

  return buildExplorerHref(params, {
    after: null,
    offset: String(Math.max(0, pagination.offset - pagination.limit)),
    selected: null,
  })
}

function selectedExplorerHref(params: ExplorerParams, recordId: string) {
  return buildExplorerHref(params, { selected: recordId })
}

function explorerViewHref(params: ExplorerParams, view: TradeRecordTableViewId) {
  return buildExplorerHref(params, {
    view,
    selected: null,
    offset: null,
    after: null,
  })
}

function explorerRankingHref(
  params: ExplorerParams,
  nextValues: Record<string, string | null | undefined>
) {
  return buildExplorerHref(params, {
    ...nextValues,
    selected: null,
    offset: null,
    after: null,
  })
}

function removeFilterHref(params: ExplorerParams, key: string) {
  if (key === "period") {
    return buildExplorerHref(params, {
      periodFrom: null,
      periodTo: null,
      ...resetSelectionAndPagination,
    })
  }

  if (key === "itemValueRange") {
    return buildExplorerHref(params, {
      minItemValue: null,
      maxItemValue: null,
      ...resetSelectionAndPagination,
    })
  }

  if (key === "declarationFobRange") {
    return buildExplorerHref(params, {
      minDeclarationFob: null,
      maxDeclarationFob: null,
      ...resetSelectionAndPagination,
    })
  }

  if (key === "quantityRange") {
    return buildExplorerHref(params, {
      minQuantity: null,
      maxQuantity: null,
      ...resetSelectionAndPagination,
    })
  }

  if (key === "grossWeightItemRange") {
    return buildExplorerHref(params, {
      minGrossWeightItem: null,
      maxGrossWeightItem: null,
      ...resetSelectionAndPagination,
    })
  }

  if (key === "grossWeightTotalRange") {
    return buildExplorerHref(params, {
      minGrossWeightTotal: null,
      maxGrossWeightTotal: null,
      ...resetSelectionAndPagination,
    })
  }

  if (key === "logisticsParty") {
    return buildExplorerHref(params, {
      logisticsParty: null,
      logisticsRole: null,
      ...resetSelectionAndPagination,
    })
  }

  return buildExplorerHref(params, { [key]: null, ...resetSelectionAndPagination })
}

function resetExplorerHref() {
  return "/explorer"
}

function sortLabel(value: string) {
  return formatTradeRecordSortLabel(value) ?? value
}

function logisticsRoleLabel(value: string | undefined) {
  if (value === "issuer") return "Emisor documento transporte"
  if (value === "carrier") return "Compañía de transporte"
  return "Entidad logística"
}

function periodLabel(record: Pick<ExplorerRecord, "periodYear" | "periodMonth">) {
  return formatTradeRecordPeriodValue(record.periodYear, record.periodMonth)
}

function itemValue(record: ExplorerRecord) {
  const currencyLabel = formatTradeCurrencyLabel(record.decodedLabels.currency) ?? "Valor"

  if (record.tradeFlow === "export") {
    return {
      label: `${currencyLabel} FOB`,
      value: formatTradeMoneyAmount(record.itemFobValue, record.decodedLabels.currency),
    }
  }

  return {
    label: `${currencyLabel} CIF`,
    value: formatTradeMoneyAmount(record.itemCifValue, record.decodedLabels.currency),
  }
}

function formatWeightDisplay(value: string | null) {
  return formatTradeDecimal(value, 2, "No informado")
}

function formatKnownCodeLabel(
  code: string | null,
  label: string | undefined,
  missingLabel: string,
  kind: TradeDisplayCodeKind = "generic"
) {
  if (!code && !label) {
    return "No informado"
  }

  return formatTradeDisplayCodeLabel({
    code,
    fallback: code ? `Código ${code}` : missingLabel,
    kind,
    label,
  })
}

function customsOfficeForRecord(record: ExplorerRecord) {
  return formatKnownCodeLabel(
    record.customsOfficeCode,
    record.decodedLabels.customsOffice,
    "aduana sin etiqueta",
    "customsOffice"
  )
}

function transportModeForRecord(record: ExplorerRecord) {
  return formatKnownCodeLabel(
    record.transportModeCode,
    record.decodedLabels.transportMode,
    "vía sin etiqueta",
    "transportMode"
  )
}

function countryForFlow(record: ExplorerRecord) {
  if (record.tradeFlow === "export") {
    return formatKnownCodeLabel(
      record.destinationCountryCode,
      record.decodedLabels.destinationCountry,
      "país sin etiqueta",
      "country"
    )
  }

  return formatKnownCodeLabel(
    record.originCountryCode,
    record.decodedLabels.originCountry,
    "país sin etiqueta",
    "country"
  )
}

function portForFlow(record: ExplorerRecord) {
  if (record.tradeFlow === "export") {
    return {
      label: "Puerto de embarque",
      value: formatKnownCodeLabel(
        record.embarkPortCode,
        record.decodedLabels.embarkPort,
        "puerto sin etiqueta",
        "port"
      ),
    }
  }

  return {
    label: "Puerto de desembarque",
    value: formatKnownCodeLabel(
      record.disembarkPortCode,
      record.decodedLabels.disembarkPort,
      "puerto sin etiqueta",
      "port"
    ),
  }
}

function sourceFileDisplayName(record: ExplorerRecord) {
  const filename = sourceFilenameLabel(record.sourceFilename) ?? record.sourceFilename
  return filename?.trim() || "Archivo fuente no informado"
}

function participantForFlow(record: ExplorerRecord) {
  if (record.tradeFlow === "export") {
    return {
      label: "Exportador",
      helper: "ID Aduana",
      profileRole: "exporter" as const,
      value:
        record.exporterPrimaryCorrelativeId ??
        record.exporterSecondaryCorrelativeId ??
        null,
    }
  }

  return {
    label: "Importador",
    helper: "ID Aduana",
    profileRole: "importer" as const,
    value: record.importerCorrelativeId,
  }
}

function sourceIntegrityState(record: ExplorerRecord) {
  const verified =
    record.importBatchStatus === "completed" &&
    record.payloadReconstructable &&
    Boolean(record.sourceFileId && record.importBatchId && record.rawTradeRowId)

  return verified
    ? {
        variant: "verified" as const,
        label: "Fuente verificada",
      }
    : {
        variant: "review" as const,
        label: "Trazabilidad por revisar",
      }
}

function displayFilterCodeLabel(
  options: TradeRecordFilterOption[],
  code: string,
  kind?: TradeDisplayCodeKind
) {
  const option = options.find((candidate) => candidate.value === code)
  if (!kind) {
    return option?.label ?? code
  }

  return formatTradeDisplayCodeLabel({
    code,
    fallback: code,
    kind,
    label: option?.label,
  })
}

function displayFilterCodeLabels(
  options: TradeRecordFilterOption[],
  codes: string[] | undefined,
  kind: TradeDisplayCodeKind
) {
  return codes && codes.length > 0
    ? codes.map((code) => displayFilterCodeLabel(options, code, kind)).join(", ")
    : undefined
}

function recordReviewReasons(record: ExplorerRecord) {
  const reasons: string[] = []
  const value = itemValue(record)
  const port = portForFlow(record)

  if (!record.hsCodeNormalized) reasons.push("Partida arancelaria normalizada no informada")
  if (record.originCountryCode && !record.decodedLabels.originCountry) {
    reasons.push("Código de país origen sin etiqueta")
  }
  if (record.destinationCountryCode && !record.decodedLabels.destinationCountry) {
    reasons.push("Código de país destino sin etiqueta")
  }
  if (record.customsOfficeCode && !record.decodedLabels.customsOffice) {
    reasons.push("Código de aduana sin etiqueta")
  }
  if (!record.productDescriptionRaw) reasons.push("Descripción de mercancía no informada")
  if (!participantForFlow(record).value) reasons.push(`${participantForFlow(record).label} no informado`)
  if (countryForFlow(record) === "No informado") reasons.push("País principal no informado")
  if (port.value === "No informado") reasons.push(`${port.label} no informado`)
  if (value.value === "No informado") reasons.push(`${value.label} no informado`)
  if (!record.payloadReconstructable) reasons.push("Payload no reconstruible")
  if (record.importBatchStatus !== "completed") reasons.push("Lote de importación no completado")

  // TODO: Replace this derived check with field-level parser warnings when a
  // user-facing data-quality contract exists in the service layer.
  return reasons
}

function recordQualityState(record: ExplorerRecord): {
  variant: StatusBadgeProps["variant"]
  label: string
  reasons: string[]
} {
  const reasons = recordReviewReasons(record)

  return reasons.length > 0
    ? { variant: "review", label: "Requiere revisión", reasons }
    : { variant: "verified", label: "Registro consistente", reasons }
}

function activeFilterChips(
  filters: TradeRecordSearchResponse["filters"],
  filterOptions: TradeRecordFilterOptions
) {
  const flowConfig = tradeFlowUiConfig(filters.tradeFlow)
  const chips: Array<{
    key: string
    label: string
    value: string
    variant?: "default" | "primary" | "success" | "purple" | "warning"
  }> = []

  if (filters.tradeFlow) {
    chips.push({ key: "tradeFlow", label: "Tipo de operación", value: formatTradeFlowLabel(filters.tradeFlow), variant: "primary" })
  }
  if (filters.periodFrom || filters.periodTo) {
    chips.push({
      key: "period",
      label: "Periodo",
      value: formatTradeRecordPeriodRangeLabel(filters.periodFrom, filters.periodTo) ?? "",
    })
  }
  if (filters.productQuery) chips.push({ key: "q", label: "Búsqueda", value: filters.productQuery })
  if (filters.hsCodePrefix) chips.push({ key: "hsCodePrefix", label: "Partida arancelaria", value: filters.hsCodePrefix, variant: "success" })
  if (filters.importerCorrelativeId) chips.push({ key: "importer", label: "Importador", value: `ID ${filters.importerCorrelativeId}` })
  if (filters.exporterCorrelativeId) chips.push({ key: "exporter", label: "Exportador", value: `ID ${filters.exporterCorrelativeId}` })
  const originCountryCodes = filters.originCountryCodes?.length
    ? filters.originCountryCodes
    : filters.originCountryCode
      ? [filters.originCountryCode]
      : []
  if (originCountryCodes.length > 0) {
    chips.push({
      key: "originCountry",
      label: "País origen",
      value:
        displayFilterCodeLabels(filterOptions.countries, originCountryCodes, "country") ??
        originCountryCodes.join(", "),
    })
  }
  const destinationCountryCodes = filters.destinationCountryCodes?.length
    ? filters.destinationCountryCodes
    : filters.destinationCountryCode
      ? [filters.destinationCountryCode]
      : []
  if (destinationCountryCodes.length > 0) {
    chips.push({
      key: "destinationCountry",
      label: "País destino",
      value:
        displayFilterCodeLabels(filterOptions.countries, destinationCountryCodes, "country") ??
        destinationCountryCodes.join(", "),
    })
  }
  if (filters.customsOfficeCode) {
    chips.push({
      key: "customsOffice",
      label: "Aduana",
      value: displayFilterCodeLabel(filterOptions.customsOffices, filters.customsOfficeCode, "customsOffice"),
    })
  }
  if (filters.embarkPortCode) {
    chips.push({
      key: "embarkPort",
      label: "Puerto embarque",
      value: displayFilterCodeLabel(filterOptions.ports, filters.embarkPortCode, "port"),
      variant: "purple",
    })
  }
  if (filters.disembarkPortCode) {
    chips.push({
      key: "disembarkPort",
      label: "Puerto desembarque",
      value: displayFilterCodeLabel(filterOptions.ports, filters.disembarkPortCode, "port"),
      variant: "purple",
    })
  }
  if (filters.transportModeCode) {
    chips.push({
      key: "transportMode",
      label: "Vía transporte",
      value: displayFilterCodeLabel(filterOptions.transportModes, filters.transportModeCode, "transportMode"),
    })
  }
  if (filters.cargoTypeCode) {
    chips.push({
      key: "cargoType",
      label: "Tipo de carga",
      value: displayFilterCodeLabel(filterOptions.cargoTypes, filters.cargoTypeCode, "cargoType"),
    })
  }
  if (filters.logisticsPartyId) {
    chips.push({
      key: "logisticsParty",
      label: logisticsRoleLabel(filters.logisticsRole),
      value: displayFilterCodeLabel(filterOptions.logisticsParties, filters.logisticsPartyId),
      variant: "warning",
    })
  } else if (filters.logisticsRole) {
    chips.push({
      key: "logisticsRole",
      label: "Rol logístico",
      value: logisticsRoleLabel(filters.logisticsRole),
      variant: "warning",
    })
  }
  if (filters.minItemValue || filters.maxItemValue) {
    chips.push({
      key: "itemValueRange",
      label: flowConfig.itemValueLabel,
      value: `${filters.minItemValue ?? "min"}-${filters.maxItemValue ?? "max"}`,
    })
  }
  if (filters.minDeclarationFob || filters.maxDeclarationFob) {
    chips.push({
      key: "declarationFobRange",
      label: "FOB total",
      value: `${filters.minDeclarationFob ?? "min"}-${filters.maxDeclarationFob ?? "max"}`,
    })
  }
  if (filters.minQuantity || filters.maxQuantity) {
    chips.push({
      key: "quantityRange",
      label: "Cantidad",
      value: `${filters.minQuantity ?? "min"}-${filters.maxQuantity ?? "max"}`,
    })
  }
  if (filters.minGrossWeightItem || filters.maxGrossWeightItem) {
    chips.push({
      key: "grossWeightItemRange",
      label: "Peso bruto ítem",
      value: `${filters.minGrossWeightItem ?? "min"}-${filters.maxGrossWeightItem ?? "max"}`,
    })
  }
  if (filters.minGrossWeightTotal || filters.maxGrossWeightTotal) {
    chips.push({
      key: "grossWeightTotalRange",
      label: "Peso bruto total",
      value: `${filters.minGrossWeightTotal ?? "min"}-${filters.maxGrossWeightTotal ?? "max"}`,
    })
  }
  if (filters.sort) chips.push({ key: "sort", label: "Orden", value: sortLabel(filters.sort) })

  return chips
}

function HiddenSearchFields({
  params,
  omit,
}: {
  params: ExplorerParams
  omit: string[]
}) {
  return (
    <>
      {searchableParamKeys.map((key) => {
        const value = paramText(params[key])
        if (!value || omit.includes(key)) {
          return null
        }

        return <input key={key} type="hidden" name={key} value={value} />
      })}
    </>
  )
}

function optionLabel(options: TradeRecordFilterOption[], code: string | null | undefined) {
  if (!code) {
    return undefined
  }

  return options.find((option) => option.value === code)?.label ?? code
}

function parsedPeriodParam(value: string | null | undefined) {
  const match = /^(\d{4})-(\d{2})$/.exec(value ?? "")
  if (!match) {
    return undefined
  }

  return {
    year: Number.parseInt(match[1], 10),
    month: Number.parseInt(match[2], 10),
  }
}

async function hasDevelopmentSourceSignal(
  filters: TradeRecordSearchResponse["filters"]
) {
  const conditions = []
  const from = parsedPeriodParam(filters.periodFrom)
  const to = parsedPeriodParam(filters.periodTo)
  const now = new Date()
  const currentYear = now.getUTCFullYear()
  const currentMonth = now.getUTCMonth() + 1

  if (filters.tradeFlow) {
    conditions.push(eq(sourceFiles.tradeFlow, filters.tradeFlow))
  }

  if (from) {
    conditions.push(sql`(${sourceFiles.periodYear}, ${sourceFiles.periodMonth}) >= (${from.year}, ${from.month})`)
  }

  if (to) {
    conditions.push(sql`(${sourceFiles.periodYear}, ${sourceFiles.periodMonth}) <= (${to.year}, ${to.month})`)
  }

  const developmentSignal = or(
    sql`coalesce(lower(${sourceFiles.sourceCategory}), '') in (${sql.join(
      internalSourceCategories.map((category) => sql`${category}`),
      sql`, `
    )})`,
    sql`lower(${sourceFiles.sourceSystem}) = 'duanera_test'`,
    sql`(${sourceFiles.periodYear}, ${sourceFiles.periodMonth}) > (${currentYear}, ${currentMonth})`,
    sql`lower(coalesce(${sourceFiles.originalFilename}, '') || ' ' || coalesce(${sourceFiles.normalizedRawFilename}, '') || ' ' || coalesce(${sourceFiles.normalizedWorkingFilename}, '')) like '%smoke%'`,
    sql`lower(coalesce(${sourceFiles.originalFilename}, '') || ' ' || coalesce(${sourceFiles.normalizedRawFilename}, '') || ' ' || coalesce(${sourceFiles.normalizedWorkingFilename}, '')) like '%fixture%'`,
    sql`lower(coalesce(${sourceFiles.originalFilename}, '') || ' ' || coalesce(${sourceFiles.normalizedRawFilename}, '') || ' ' || coalesce(${sourceFiles.normalizedWorkingFilename}, '')) like '%test%'`,
    sql`lower(coalesce(${sourceFiles.originalFilename}, '') || ' ' || coalesce(${sourceFiles.normalizedRawFilename}, '') || ' ' || coalesce(${sourceFiles.normalizedWorkingFilename}, '')) like '%dummy%'`
  )

  const rows = await db
    .select({ id: sourceFiles.id })
    .from(sourceFiles)
    .where(and(...conditions, developmentSignal))
    .limit(1)

  return rows.length > 0
}

function summaryMetricValue(
  value: string | number | null | undefined,
  suffix?: string,
  fractionDigits = 2
) {
  if (typeof value === "number") {
    return formatTradeDecimal(value, 0, "0")
  }

  return formatTradeSummaryValue(value ?? null, suffix, fractionDigits, "No informado")
}

function ExplorerSummaryMetric({
  label,
  note,
  value,
}: {
  label: string
  note?: string
  value: string
}) {
  return (
    <div className="min-w-0 border-r border-ds-border-soft px-2.5 py-1.5 last:border-r-0">
      <div className="text-ds-xs font-medium text-ds-text-muted">{label}</div>
      <div className="mt-0.5 break-words text-ds-sm font-semibold leading-(--ds-leading-tight) tabular-nums text-ds-text-primary">
        {value}
      </div>
      {note ? <div className="mt-0.5 text-ds-xs leading-(--ds-leading-tight) text-ds-text-muted">{note}</div> : null}
    </div>
  )
}

function ExplorerResultsSummary({
  filterOptions,
  result,
}: {
  filterOptions: TradeRecordFilterOptions
  result: TradeRecordSearchResponse
}) {
  const isSummaryBounded = result.summary.status === "bounded"
  const currency = optionLabel(filterOptions.currencies, result.summary.totals.currencyCode)
  const quantityUnit = optionLabel(
    filterOptions.quantityUnits,
    result.summary.totals.quantityUnitCode
  )
  const currencyLabel = formatTradeCurrencyLabel(currency)
  const valueSuffix = result.summary.totals.currencyIsMixed ? "moneda mixta" : undefined
  const quantityValue = result.summary.totals.quantityUnitIsMixed
    ? "Unidades mixtas"
    : formatTradeQuantityDisplay(
        result.summary.totals.quantity,
        result.summary.totals.quantityUnitCode,
        quantityUnit
      )
  const itemValueLabel =
    result.filters.tradeFlow === "export"
      ? `${currencyLabel ?? "Valor"} FOB`
      : `${currencyLabel ?? "Valor"} CIF`
  const declarationFobLabel = currencyLabel ? `${currencyLabel} FOB total` : "FOB total"
  const anonymousIdLabel =
    result.filters.tradeFlow === "export" ? "Exportadores" : "Importadores"
  const isExportFlow = result.filters.tradeFlow === "export"

  if (isSummaryBounded) {
    return (
      <section
        aria-label="Resumen del resultado"
        className="overflow-hidden rounded-ds-md border border-ds-border-soft bg-ds-surface/80"
      >
        <div className="grid grid-cols-1 divide-y divide-ds-border-soft sm:grid-cols-[minmax(10rem,14rem)_1fr] sm:divide-x sm:divide-y-0">
          <ExplorerSummaryMetric
            label="Registros"
            value={summaryMetricValue(result.summary.totals.records)}
          />
          <div className="px-3 py-2 text-ds-xs leading-(--ds-leading-normal) text-ds-text-muted">
            Resumen acotado para una búsqueda amplia. Agrega filtros comerciales,
            geográficos o logísticos, o revisa un solo período, para ver valores y
            desgloses completos.
          </div>
        </div>
      </section>
    )
  }

  return (
    <section
      aria-label="Resumen del resultado"
      className="overflow-hidden rounded-ds-md border border-ds-border-soft bg-ds-surface/80"
    >
      <div className="grid grid-cols-2 divide-y divide-ds-border-soft sm:grid-cols-4 lg:grid-cols-8 lg:divide-y-0">
        <ExplorerSummaryMetric
          label="Registros"
          value={summaryMetricValue(result.summary.totals.records)}
        />
        <ExplorerSummaryMetric
          label={itemValueLabel}
          note={result.summary.totals.currencyIsMixed ? "Monedas mixtas" : undefined}
          value={summaryMetricValue(result.summary.totals.itemValue, valueSuffix)}
        />
        <ExplorerSummaryMetric
          label={declarationFobLabel}
          value={summaryMetricValue(result.summary.totals.declarationFobValue, valueSuffix)}
        />
        <ExplorerSummaryMetric
          label="Operaciones"
          note="Declaraciones únicas"
          value={summaryMetricValue(result.summary.totals.operations)}
        />
        <ExplorerSummaryMetric
          label={anonymousIdLabel}
          note="IDs Aduana anónimos"
          value={summaryMetricValue(result.summary.totals.anonymousParticipants)}
        />
        <ExplorerSummaryMetric label="Cantidad" value={quantityValue} />
        {isExportFlow ? (
          <ExplorerSummaryMetric
            label="Peso bruto ítem"
            value={summaryMetricValue(result.summary.totals.grossWeightItem)}
          />
        ) : null}
        <ExplorerSummaryMetric
          label="Peso bruto total"
          value={summaryMetricValue(result.summary.totals.grossWeightTotal)}
        />
      </div>
    </section>
  )
}

type ExplorerRank = TradeRecordSearchResponse["summary"]["rankings"]["hsCodes"][number]
type ExplorerRankingId = "hs" | "countries" | "participants" | "ports" | "transport"

const explorerRankingIds = new Set<ExplorerRankingId>([
  "hs",
  "countries",
  "participants",
  "ports",
  "transport",
])

function parseExplorerRanking(value: string | string[] | undefined): ExplorerRankingId {
  const first = firstValue(value)
  return first && explorerRankingIds.has(first as ExplorerRankingId)
    ? (first as ExplorerRankingId)
    : "hs"
}

function ExplorerRankingList({
  emptyLabel = "Sin datos",
  hrefFor,
  items,
  labelFor,
  valueSuffix,
}: {
  emptyLabel?: string
  hrefFor: (item: ExplorerRank) => string
  items: ExplorerRank[]
  labelFor: (item: ExplorerRank) => string
  valueSuffix?: string
}) {
  const maxValue = Math.max(...items.map((item) => Number(item.totalItemValue ?? 0)), 0)

  return (
    <div className="grid min-w-0 overflow-hidden rounded-ds-md border border-ds-border-soft bg-ds-surface sm:grid-cols-2 lg:grid-cols-5">
        {items.length === 0 ? (
          <div className="px-3 py-3 text-ds-xs text-ds-text-muted sm:col-span-2 lg:col-span-5">
            {emptyLabel}
          </div>
        ) : (
          items.map((item) => {
            const numericValue = Number(item.totalItemValue ?? 0)
            const width = maxValue > 0 ? Math.max(6, (numericValue / maxValue) * 100) : 0

            return (
              <Link
                key={item.code}
                className="group grid gap-1 border-b border-r border-ds-border-soft px-3 py-2 last:border-r-0 hover:bg-ds-primary-softer/40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ds-focus-ring/20 sm:[&:nth-child(2n)]:border-r-0 lg:[&:nth-child(2n)]:border-r lg:[&:nth-child(5n)]:border-r-0"
                href={hrefFor(item)}
              >
                <div className="flex min-w-0 items-center justify-between gap-3">
                  <span className="truncate text-ds-sm font-semibold text-ds-text-primary group-hover:text-ds-primary">
                    {labelFor(item)}
                  </span>
                  <span className="shrink-0 text-ds-xs tabular-nums text-ds-text-muted">
                    {formatTradeDecimal(item.records, 0)} reg.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ds-subtle">
                    <span
                      className="block h-full rounded-full bg-ds-primary/70"
                      style={{ width: `${width}%` }}
                    />
                  </span>
                  <span className="w-24 text-right text-ds-xs tabular-nums text-ds-text-secondary">
                    {formatTradeSummaryValue(item.totalItemValue, valueSuffix, 1, "—")}
                  </span>
                </div>
              </Link>
            )
          })
        )}
    </div>
  )
}

function ExplorerRankingModule({
  activeRanking,
  filterOptions,
  params,
  result,
}: {
  activeRanking: ExplorerRankingId
  filterOptions: TradeRecordFilterOptions
  params: ExplorerParams
  result: TradeRecordSearchResponse
}) {
  const currency = optionLabel(filterOptions.currencies, result.summary.totals.currencyCode)
  const valueSuffix = result.summary.totals.currencyIsMixed ? "moneda mixta" : currency
  const flow = result.filters.tradeFlow
  const rankingConfig = {
    hs: {
      label: "Partidas arancelarias",
      description: "Partidas con más registros y valor en el resultado filtrado.",
      items: result.summary.rankings.hsCodes,
      hrefFor: (item: ExplorerRank) => explorerRankingHref(params, { hsCodePrefix: item.code }),
      labelFor: (item: ExplorerRank) => `Partida ${item.code}`,
    },
    countries: {
      label: flow === "export" ? "Países destino" : "Países origen",
      description: "Mercados principales dentro del resultado filtrado.",
      items: result.summary.rankings.countries,
      hrefFor: (item: ExplorerRank) =>
        explorerRankingHref(params, {
          originCountry: flow === "export" ? null : item.code,
          destinationCountry: flow === "export" ? item.code : null,
        }),
      labelFor: (item: ExplorerRank) =>
        formatTradeDisplayCodeLabel({
          code: item.code,
          fallback: item.code,
          kind: "country",
          label: optionLabel(filterOptions.countries, item.code) ?? item.labelRaw ?? undefined,
        }),
    },
    participants: {
      label: flow === "export" ? "Exportadores" : "Importadores",
      description: "Códigos Aduana anónimos; no son nombres legales ni RUTs.",
      items: result.summary.rankings.participants,
      hrefFor: (item: ExplorerRank) =>
        explorerRankingHref(params, {
          importer: flow === "export" ? null : item.code,
          exporter: flow === "export" ? item.code : null,
        }),
      labelFor: (item: ExplorerRank) => item.code,
    },
    ports: {
      label: flow === "export" ? "Puertos de embarque" : "Puertos de desembarque",
      description: "Puertos relevantes dentro del resultado filtrado.",
      items: result.summary.rankings.ports,
      hrefFor: (item: ExplorerRank) =>
        explorerRankingHref(params, {
          embarkPort: flow === "export" ? item.code : null,
          disembarkPort: flow === "export" ? null : item.code,
        }),
      labelFor: (item: ExplorerRank) =>
        formatTradeDisplayCodeLabel({
          code: item.code,
          fallback: item.code,
          kind: "port",
          label: optionLabel(filterOptions.ports, item.code) ?? item.labelRaw ?? undefined,
        }),
    },
    transport: {
      label: "Vía de transporte",
      description: "Vías de transporte presentes en el resultado filtrado.",
      items: result.summary.rankings.transportModes,
      hrefFor: (item: ExplorerRank) =>
        explorerRankingHref(params, { transportMode: item.code }),
      labelFor: (item: ExplorerRank) =>
        formatTradeDisplayCodeLabel({
          code: item.code,
          fallback: item.code,
          kind: "transportMode",
          label: optionLabel(filterOptions.transportModes, item.code),
        }),
    },
  } satisfies Record<
    ExplorerRankingId,
    {
      label: string
      description: string
      items: ExplorerRank[]
      hrefFor: (item: ExplorerRank) => string
      labelFor: (item: ExplorerRank) => string
    }
  >
  const active = rankingConfig[activeRanking]

  if (result.summary.status === "bounded") {
    return (
      <section
        aria-label="Desglose del resultado"
        className="rounded-ds-md border border-ds-border-soft bg-ds-surface"
      >
        <div className="px-4 py-3">
          <h2 className="text-ds-sm font-bold text-ds-text-primary">Desglose del resultado</h2>
          <p className="mt-1 max-w-3xl text-ds-xs leading-(--ds-leading-normal) text-ds-text-muted">
            Los rankings se acotaron para esta búsqueda amplia. Aplica una partida,
            país, puerto, aduana, transporte o rango comercial para comparar grupos
            con totales completos.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section
      aria-label="Desglose del resultado"
      className="rounded-ds-md border border-ds-border-soft bg-ds-surface"
    >
      <div className="flex flex-col gap-3 border-b border-ds-border-soft px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-ds-sm font-bold text-ds-text-primary">Desglose del resultado</h2>
          <p className="mt-0.5 text-ds-xs text-ds-text-muted">{active.description}</p>
        </div>
        <nav
          aria-label="Cambiar desglose"
          className="flex max-w-full flex-wrap gap-1 rounded-ds-md border border-ds-border-soft bg-ds-subtle p-1"
        >
          {(Object.keys(rankingConfig) as ExplorerRankingId[]).map((id) => {
            const selected = id === activeRanking

            return (
              <Link
                key={id}
                aria-current={selected ? "page" : undefined}
                className={cn(
                  "inline-flex h-7 items-center rounded-ds-sm px-2.5 text-ds-xs font-semibold transition-colors",
                  selected
                    ? "bg-ds-surface text-ds-text-primary shadow-ds-xs"
                    : "text-ds-text-muted hover:bg-ds-surface/80 hover:text-ds-text-primary"
                )}
                href={buildExplorerHref(params, {
                  ranking: id,
                  selected: null,
                  offset: null,
                  after: null,
                })}
              >
                {rankingConfig[id].label}
              </Link>
            )
          })}
        </nav>
      </div>
      <ExplorerRankingList
        items={active.items}
        valueSuffix={valueSuffix}
        hrefFor={active.hrefFor}
        labelFor={active.labelFor}
      />
    </section>
  )
}

function explorerValueHeader(flow: string) {
  return flow === "export" ? "US$ FOB" : "US$ CIF"
}

type ExplorerTableColumnKey =
  | "date"
  | "operation"
  | "hs"
  | "product"
  | "participant"
  | "country"
  | "originCountry"
  | "acquisitionCountry"
  | "consignmentCountry"
  | "destinationCountry"
  | "customs"
  | "port"
  | "embarkPort"
  | "disembarkPort"
  | "transport"
  | "cargo"
  | "itemValue"
  | "declarationFob"
  | "freight"
  | "insurance"
  | "cif"
  | "unitPrice"
  | "quantity"
  | "unit"
  | "grossWeightItem"
  | "grossWeightTotal"
  | "source"
  | "sourceFile"
  | "rawRow"
  | "batch"
  | "parser"
  | "payload"
  | "declaration"
  | "itemNumber"
  | "productReference"
  | "productDetails"

type ExplorerTableColumn = {
  key: ExplorerTableColumnKey
  help: string
  label: string
  numeric?: boolean
  sort?: {
    asc: TradeRecordSort
    desc: TradeRecordSort
  }
  tooltipAlign?: "center" | "end" | "start"
  width: number
}

function explorerValueColumn(flow: string, width = 112): ExplorerTableColumn {
  return {
    key: "itemValue",
    label: explorerValueHeader(flow),
    help:
      flow === "export"
        ? "Valor FOB declarado para el ítem, sin flete ni seguro internacional."
        : "Valor CIF declarado para el ítem, incluyendo costo, seguro y flete.",
    numeric: true,
    sort: {
      asc: "item_value_asc",
      desc: "item_value_desc",
    },
    width,
  }
}

function explorerParticipantColumn(flow: string): ExplorerTableColumn {
  return {
    key: "participant",
    label: flow === "export" ? "ID exportador" : "ID importador",
    help:
      flow === "export"
        ? "Identificador anónimo de Aduana para el exportador. No es nombre legal ni RUT."
        : "Identificador anónimo de Aduana para el importador. No es nombre legal ni RUT.",
    width: 132,
  }
}

function explorerCountryColumn(flow: string): ExplorerTableColumn {
  return {
    key: "country",
    label: flow === "export" ? "País destino" : "País origen",
    help:
      flow === "export"
        ? "País declarado como destino de la exportación."
        : "País declarado como origen de la importación.",
    width: 140,
  }
}

function explorerPortColumn(flow: string): ExplorerTableColumn {
  return {
    key: "port",
    label: flow === "export" ? "Puerto embarque" : "Puerto desembarque",
    help:
      flow === "export"
        ? "Puerto donde la mercancía sale desde Chile."
        : "Puerto donde la mercancía llega a Chile.",
    width: 160,
  }
}

function explorerTableColumnsForView(
  view: TradeRecordTableViewId,
  flow: string
): ExplorerTableColumn[] {
  const mainValue = explorerValueColumn(flow)
  const flowConfig = tradeFlowUiConfig(flow)
  const grossWeightColumns: ExplorerTableColumn[] =
    flowConfig.flow === "export"
      ? [
          {
            key: "grossWeightItem",
            label: "Peso bruto ítem",
            help: "Peso bruto informado para el ítem exportado.",
            numeric: true,
            sort: {
              asc: "gross_weight_asc",
              desc: "gross_weight_desc",
            },
            width: 132,
          },
          {
            key: "grossWeightTotal",
            label: "Peso bruto total",
            help: "Peso bruto total informado para la operación.",
            numeric: true,
            sort: {
              asc: "gross_weight_asc",
              desc: "gross_weight_desc",
            },
            tooltipAlign: "end",
            width: 132,
          },
        ]
      : [
          {
            key: "grossWeightTotal",
            label: "Peso bruto total",
            help: "Peso bruto total informado para la importación.",
            numeric: true,
            sort: {
              asc: "gross_weight_asc",
              desc: "gross_weight_desc",
            },
            tooltipAlign: "end",
            width: 132,
          },
        ]
  const logisticsCountryColumns: ExplorerTableColumn[] =
    flowConfig.flow === "export"
      ? [
          {
            key: "destinationCountry",
            label: "País destino",
            help: "País declarado como destino de la exportación.",
            width: 144,
          },
        ]
      : [
          {
            key: "originCountry",
            label: "País origen",
            help: "País declarado como origen de la mercancía importada.",
            width: 148,
          },
          {
            key: "acquisitionCountry",
            label: "País adquisición",
            help: "País donde se adquirió la mercancía cuando Aduana lo informa.",
            width: 156,
          },
          {
            key: "consignmentCountry",
            label: "País consignación",
            help: "País de consignación informado en la declaración.",
            width: 156,
          },
        ]
  const logisticsPortColumns: ExplorerTableColumn[] =
    flowConfig.flow === "export"
      ? [
          {
            key: "embarkPort",
            label: "Puerto embarque",
            help: "Puerto donde la mercancía sale desde Chile.",
            width: 156,
          },
          {
            key: "disembarkPort",
            label: "Puerto desembarque destino",
            help: "Puerto de desembarque informado como contexto logístico de destino.",
            width: 188,
          },
        ]
      : [
          {
            key: "disembarkPort",
            label: "Puerto desembarque",
            help: "Puerto donde la mercancía llega a Chile.",
            width: 168,
          },
          {
            key: "embarkPort",
            label: "Puerto embarque ruta",
            help: "Puerto extranjero donde se embarcó la mercancía.",
            width: 168,
          },
        ]

  const columns: Record<TradeRecordTableViewId, ExplorerTableColumn[]> = {
    commercial: [
      {
        key: "date",
        label: "Fecha",
        help: "Fecha de aceptación de la declaración aduanera.",
        tooltipAlign: "start",
        width: 128,
      },
      {
        key: "hs",
        label: "Partida arancelaria",
        help: "Código arancelario/HS usado para clasificar el producto.",
        tooltipAlign: "start",
        width: 160,
      },
      {
        key: "product",
        label: "Producto",
        help: "Nombre legible del producto, con descriptor o referencia fuente cuando existe.",
        width: 300,
      },
      explorerParticipantColumn(flow),
      explorerCountryColumn(flow),
      {
        key: "customs",
        label: "Aduana",
        help: "Oficina de Aduana que procesó la declaración.",
        width: 132,
      },
      explorerPortColumn(flow),
      mainValue,
      {
        key: "quantity",
        label: "Cantidad",
        help: "Cantidad declarada con su unidad. Cuando dice kg, corresponde a kilogramos netos.",
        numeric: true,
        sort: {
          asc: "quantity_asc",
          desc: "quantity_desc",
        },
        tooltipAlign: "end",
        width: 136,
      },
    ],
    values: [
      {
        key: "date",
        label: "Fecha",
        help: "Fecha de aceptación de la declaración aduanera.",
        tooltipAlign: "start",
        width: 112,
      },
      {
        key: "product",
        label: "Producto",
        help: "Nombre legible del producto, con descriptor o referencia fuente cuando existe.",
        width: 360,
      },
      mainValue,
      {
        key: "declarationFob",
        label: "US$ FOB total",
        help: "Valor FOB total declarado para la operación.",
        numeric: true,
        sort: {
          asc: "declaration_fob_asc",
          desc: "declaration_fob_desc",
        },
        width: 128,
      },
      {
        key: "freight",
        label: "US$ flete",
        help: "Costo de flete declarado cuando está disponible.",
        numeric: true,
        width: 112,
      },
      {
        key: "insurance",
        label: "US$ seguro",
        help: "Costo de seguro declarado cuando está disponible.",
        numeric: true,
        width: 116,
      },
      {
        key: "cif",
        label: "US$ CIF total",
        help: "Valor CIF total declarado para la operación.",
        numeric: true,
        width: 128,
      },
      {
        key: "unitPrice",
        label: "US$ unitario",
        help: "Precio unitario calculado o declarado cuando está disponible.",
        numeric: true,
        width: 122,
      },
      {
        key: "quantity",
        label: "Cantidad",
        help: "Cantidad declarada con su unidad. Cuando dice kg, corresponde a kilogramos netos.",
        numeric: true,
        sort: {
          asc: "quantity_asc",
          desc: "quantity_desc",
        },
        width: 136,
      },
      ...grossWeightColumns,
    ],
    logistics: [
      {
        key: "date",
        label: "Fecha",
        help: "Fecha de aceptación de la declaración aduanera.",
        tooltipAlign: "start",
        width: 112,
      },
      {
        key: "product",
        label: "Producto",
        help: "Nombre legible del producto, con descriptor o referencia fuente cuando existe.",
        width: 320,
      },
      ...logisticsCountryColumns,
      {
        key: "customs",
        label: "Aduana",
        help: "Oficina de Aduana que procesó la declaración.",
        width: 132,
      },
      ...logisticsPortColumns,
      {
        key: "transport",
        label: "Vía transporte",
        help: "Modo de transporte declarado, como marítimo, aéreo o terrestre.",
        width: 144,
      },
      {
        key: "cargo",
        label: "Tipo carga",
        help: "Tipo de carga declarado por Aduana.",
        tooltipAlign: "end",
        width: 128,
      },
    ],
    product: [
      {
        key: "date",
        label: "Fecha",
        help: "Fecha de aceptación de la declaración aduanera.",
        tooltipAlign: "start",
        width: 112,
      },
      {
        key: "hs",
        label: "Partida arancelaria",
        help: "Código arancelario/HS usado para clasificar el producto.",
        width: 160,
      },
      {
        key: "product",
        label: "Producto",
        help: "Nombre legible del producto, con descriptor o referencia fuente cuando existe.",
        width: 340,
      },
      {
        key: "productReference",
        label: "Ref. producto",
        help: "Referencia, marca o código de producto tomado de la descripción fuente cuando existe.",
        width: 168,
      },
      {
        key: "productDetails",
        label: "Descripción fuente",
        help: "Texto descriptivo de Aduana mostrado en formato legible, sin cambiar el dato raw.",
        width: 360,
      },
      {
        key: "quantity",
        label: "Cantidad",
        help: "Cantidad declarada con su unidad. Cuando dice kg, corresponde a kilogramos netos.",
        numeric: true,
        sort: {
          asc: "quantity_asc",
          desc: "quantity_desc",
        },
        width: 136,
      },
      {
        key: "unit",
        label: "Unidad",
        help: "Unidad de medida declarada para la cantidad.",
        width: 104,
      },
      mainValue,
      explorerCountryColumn(flow),
    ],
    provenance: [
      {
        key: "sourceFile",
        label: "Archivo fuente",
        help: "Archivo de origen usado para cargar el registro.",
        tooltipAlign: "start",
        width: 240,
      },
      {
        key: "rawRow",
        label: "Fila",
        help: "Número de fila dentro del archivo fuente.",
        numeric: true,
        width: 84,
      },
      {
        key: "batch",
        label: "Lote",
        help: "Lote de importación que procesó el archivo.",
        width: 180,
      },
      {
        key: "parser",
        label: "Parser",
        help: "Nombre y versión del parser que transformó la fila fuente.",
        width: 176,
      },
      {
        key: "payload",
        label: "Payload",
        help: "Estado de retención y reconstrucción del dato fuente.",
        width: 160,
      },
      {
        key: "declaration",
        label: "Declaración",
        help: "Identificador de declaración informado por la fuente cuando existe.",
        width: 152,
      },
      {
        key: "itemNumber",
        label: "Ítem",
        help: "Número de ítem dentro de la declaración.",
        numeric: true,
        width: 84,
      },
      {
        key: "operation",
        label: "Operación",
        help: "Tipo de operación: importación o exportación.",
        width: 112,
      },
      {
        key: "product",
        label: "Producto",
        help: "Nombre legible del producto para ubicar el registro.",
        tooltipAlign: "end",
        width: 340,
      },
    ],
  }

  return columns[view]
}

function CountryLabel({
  countryCode,
  value,
}: {
  countryCode?: string | null
  value: string
}) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <CountryFlag countryCode={countryCode} countryName={value} />
      <span className="truncate">{value}</span>
    </span>
  )
}

function formatQuantityForRecord(record: ExplorerRecord) {
  return formatTradeQuantityDisplay(
    record.quantity,
    record.quantityUnitCode,
    record.decodedLabels.quantityUnit,
    "No informado",
    { compactNetWeightUnit: true }
  )
}

function valueCell(
  value: string | null,
  record: ExplorerRecord,
  fallback = "No informado"
) {
  return formatTradeMoneyAmount(value, record.decodedLabels.currency, { fallback }) || fallback
}

function productReferenceForRecord(record: ExplorerRecord) {
  return productDisplayFromRaw(record.productDescriptionRaw).sourceReference ?? "No informado"
}

function productDetailsForRecord(record: ExplorerRecord) {
  const product = productDisplayFromRaw(record.productDescriptionRaw)
  return product.description ?? "No informado"
}

function productMetaForRecord(record: ExplorerRecord, hsCode: string) {
  const product = productDisplayFromRaw(record.productDescriptionRaw)
  const attributes = productAttributeDisplayFromRaw(record.productAttributes)
  const parts = [
    attributes.descriptor,
    product.sourceReference ? `Ref. fuente: ${product.sourceReference}` : null,
  ].filter(Boolean)

  return parts.length > 0 ? parts.join(" · ") : `Partida ${hsCode}`
}

function explorerPaginationLabel(
  pagination: TradeRecordSearchResponse["pagination"],
  visibleRows: number,
  hasCursorAfter: boolean
) {
  if (visibleRows === 0) {
    return `0 de ${pagination.total.toLocaleString("es-CL")} registros`
  }

  if (hasCursorAfter) {
    return `Mostrando ${visibleRows.toLocaleString("es-CL")} registros de ${pagination.total.toLocaleString("es-CL")}`
  }

  const start = pagination.offset + 1
  const end = pagination.offset + visibleRows

  return `Mostrando ${start.toLocaleString("es-CL")}-${end.toLocaleString("es-CL")} de ${pagination.total.toLocaleString("es-CL")}`
}

const explorerPageSizeOptions = [25, 50, 100] as const

function explorerPageSizeHref(params: ExplorerParams, limit: number) {
  return buildExplorerHref(params, {
    limit: String(limit),
    ...resetSelectionAndPagination,
  })
}

function nextSortForColumn(
  column: ExplorerTableColumn,
  currentSort: string | null | undefined
) {
  if (!column.sort) {
    return undefined
  }

  if (currentSort === column.sort.desc) {
    return column.sort.asc
  }

  if (currentSort === column.sort.asc) {
    return "source"
  }

  return column.sort.desc
}

function explorerSortHref(
  params: ExplorerParams,
  column: ExplorerTableColumn,
  currentSort: string | null | undefined
) {
  const nextSort = nextSortForColumn(column, currentSort)

  if (!nextSort) {
    return undefined
  }

  return buildExplorerHref(params, {
    sort: nextSort === "source" ? null : nextSort,
    ...resetSelectionAndPagination,
  })
}

function explorerColumnSortDirection(
  column: ExplorerTableColumn,
  currentSort: string | null | undefined
) {
  if (!column.sort) {
    return undefined
  }

  if (currentSort === column.sort.asc) {
    return "ascending" as const
  }

  if (currentSort === column.sort.desc) {
    return "descending" as const
  }

  return undefined
}

function ExplorerTableHeaderLabel({
  column,
  currentSort,
  params,
}: {
  column: ExplorerTableColumn
  currentSort?: string
  params: ExplorerParams
}) {
  const sortHref = explorerSortHref(params, column, currentSort)
  const sortDirection = explorerColumnSortDirection(column, currentSort)
  const sortLabel =
    sortDirection === "ascending"
      ? "Orden ascendente"
      : sortDirection === "descending"
        ? "Orden descendente"
        : "Ordenar"

  return (
    <span
      className={cn(
        "flex min-w-0 items-center gap-1.5",
        column.numeric ? "justify-end" : "justify-start"
      )}
    >
      {sortHref ? (
        <Link
          aria-label={`${sortLabel} por ${column.label}`}
          className={cn(
            "inline-flex min-w-0 items-center gap-1 rounded-ds-xs underline-offset-4 hover:text-ds-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-focus-ring/25",
            sortDirection ? "text-ds-primary" : "text-inherit"
          )}
          href={sortHref}
        >
          <span className="truncate">{column.label}</span>
          {sortDirection === "ascending" ? (
            <ArrowUpIcon aria-hidden="true" className="size-3 shrink-0" />
          ) : (
            <ArrowDownIcon
              aria-hidden="true"
              className={cn(
                "size-3 shrink-0",
                sortDirection === "descending" ? undefined : "opacity-35"
              )}
            />
          )}
        </Link>
      ) : (
        <span className="truncate">{column.label}</span>
      )}
      <ExplorerColumnHelp
        align={column.tooltipAlign}
        help={column.help}
        label={column.label}
      />
    </span>
  )
}

function ExplorerTableViewNav({
  params,
  view,
}: {
  params: ExplorerParams
  view: TradeRecordTableViewId
}) {
  return (
    <nav
      aria-label="Cambiar vista de tabla"
      className="flex max-w-full flex-wrap gap-0.5 rounded-ds-md border border-ds-border-soft bg-ds-surface p-0.5"
    >
      {tradeRecordTableViews.map((option) => {
        const active = option.id === view

        return (
          <Link
            key={option.id}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-7 items-center rounded-ds-sm px-2 text-ds-xs font-semibold transition-colors",
              active
                ? "bg-ds-subtle text-ds-text-primary shadow-ds-xs"
                : "text-ds-text-muted hover:bg-ds-subtle hover:text-ds-text-primary"
            )}
            href={explorerViewHref(params, option.id)}
          >
            {option.shortLabel}
          </Link>
        )
      })}
    </nav>
  )
}

function explorerTableCells(record: ExplorerRecord) {
  const product = productDisplayFromRaw(record.productDescriptionRaw)
  const participant = participantForFlow(record)
  const item = itemValue(record)
  const port = portForFlow(record)
  const sourceState = sourceIntegrityState(record)
  const sourceName = sourceFileDisplayName(record)
  const hsCode = record.hsCodeNormalized ?? record.hsCodeRaw ?? "No informado"

  const cells = {
    date: (
      <DataTableCell key="date">
        <span className="block truncate font-medium">
          {record.acceptanceDate ?? `Periodo ${periodLabel(record)}`}
        </span>
      </DataTableCell>
    ),
    operation: <DataTableCell key="operation">{formatTradeFlowLabel(record.tradeFlow)}</DataTableCell>,
    hs: (
      <DataTableCell key="hs">
        <span className="font-mono">{hsCode}</span>
      </DataTableCell>
    ),
    product: (
      <DataTableCell key="product" className="max-w-[460px]">
        <div className="line-clamp-1 font-semibold leading-(--ds-leading-tight) text-ds-text-primary">
          {product.title}
        </div>
        <div className="mt-0.5 truncate text-ds-xs text-ds-text-muted">
          {productMetaForRecord(record, hsCode)}
        </div>
      </DataTableCell>
    ),
    participant: (
      <DataTableCell key="participant" className="max-w-24">
        {participant.value ? (
          <Link
            className="block truncate font-mono text-ds-xs font-semibold text-ds-text-primary underline-offset-4 hover:text-ds-primary hover:underline"
            href={buildTradeParticipantProfileHref(
              participant.profileRole,
              participant.value
            )}
          >
            {participant.value}
          </Link>
        ) : (
          <div className="truncate font-mono text-ds-xs">No informado</div>
        )}
        <div className="mt-0.5 truncate text-ds-xs text-ds-text-muted">
          {participant.helper}
        </div>
      </DataTableCell>
    ),
    country: (
      <DataTableCell key="country" className="max-w-28">
        <CountryLabel
          countryCode={
            record.tradeFlow === "export"
              ? record.destinationCountryCode
              : record.originCountryCode
          }
          value={countryForFlow(record)}
        />
      </DataTableCell>
    ),
    originCountry: (
      <DataTableCell key="originCountry" className="max-w-[190px]">
        <CountryLabel
          countryCode={record.originCountryCode}
          value={formatKnownCodeLabel(record.originCountryCode, record.decodedLabels.originCountry, "país sin etiqueta", "country")}
        />
      </DataTableCell>
    ),
    acquisitionCountry: (
      <DataTableCell key="acquisitionCountry" className="max-w-[190px]">
        <CountryLabel
          countryCode={record.acquisitionCountryCode}
          value={formatKnownCodeLabel(record.acquisitionCountryCode, record.decodedLabels.acquisitionCountry, "país sin etiqueta", "country")}
        />
      </DataTableCell>
    ),
    consignmentCountry: (
      <DataTableCell key="consignmentCountry" className="max-w-[190px]">
        <CountryLabel
          countryCode={record.consignmentCountryCode}
          value={formatKnownCodeLabel(record.consignmentCountryCode, record.decodedLabels.consignmentCountry, "país sin etiqueta", "country")}
        />
      </DataTableCell>
    ),
    destinationCountry: (
      <DataTableCell key="destinationCountry" className="max-w-[190px]">
        <CountryLabel
          countryCode={record.destinationCountryCode}
          value={formatKnownCodeLabel(record.destinationCountryCode, record.decodedLabels.destinationCountry, "país sin etiqueta", "country")}
        />
      </DataTableCell>
    ),
    customs: (
      <DataTableCell key="customs" className="max-w-28">
        <div className="truncate">{customsOfficeForRecord(record)}</div>
      </DataTableCell>
    ),
    port: (
      <DataTableCell key="port" className="max-w-28">
        <div className="truncate">{port.value}</div>
      </DataTableCell>
    ),
    embarkPort: (
      <DataTableCell key="embarkPort" className="max-w-[220px]">
        <div className="truncate">{formatKnownCodeLabel(record.embarkPortCode, record.decodedLabels.embarkPort, "puerto sin etiqueta", "port")}</div>
      </DataTableCell>
    ),
    disembarkPort: (
      <DataTableCell key="disembarkPort" className="max-w-[220px]">
        <div className="truncate">{formatKnownCodeLabel(record.disembarkPortCode, record.decodedLabels.disembarkPort, "puerto sin etiqueta", "port")}</div>
      </DataTableCell>
    ),
    transport: (
      <DataTableCell key="transport" className="max-w-[220px]">
        <div className="truncate">{transportModeForRecord(record)}</div>
      </DataTableCell>
    ),
    cargo: (
      <DataTableCell key="cargo" className="max-w-[170px]">
        <div className="truncate">{formatKnownCodeLabel(record.cargoTypeCode, record.decodedLabels.cargoType, "tipo sin etiqueta", "cargoType")}</div>
      </DataTableCell>
    ),
    itemValue: <DataTableCell key="itemValue" numeric>{item.value}</DataTableCell>,
    declarationFob: (
      <DataTableCell key="declarationFob" numeric>
        {valueCell(record.declarationFobValue, record)}
      </DataTableCell>
    ),
    freight: (
      <DataTableCell key="freight" numeric>
        {valueCell(record.freightValue, record)}
      </DataTableCell>
    ),
    insurance: (
      <DataTableCell key="insurance" numeric>
        {valueCell(record.insuranceValue, record)}
      </DataTableCell>
    ),
    cif: (
      <DataTableCell key="cif" numeric>
        {valueCell(record.cifValue, record)}
      </DataTableCell>
    ),
    unitPrice: (
      <DataTableCell key="unitPrice" numeric>
        {formatTradeDecimal(record.unitPriceValue, 4, "No informado")}
      </DataTableCell>
    ),
    quantity: <DataTableCell key="quantity" numeric>{formatQuantityForRecord(record)}</DataTableCell>,
    unit: (
      <DataTableCell key="unit">
        {formatTradeQuantityUnitDisplay(
          record.quantityUnitCode,
          record.decodedLabels.quantityUnit
        )}
      </DataTableCell>
    ),
    grossWeightItem: (
      <DataTableCell key="grossWeightItem" numeric>
        {formatWeightDisplay(record.grossWeightItem)}
      </DataTableCell>
    ),
    grossWeightTotal: (
      <DataTableCell key="grossWeightTotal" numeric>
        {formatWeightDisplay(record.grossWeightTotal)}
      </DataTableCell>
    ),
    source: (
      <DataTableCell key="source" className="max-w-[136px]">
        <StatusBadge variant={sourceState.variant} size="sm">
          {sourceState.label}
        </StatusBadge>
        <div className="mt-0.5 truncate text-ds-xs text-ds-text-muted">
          Fila {record.rawRowNumber} · {sourceName}
        </div>
      </DataTableCell>
    ),
    sourceFile: (
      <DataTableCell key="sourceFile" className="max-w-[260px]">
        <div className="truncate font-medium">{sourceName}</div>
      </DataTableCell>
    ),
    rawRow: <DataTableCell key="rawRow" numeric>{record.rawRowNumber}</DataTableCell>,
    batch: (
      <DataTableCell key="batch" className="max-w-[180px]">
        <div className="truncate font-mono text-ds-xs">{record.importBatchId}</div>
        <div className="mt-1 text-ds-xs text-ds-text-muted">{record.importBatchStatus}</div>
      </DataTableCell>
    ),
    parser: (
      <DataTableCell key="parser" className="max-w-[200px]">
        <div className="truncate font-mono text-ds-xs">
          {record.parserName} {record.parserVersion}
        </div>
      </DataTableCell>
    ),
    payload: (
      <DataTableCell key="payload" className="max-w-[180px]">
        <div className="truncate">{record.payloadRetentionMode}</div>
        <div className="mt-1 text-ds-xs text-ds-text-muted">
          {record.payloadReconstructable ? "Reconstruible" : "No reconstruible"}
        </div>
      </DataTableCell>
    ),
    declaration: (
      <DataTableCell key="declaration" className="max-w-[170px]">
        <div className="truncate font-mono text-ds-xs">
          {record.declarationIdRaw ?? "No informado"}
        </div>
      </DataTableCell>
    ),
    itemNumber: <DataTableCell key="itemNumber" numeric>{record.itemNumber}</DataTableCell>,
    productReference: (
      <DataTableCell key="productReference" className="max-w-[260px]">
        <div className="truncate">{productReferenceForRecord(record)}</div>
      </DataTableCell>
    ),
    productDetails: (
      <DataTableCell key="productDetails" className="max-w-[340px]">
        <div className="line-clamp-2">{productDetailsForRecord(record)}</div>
      </DataTableCell>
    ),
  }

  return cells satisfies Record<ExplorerTableColumnKey, ReactNode>
}

function ExplorerSidebar() {
  return (
    <Sidebar>
      <SidebarInner>
        <SidebarBrand>
          <CountryFlag
            countryCode="CL"
            countryName="Chile"
            className="h-6 !w-9 rounded-[3px] !bg-[length:100%_100%]"
          />
          <span>Duanera</span>
        </SidebarBrand>
        <SidebarSection aria-label="Navegación principal">
          <SidebarItem active href="/explorer" icon={<SearchIcon aria-hidden="true" />}>
            Explorador
          </SidebarItem>
          <SidebarItem href="/trade-records" icon={<FileTextIcon aria-hidden="true" />}>
            Registros
          </SidebarItem>
          <SidebarItem disabled href="#" icon={<Building2Icon aria-hidden="true" />}>
            Empresas
          </SidebarItem>
          <SidebarItem disabled href="#" icon={<BoxIcon aria-hidden="true" />}>
            Productos HS
          </SidebarItem>
          <SidebarItem href="/sources" icon={<DatabaseIcon aria-hidden="true" />}>
            Fuentes
          </SidebarItem>
        </SidebarSection>
        <SidebarDataCard>
          <div className="font-semibold text-ds-text-primary">Chile-first</div>
          <div className="mt-1">Registros Aduana con trazabilidad a fuente, lote y fila.</div>
        </SidebarDataCard>
        <SidebarFooter>
          <SidebarItem href="/data-quality" icon={<ShieldCheckIcon aria-hidden="true" />}>
            Calidad de datos
          </SidebarItem>
          <SidebarItem disabled href="#" icon={<HelpCircleIcon aria-hidden="true" />}>
            Metodología
          </SidebarItem>
        </SidebarFooter>
      </SidebarInner>
    </Sidebar>
  )
}

export default async function ExplorerPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const availablePeriods = await listProductTradeRecordPeriods(db)
  const latestPeriod = availablePeriods[0]?.value ?? fallbackTradeRecordPeriod
  const defaultInput = defaultSearchInput(latestPeriod)
  const tableView = parseTradeRecordTableView(firstValue(params.view))
  const activeRanking = parseExplorerRanking(params.ranking)
  const searchInput = {
    tradeFlow: firstValue(params.tradeFlow) ?? defaultInput.tradeFlow,
    periodFrom: firstValue(params.periodFrom) ?? defaultInput.periodFrom,
    periodTo: firstValue(params.periodTo) ?? defaultInput.periodTo,
    q: firstValue(params.q),
    hsCodePrefix: firstValue(params.hsCodePrefix),
    importer: firstValue(params.importer),
    exporter: firstValue(params.exporter),
    originCountry: paramText(params.originCountry),
    destinationCountry: paramText(params.destinationCountry),
    customsOffice: firstValue(params.customsOffice),
    transportMode: firstValue(params.transportMode),
    embarkPort: firstValue(params.embarkPort),
    disembarkPort: firstValue(params.disembarkPort),
    cargoType: firstValue(params.cargoType),
    logisticsParty: firstValue(params.logisticsParty),
    logisticsRole: firstValue(params.logisticsRole),
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
    sourceFileId: firstValue(params.sourceFileId),
    importBatchId: firstValue(params.importBatchId),
    sort: firstValue(params.sort),
    limit: firstValue(params.limit) ?? defaultInput.limit,
    offset: firstValue(params.offset),
    after: firstValue(params.after),
  }
  const selectedLogisticsPartyId = searchInput.logisticsParty
    ? normalizeUuid(searchInput.logisticsParty)
    : null
  const filterOptions = await loadTradeRecordFilterOptions(db, {
    logisticsPartyIds: selectedLogisticsPartyId ? [selectedLogisticsPartyId] : [],
  })

  let result: TradeRecordSearchResponse
  let searchError: string | null = null

  try {
    result = await searchTradeRecords(db, searchInput, { productFacing: true })
  } catch (error) {
    if (!(error instanceof TradeRecordSearchError)) {
      throw error
    }

    searchError = error.message
    result = await searchTradeRecords(db, defaultInput, { productFacing: true })
  }

  const activeChips = activeFilterChips(result.filters, filterOptions)
  const currentExplorerHref = buildExplorerHref(params, {})
  const savedSearchFiltersLabel =
    activeChips.length > 0
      ? activeChips.map((chip) => `${chip.label}: ${chip.value}`).join(" · ")
      : `Sin filtros adicionales · ${formatTradeFlowLabel(result.filters.tradeFlow ?? "import")} · ${result.filters.periodFrom ?? latestPeriod}`
  const savedSearchDefaultName = `Explorador ${result.filters.periodFrom ?? latestPeriod}`
  const requestedSelectedId = firstValue(params.selected)
  const selectedId = requestedSelectedId ?? null
  const periodScope = formatTradeRecordPeriodScope(availablePeriods)
  const hasAvailablePeriods = availablePeriods.length > 0
  const hasDevelopmentData = await hasDevelopmentSourceSignal(result.filters)
  const activeTableView = tradeRecordTableViewById(tableView)
  const flowUiConfig = tradeFlowUiConfig(result.filters.tradeFlow ?? "import")
  const tableColumns = explorerTableColumnsForView(
    tableView,
    result.filters.tradeFlow ?? "import"
  )
  const tableMinWidth = tableColumns.reduce((sum, column) => sum + column.width, 0)
  const exportParams = {
    ...filtersToTradeRecordSearchParams(result.filters),
    view: tableView,
  }
  const exportPlan = createTradeRecordExportPlan({
    filters: result.filters,
    totalRows: result.pagination.total,
    view: tableView,
  })
  const exportHref = buildExplorerExportHref(exportParams, "/api/explorer/export-xlsx")
  const previousPageHref = explorerPreviousPageHref(params, result.pagination)
  const nextPageHref = explorerNextPageHref(params, result.pagination, result.data.length)
  const paginationLabel = explorerPaginationLabel(
    result.pagination,
    result.data.length,
    Boolean(firstValue(params.after))
  )
  const activeAdvancedFilterCount = [
    searchInput.originCountry,
    searchInput.destinationCountry,
    searchInput.embarkPort,
    searchInput.disembarkPort,
    searchInput.customsOffice,
    searchInput.transportMode,
    searchInput.cargoType,
    searchInput.minItemValue,
    searchInput.maxItemValue,
    searchInput.minDeclarationFob,
    searchInput.maxDeclarationFob,
    searchInput.minQuantity,
    searchInput.maxQuantity,
    searchInput.minGrossWeightItem,
    searchInput.maxGrossWeightItem,
    searchInput.minGrossWeightTotal,
    searchInput.maxGrossWeightTotal,
    searchInput.logisticsParty,
    searchInput.logisticsRole,
  ].filter(Boolean).length
  const periodPickerFrom =
    searchInput.periodFrom || result.filters.periodFrom || defaultInput.periodFrom
  const periodPickerTo =
    searchInput.periodTo || result.filters.periodTo || periodPickerFrom || defaultInput.periodTo
  const globalSearchOmitKeys = [
    "q",
    "offset",
    "after",
    ...flowUiConfig.incompatibleParams,
  ]

  return (
    <ExplorerDrawerProvider
      drawerId={recordDetailDrawerId}
      initialSelectedId={selectedId}
    >
      <AppShell
        sidebar={<ExplorerSidebar />}
        detailPanel={<ExplorerRecordDetailDrawer />}
      >
        <AppShellMain>
        <div className="sticky top-0 z-20 flex min-h-(--ds-topbar-height) items-center border-b border-ds-border-soft bg-ds-shell/95 px-6 backdrop-blur-sm">
          <GlobalSearch
            action="/explorer"
            inputProps={{
              defaultValue: firstValue(params.q),
              name: "q",
            }}
            label="Buscar producto o glosa fuente"
            placeholder="Buscar producto, glosa fuente o atributo"
          >
            <HiddenSearchFields params={params} omit={globalSearchOmitKeys} />
          </GlobalSearch>
        </div>

        <AppShellContent className="gap-3 py-3">
          <header className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <h1 className="text-ds-xl font-bold leading-(--ds-leading-tight) text-ds-text-primary">
                Explorador
              </h1>
              <StatusBadge
                variant={hasDevelopmentData ? "review" : "neutral"}
                size="sm"
              >
                {hasDevelopmentData ? "Datos de desarrollo" : "Datos disponibles"}
              </StatusBadge>
            </div>
            <p className="max-w-4xl text-ds-xs leading-(--ds-leading-normal) text-ds-text-secondary">
              Registros Aduana disponibles para {periodScope}.{" "}
              {searchInput.tradeFlow === "export" ? "Los exportadores" : "Los importadores"} se
              muestran como IDs Aduana anónimos; el esquema actual no contiene nombres legales ni
              RUTs.
              {hasDevelopmentData
                ? " La vista actual incluye registros de prueba visibles en la base dev."
                : ""}
            </p>
          </header>

          <form action="/explorer" className="rounded-ds-md border border-ds-border-soft bg-ds-surface">
            <ExplorerFlowFilterProvider initialTradeFlow={searchInput.tradeFlow}>
            <FilterBar>
              <FilterBarGroup>
                <ExplorerPrimaryFilterControls
                  exporter={searchInput.exporter}
                  importer={searchInput.importer}
                />
                <ExplorerPeriodFilterControl
                  availablePeriods={availablePeriods.map((period) => period.value)}
                  periodFrom={periodPickerFrom}
                  periodTo={periodPickerTo}
                />
                <FilterInput className="w-36" label="Partida arancelaria" name="hsCodePrefix" value={searchInput.hsCodePrefix} placeholder="8471" />
                <ExplorerSortFilterControl value={searchInput.sort} />
              </FilterBarGroup>
              <FilterBarActions>
                <input type="hidden" name="q" value={searchInput.q ?? ""} />
                <input type="hidden" name="sourceFileId" value={searchInput.sourceFileId ?? ""} />
                <input type="hidden" name="importBatchId" value={searchInput.importBatchId ?? ""} />
                <input type="hidden" name="view" value={tableView} />
                <input type="hidden" name="ranking" value={activeRanking} />
                <ExplorerSubmitButton />
                <Link
                  className={cn(buttonVariants({ variant: "secondary", size: "product-md" }))}
                  href={resetExplorerHref()}
                >
                  Limpiar
                </Link>
              </FilterBarActions>
            </FilterBar>
            <ExplorerAdvancedFiltersPopover
              activeCount={activeAdvancedFilterCount}
              filterOptions={filterOptions}
              searchInput={searchInput}
            />
            </ExplorerFlowFilterProvider>
            {activeChips.length > 0 ? (
              <div className="flex flex-wrap gap-1 px-3 py-1.5">
                {activeChips.map((chip) => (
                  <FilterChip
                    key={chip.key}
                    variant={chip.variant}
                    className="h-7 gap-1 px-2 text-[11px]"
                  >
                    <span className="text-ds-text-muted">{chip.label}</span>
                    {chip.value}
                    <Link
                      aria-label={`Quitar filtro ${chip.label}`}
                      className="-mr-0.5 inline-flex size-4 items-center justify-center rounded-ds-sm text-current opacity-70 transition-opacity hover:opacity-100 focus-visible:ring-3 focus-visible:ring-ds-focus-ring/20 focus-visible:outline-none [&_svg]:size-3"
                      href={removeFilterHref(params, chip.key)}
                    >
                      <XIcon aria-hidden="true" />
                    </Link>
                  </FilterChip>
                ))}
              </div>
            ) : null}
          </form>

          {searchError ? (
            <div className="rounded-ds-md border border-ds-warning-border bg-ds-warning-soft p-4 text-ds-sm text-ds-warning">
              Filtro inválido: {searchError}. Se muestran los registros por defecto.
            </div>
          ) : null}

          {!hasAvailablePeriods ? (
            <div className="rounded-ds-md border border-ds-warning-border bg-ds-warning-soft p-4 text-ds-sm text-ds-warning">
              No hay periodos cargados en la base actual. El Explorador queda listo
              para mostrar registros cuando el servicio devuelva datos.
            </div>
          ) : null}

          <ExplorerResultsSummary filterOptions={filterOptions} result={result} />

          <DataTableShell className="overflow-hidden rounded-ds-md border border-ds-border-soft">
            <p id={rowActionDescriptionId} className="sr-only">
              Las filas de registros abren el detalle del registro. Presiona Enter o
              Espacio para abrir el detalle; presiona Escape para cerrarlo cuando
              esté abierto.
            </p>
            <DataTableToolbar className="min-h-0 flex-wrap gap-2 px-3 py-1.5">
              <div className="flex min-w-0 items-baseline gap-2">
                <DataTableTitle className="text-ds-sm">Registros</DataTableTitle>
                <DataTableCount className="text-ds-xs">
                  {result.pagination.total.toLocaleString("es-CL")} registros
                </DataTableCount>
              </div>
              <DataTableActions className="flex-wrap justify-end gap-1.5">
                <ExplorerTableViewNav params={params} view={tableView} />
                <ExplorerExportPanel exportHref={exportHref} plan={exportPlan} />
              </DataTableActions>
            </DataTableToolbar>
            <div className="overflow-x-auto">
              <DataTable className="table-fixed" style={{ minWidth: tableMinWidth }}>
                <colgroup>
                  {tableColumns.map((column) => (
                    <col key={column.key} style={{ width: column.width }} />
                  ))}
                </colgroup>
                <DataTableHeader>
                  <DataTableRow>
                    {tableColumns.map((column) => (
                      <DataTableHead
                        key={column.key}
                        aria-sort={explorerColumnSortDirection(column, result.filters.sort)}
                        className={column.numeric ? "text-right" : undefined}
                      >
                        <ExplorerTableHeaderLabel
                          column={column}
                          currentSort={result.filters.sort}
                          params={params}
                        />
                      </DataTableHead>
                    ))}
                  </DataTableRow>
                </DataTableHeader>
                <DataTableBody>
                  {result.data.length === 0 ? (
                    <DataTableRow>
                      <DataTableCell colSpan={tableColumns.length} className="p-0">
                        <DataTableEmpty className="border-0">
                          No encontramos registros con estos filtros. Ajusta periodo,
                          producto, partida arancelaria, país, puerto o ID Aduana.
                        </DataTableEmpty>
                      </DataTableCell>
                    </DataTableRow>
                  ) : (
                    result.data.map((record) => {
                      const product = productDisplayFromRaw(record.productDescriptionRaw)
                      const selected = selectedId === record.id

                      const detailHref = selectedExplorerHref(params, record.id)
                      const tableCells = explorerTableCells(record)

                      return (
                        <SelectableDataTableRow
                          key={record.id}
                          aria-controls={selected ? recordDetailDrawerId : undefined}
                          aria-describedby={rowActionDescriptionId}
                          aria-expanded={selected}
                          aria-label={`Abrir detalle de ${product.title}, ${record.hsCodeNormalized ? `partida arancelaria ${record.hsCodeNormalized}` : "partida arancelaria no informada"}`}
                          aria-keyshortcuts="Enter Space"
                          href={detailHref}
                          recordId={record.id}
                          selected={selected}
                        >
                          {tableColumns.map((column) => tableCells[column.key])}
                        </SelectableDataTableRow>
                      )
                    })
                  )}
                </DataTableBody>
              </DataTable>
            </div>
            <DataTablePagination className="flex-wrap justify-between">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span>{paginationLabel}</span>
                <span aria-hidden="true" className="text-ds-text-subtle">·</span>
                <div className="flex items-center gap-1 text-ds-xs">
                  <span className="text-ds-text-muted">Filas</span>
                  {explorerPageSizeOptions.map((limit) => {
                    const isActive = result.pagination.limit === limit

                    return isActive ? (
                      <span
                        key={limit}
                        aria-current="true"
                        className="rounded-ds-sm bg-ds-primary-soft px-1.5 py-0.5 font-semibold text-ds-primary"
                      >
                        {limit}
                      </span>
                    ) : (
                      <Link
                        key={limit}
                        className="rounded-ds-sm px-1.5 py-0.5 font-medium text-ds-text-secondary underline-offset-4 hover:text-ds-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-focus-ring/25"
                        href={explorerPageSizeHref(params, limit)}
                      >
                        {limit}
                      </Link>
                    )
                  })}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {previousPageHref ? (
                  <Link
                    className={cn(buttonVariants({ variant: "secondary", size: "product-md" }))}
                    href={previousPageHref}
                  >
                    Anterior
                  </Link>
                ) : (
                  <span
                    aria-disabled="true"
                    className={cn(
                      buttonVariants({ variant: "secondary", size: "product-md" }),
                      "pointer-events-none opacity-45"
                    )}
                  >
                    Anterior
                  </span>
                )}
                {nextPageHref ? (
                  <Link
                    className={cn(buttonVariants({ variant: "secondary", size: "product-md" }))}
                    href={nextPageHref}
                  >
                    Siguiente
                  </Link>
                ) : (
                  <span
                    aria-disabled="true"
                    className={cn(
                      buttonVariants({ variant: "secondary", size: "product-md" }),
                      "pointer-events-none opacity-45"
                    )}
                  >
                    Siguiente
                  </span>
                )}
              </div>
            </DataTablePagination>
          </DataTableShell>

          <ExplorerSearchMemory
            currentHref={currentExplorerHref}
            defaultName={savedSearchDefaultName}
            filtersLabel={savedSearchFiltersLabel}
            viewLabel={activeTableView.label}
          />

          <ExplorerRankingModule
            activeRanking={activeRanking}
            filterOptions={filterOptions}
            params={params}
            result={result}
          />
        </AppShellContent>
        </AppShellMain>
      </AppShell>
    </ExplorerDrawerProvider>
  )
}
