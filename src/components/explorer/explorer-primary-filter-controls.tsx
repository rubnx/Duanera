"use client"

import {
  CalendarDaysIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MapPinIcon,
  SearchIcon,
  ShipIcon,
  SlidersHorizontalIcon,
  XIcon,
} from "lucide-react"
import {
  Children,
  Fragment,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react"
import type { ComponentProps, ReactNode } from "react"

import { CountryMultiFilter } from "@/components/explorer/country-multi-filter"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  formatTradeDisplayCodeLabel,
  type TradeDisplayCodeKind,
} from "@/trade/trade-record-format"
import type { TradeRecordFilterOptions } from "@/trade/trade-record-filter-options"
import type { LogisticsPartySearchResult } from "@/trade/trade-logistics-party-search"
import {
  formatTradeRecordPeriodRangeLabel,
  tradeRecordLoadedYearRange,
} from "@/trade/trade-record-period-labels"
import {
  normalizeTradeFlowUi,
  tradeFlowUiConfig,
  type TradeFlowUiConfig,
} from "@/trade/trade-flow-ui"
import type { TradeFlow } from "@/trade/trade-records"
import {
  tradeRecordSortLabels,
  tradeRecordSortValues,
} from "@/trade/trade-record-sort"

type ExplorerFlowFilterContextValue = {
  config: TradeFlowUiConfig
  setTradeFlow: (tradeFlow: TradeFlow) => void
  tradeFlow: TradeFlow
}

const ExplorerFlowFilterContext =
  createContext<ExplorerFlowFilterContextValue | null>(null)

function useExplorerFlowFilter() {
  const context = useContext(ExplorerFlowFilterContext)

  if (!context) {
    throw new Error("Explorer flow filters must be rendered inside ExplorerFlowFilterProvider")
  }

  return context
}

function ExplorerFlowFilterProvider({
  children,
  initialTradeFlow,
}: {
  children: ReactNode
  initialTradeFlow?: string
}) {
  const normalizedInitialTradeFlow = normalizeTradeFlowUi(initialTradeFlow)
  const [tradeFlow, setTradeFlow] = useState<TradeFlow>(normalizedInitialTradeFlow)
  const config = useMemo(() => tradeFlowUiConfig(tradeFlow), [tradeFlow])

  useEffect(() => {
    setTradeFlow(normalizedInitialTradeFlow)
  }, [normalizedInitialTradeFlow])

  return (
    <ExplorerFlowFilterContext.Provider value={{ config, setTradeFlow, tradeFlow }}>
      {children}
    </ExplorerFlowFilterContext.Provider>
  )
}

function FilterControlLabel({
  children,
  className,
  hideLabel,
  label,
}: {
  children: ReactNode
  className?: string
  hideLabel?: boolean
  label: string
}) {
  return (
    <label
      className={cn(
        "flex min-w-0 flex-none flex-col gap-0.5 text-[11px] font-medium leading-none text-ds-text-muted",
        className
      )}
    >
      <span className={hideLabel ? "sr-only" : undefined}>{label}</span>
      {children}
    </label>
  )
}

const compactControlClassName =
  "h-(--ds-control-height-sm) w-full min-w-0 rounded-ds-md border border-ds-border bg-ds-surface px-2 text-ds-xs leading-none text-ds-text-primary outline-none placeholder:text-ds-text-muted focus-visible:border-ds-focus-ring focus-visible:ring-3 focus-visible:ring-ds-focus-ring/20"

const primaryFilterFieldWidths = {
  tradeFlow: "w-44",
  participant: "w-33",
  period: "w-34",
  hsCode: "w-28",
  sort: "w-44",
} as const

function ControlledFilterInput({
  className,
  name,
  placeholder,
  value,
}: {
  className?: string
  name: string
  placeholder?: string
  value?: string
}) {
  const [inputValue, setInputValue] = useState(value ?? "")

  useEffect(() => {
    setInputValue(value ?? "")
  }, [value])

  return (
    <input
      className={cn(compactControlClassName, className)}
      name={name}
      onChange={(event) => setInputValue(event.target.value)}
      placeholder={placeholder}
      value={inputValue}
    />
  )
}

function FilterInput({
  className,
  label,
  name,
  value,
  placeholder,
}: {
  className?: string
  label: string
  name: string
  placeholder?: string
  value?: string
}) {
  return (
    <FilterControlLabel className={className} label={label}>
      <ControlledFilterInput name={name} placeholder={placeholder} value={value} />
    </FilterControlLabel>
  )
}

function FilterRange({
  label,
  maxName,
  maxValue,
  minName,
  minValue,
}: {
  label: string
  maxName: string
  maxValue?: string
  minName: string
  minValue?: string
}) {
  return (
    <div className="flex w-full flex-col gap-0.5 text-ds-xs font-medium text-ds-text-muted">
      <span>{label}</span>
      <div className="grid grid-cols-2 gap-1.5">
        <ControlledFilterInput name={minName} placeholder="mín" value={minValue} />
        <ControlledFilterInput name={maxName} placeholder="máx" value={maxValue} />
      </div>
    </div>
  )
}

type FilterSelectOption = {
  disabled?: boolean
  label: string
  value: string
}

function filterSelectLabelFromChildren(children: ReactNode) {
  return Children.toArray(children)
    .map((child) => {
      if (typeof child === "string" || typeof child === "number") {
        return String(child)
      }

      return ""
    })
    .join("")
    .trim()
}

function filterSelectOptionsFromChildren(children: ReactNode): FilterSelectOption[] {
  const options: FilterSelectOption[] = []

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) {
      return
    }

    if (child.type === Fragment) {
      const fragmentProps = child.props as { children?: ReactNode }
      options.push(...filterSelectOptionsFromChildren(fragmentProps.children))
      return
    }

    if (child.type !== "option") {
      return
    }

    const optionProps = child.props as {
      children?: ReactNode
      disabled?: boolean
      value?: unknown
    }
    const value = optionProps.value == null ? "" : String(optionProps.value)
    const label = filterSelectLabelFromChildren(optionProps.children) || value
    options.push({ disabled: optionProps.disabled, label, value })
  })

  return options
}

function FilterSelect({
  children,
  className,
  hideLabel,
  label,
  name,
  onValueChange,
  value,
}: {
  children: ReactNode
  className?: string
  hideLabel?: boolean
  label: string
  name: string
  onValueChange?: (value: string) => void
  value?: string
}) {
  const [selectValue, setSelectValue] = useState(value ?? "")
  const options = useMemo(() => filterSelectOptionsFromChildren(children), [children])

  useEffect(() => {
    setSelectValue(value ?? "")
  }, [value])

  return (
    <FilterControlLabel className={className} hideLabel={hideLabel} label={label}>
      <input type="hidden" name={name} value={selectValue} />
      <Select
        items={options.map((option) => ({
          label: option.label,
          value: option.value,
        }))}
        onValueChange={(nextValue) => {
          const normalizedValue = typeof nextValue === "string" ? nextValue : ""
          setSelectValue(normalizedValue)
          onValueChange?.(normalizedValue)
        }}
        value={selectValue}
      >
        <SelectTrigger
          size="sm"
          className={cn(
            compactControlClassName,
            "h-(--ds-control-height-sm)! w-full rounded-ds-md bg-ds-surface py-0 pr-2 pl-2 text-ds-xs leading-none text-ds-text-primary ring-0 data-placeholder:text-ds-text-muted [&_svg]:size-3"
          )}
        >
          <SelectValue className="min-w-0 truncate" />
        </SelectTrigger>
        <SelectContent
          align="start"
          alignItemWithTrigger={false}
          className="max-h-72 min-w-(--anchor-width) rounded-ds-md border border-ds-border bg-ds-surface p-1 text-ds-xs text-ds-text-primary shadow-ds-md ring-0"
        >
          {options.map((option) => (
            <SelectItem
              key={option.value}
              className="min-h-8 rounded-ds-sm px-2 py-1.5 text-ds-xs text-ds-text-primary data-highlighted:bg-ds-muted data-highlighted:text-ds-text-primary"
              disabled={option.disabled}
              label={option.label}
              value={option.value}
            >
              <span className="min-w-0 truncate">{option.label}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FilterControlLabel>
  )
}

function selectOptions(
  options: Array<{ value: string; displayLabel: string; label?: string }>,
  allLabel: string,
  kind?: TradeDisplayCodeKind
) {
  return (
    <>
      <option value="">{allLabel}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {kind
            ? formatTradeDisplayCodeLabel({
                code: option.value,
                fallback: option.displayLabel,
                kind,
                label: option.label,
              })
            : option.displayLabel}
        </option>
      ))}
    </>
  )
}

type LogisticsPartyOption = Pick<
  LogisticsPartySearchResult,
  "displayName" | "id" | "normalizedGroupName" | "recordCount"
>

function logisticsOptionFromFilterOption(
  option: TradeRecordFilterOptions["logisticsParties"][number]
): LogisticsPartyOption {
  return {
    displayName: option.label,
    id: option.value,
    normalizedGroupName: null,
    recordCount: 0,
  }
}

function LogisticsPartyTypeahead({
  initialOptions,
  value,
}: {
  initialOptions: TradeRecordFilterOptions["logisticsParties"]
  value?: string
}) {
  const topOptions = useMemo(
    () => initialOptions.slice(0, 20).map(logisticsOptionFromFilterOption),
    [initialOptions]
  )
  const initialSelected = useMemo(
    () => initialOptions.find((option) => option.value === value),
    [initialOptions, value]
  )
  const [inputValue, setInputValue] = useState(initialSelected?.label ?? "")
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [options, setOptions] = useState<LogisticsPartyOption[]>(topOptions)
  const [selectedId, setSelectedId] = useState(value ?? "")
  const labelId = useId()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setSelectedId(value ?? "")
    setInputValue(initialSelected?.label ?? "")
  }, [initialSelected?.label, value])

  useEffect(() => {
    const trimmed = inputValue.trim()
    if (trimmed.length < 2) {
      setOptions(topOptions)
      setIsLoading(false)
      return
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      setIsLoading(true)

      fetch(`/api/logistics-parties/search?q=${encodeURIComponent(trimmed)}&limit=20`, {
        signal: controller.signal,
      })
        .then((response) => (response.ok ? response.json() : { data: [] }))
        .then((payload: { data?: LogisticsPartySearchResult[] }) => {
          setOptions(
            (payload.data ?? []).map((option) => ({
              displayName: option.displayName,
              id: option.id,
              normalizedGroupName: option.normalizedGroupName,
              recordCount: option.recordCount,
            }))
          )
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") {
            return
          }
          setOptions([])
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsLoading(false)
          }
        })
    }, 250)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [inputValue, topOptions])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Node && containerRef.current?.contains(target)) {
        return
      }
      setIsOpen(false)
    }

    document.addEventListener("pointerdown", handlePointerDown)
    return () => document.removeEventListener("pointerdown", handlePointerDown)
  }, [isOpen])

  const selectedOption = options.find((option) => option.id === selectedId)
  const visibleOptions = options.length > 0 ? options : selectedOption ? [selectedOption] : []

  return (
    <div
      ref={containerRef}
      className="relative flex w-full flex-col gap-0.5 text-[11px] font-medium leading-none text-ds-text-muted"
    >
      <span id={labelId}>Entidad logística</span>
      <input type="hidden" name="logisticsParty" value={selectedId} />
      <div className="relative">
        <SearchIcon
          aria-hidden="true"
          className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-ds-text-muted"
        />
        <input
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-labelledby={labelId}
          className={cn(compactControlClassName, "pr-8 pl-7")}
          onChange={(event) => {
            setInputValue(event.target.value)
            setSelectedId("")
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Buscar Maersk, Hartrodt..."
          value={inputValue}
        />
        {selectedId || inputValue ? (
          <button
            aria-label="Limpiar entidad logística"
            className="absolute right-1.5 top-1/2 inline-flex size-5 -translate-y-1/2 items-center justify-center rounded-ds-sm text-ds-text-muted hover:bg-ds-muted hover:text-ds-text-primary"
            onClick={() => {
              setInputValue("")
              setSelectedId("")
              setOptions(topOptions)
              setIsOpen(false)
            }}
            type="button"
          >
            <XIcon aria-hidden="true" className="size-3.5" />
          </button>
        ) : null}
      </div>
      {isOpen ? (
        <div className="absolute left-0 top-[calc(100%+0.35rem)] z-50 max-h-64 w-full min-w-[18rem] overflow-y-auto rounded-ds-md border border-ds-border bg-ds-surface shadow-ds-md">
          {isLoading ? (
            <div className="px-3 py-2 text-ds-xs text-ds-text-muted">Buscando...</div>
          ) : visibleOptions.length > 0 ? (
            visibleOptions.map((option) => (
              <button
                key={option.id}
                className={cn(
                  "block w-full px-3 py-2 text-left text-ds-xs hover:bg-ds-muted focus-visible:bg-ds-muted focus-visible:outline-none",
                  option.id === selectedId && "bg-ds-primary-softer text-ds-primary"
                )}
                onClick={() => {
                  setSelectedId(option.id)
                  setInputValue(option.displayName)
                  setIsOpen(false)
                }}
                type="button"
              >
                <span className="block truncate font-semibold text-ds-text-primary">
                  {option.displayName}
                </span>
                <span className="block truncate text-ds-xs text-ds-text-muted">
                  {option.normalizedGroupName
                    ? `${option.normalizedGroupName} · ${option.recordCount} registros`
                    : option.recordCount > 0
                      ? `${option.recordCount} registros`
                      : "Entidad logística"}
                </span>
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-ds-xs text-ds-text-muted">
              Sin coincidencias.
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

const monthNames = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
]

function parsePeriod(value: string | undefined) {
  if (!value) {
    return null
  }

  const match = value.match(/^(\d{4})-(\d{2})$/)
  if (!match) {
    return null
  }

  const year = Number(match[1] ?? "")
  const month = Number(match[2] ?? "")
  if (!Number.isInteger(year) || month < 1 || month > 12) {
    return null
  }

  return { index: year * 12 + month - 1, month, value, year }
}

function buildPeriod(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`
}

function ExplorerPeriodFilterControl({
  availablePeriods,
  periodFrom,
  periodTo,
}: {
  availablePeriods: string[]
  periodFrom: string
  periodTo: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedFrom, setSelectedFrom] = useState(periodFrom)
  const [selectedTo, setSelectedTo] = useState(periodTo)
  const containerRef = useRef<HTMLDivElement>(null)
  const parsedSelectedFrom = parsePeriod(selectedFrom)
  const parsedSelectedTo = parsePeriod(selectedTo)
  const periodSet = useMemo(() => new Set(availablePeriods), [availablePeriods])
  const years = useMemo(() => {
    const parsedYears = availablePeriods
      .map((period) => parsePeriod(period)?.year)
      .filter((year): year is number => typeof year === "number")
    const selectedYears = [parsedSelectedFrom?.year, parsedSelectedTo?.year].filter(
      (year): year is number => typeof year === "number"
    )
    return Array.from(new Set([...parsedYears, ...selectedYears])).sort((a, b) => a - b)
  }, [availablePeriods, parsedSelectedFrom?.year, parsedSelectedTo?.year])
  const yearShortcuts = useMemo(() => {
    const parsedYears = availablePeriods
      .map((period) => parsePeriod(period)?.year)
      .filter((year): year is number => typeof year === "number")
    return Array.from(new Set(parsedYears)).sort((a, b) => b - a)
  }, [availablePeriods])
  const [visibleYear, setVisibleYear] = useState(() => {
    return parsedSelectedTo?.year ?? parsedSelectedFrom?.year ?? years.at(-1) ?? new Date().getFullYear()
  })
  const firstYear = years[0] ?? visibleYear
  const lastYear = years.at(-1) ?? visibleYear

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Node && containerRef.current?.contains(target)) {
        return
      }
      setIsOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false)
      }
    }

    document.addEventListener("pointerdown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen])

  useEffect(() => {
    setSelectedFrom(periodFrom)
    setSelectedTo(periodTo)
  }, [periodFrom, periodTo])

  const handleSelectMonth = (nextPeriod: string) => {
    const next = parsePeriod(nextPeriod)
    const from = parsePeriod(selectedFrom)
    const to = parsePeriod(selectedTo)

    if (!next) {
      return
    }

    if (!from || (from && to && from.value !== to.value)) {
      setSelectedFrom(next.value)
      setSelectedTo(next.value)
      return
    }

    if (next.index < from.index) {
      setSelectedFrom(next.value)
      setSelectedTo(from.value)
    } else {
      setSelectedTo(next.value)
    }
    setIsOpen(false)
  }

  const handleSelectYear = (year: number) => {
    const range = tradeRecordLoadedYearRange(availablePeriods, year)
    if (!range) {
      return
    }

    setSelectedFrom(range.periodFrom)
    setSelectedTo(range.periodTo)
    setVisibleYear(year)
    setIsOpen(false)
  }

  const fromIndex = parsedSelectedFrom?.index
  const toIndex = parsedSelectedTo?.index

  return (
    <div
      ref={containerRef}
      className={cn("relative flex-none", primaryFilterFieldWidths.period)}
    >
      <FilterControlLabel className="w-full" label="Periodo">
        <input type="hidden" name="periodFrom" value={selectedFrom} />
        <input type="hidden" name="periodTo" value={selectedTo} />
        <button
          type="button"
          aria-expanded={isOpen}
          className={cn(
            compactControlClassName,
            "inline-flex items-center justify-start gap-1.5 text-left"
          )}
          onClick={() => setIsOpen((current) => !current)}
        >
          <CalendarDaysIcon aria-hidden="true" className="size-3 shrink-0 text-ds-text-muted" />
          <span className="min-w-0 truncate">
            {formatTradeRecordPeriodRangeLabel(selectedFrom, selectedTo)}
          </span>
        </button>
      </FilterControlLabel>
      {isOpen ? (
        <div className="absolute left-0 top-[calc(100%+0.35rem)] z-50 w-76 overflow-hidden rounded-ds-md border border-ds-border bg-ds-surface shadow-ds-md">
          {yearShortcuts.length > 0 ? (
            <div className="border-b border-ds-border-soft px-2 py-2">
              <div className="mb-1.5 text-ds-xs font-semibold text-ds-text-muted">
                Años
              </div>
              <div className="grid grid-cols-4 gap-1">
                {yearShortcuts.map((year) => {
                  const range = tradeRecordLoadedYearRange(availablePeriods, year)
                  const isSelectedYear =
                    Boolean(range) &&
                    selectedFrom === range?.periodFrom &&
                    selectedTo === range?.periodTo

                  return (
                    <button
                      key={year}
                      type="button"
                      aria-label={`Seleccionar año ${year}`}
                      className={cn(
                        "h-8 rounded-ds-sm text-ds-xs font-semibold transition-colors",
                        isSelectedYear
                          ? "bg-ds-primary text-ds-text-inverse"
                          : "text-ds-text-primary hover:bg-ds-muted"
                      )}
                      onClick={() => handleSelectYear(year)}
                    >
                      {year}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}
          <div className="flex items-center justify-between border-b border-ds-border-soft px-2 py-1.5">
            <button
              type="button"
              aria-label="Año anterior"
              className="inline-flex size-8 items-center justify-center rounded-ds-sm text-ds-text-secondary hover:bg-ds-muted hover:text-ds-text-primary disabled:pointer-events-none disabled:opacity-40"
              disabled={visibleYear <= firstYear}
              onClick={() => setVisibleYear((year) => Math.max(firstYear, year - 1))}
            >
              <ChevronLeftIcon aria-hidden="true" className="size-4" />
            </button>
            <div className="text-ds-sm font-semibold text-ds-text-primary">{visibleYear}</div>
            <button
              type="button"
              aria-label="Año siguiente"
              className="inline-flex size-8 items-center justify-center rounded-ds-sm text-ds-text-secondary hover:bg-ds-muted hover:text-ds-text-primary disabled:pointer-events-none disabled:opacity-40"
              disabled={visibleYear >= lastYear}
              onClick={() => setVisibleYear((year) => Math.min(lastYear, year + 1))}
            >
              <ChevronRightIcon aria-hidden="true" className="size-4" />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1 p-2">
            {monthNames.map((monthName, monthIndex) => {
              const month = monthIndex + 1
              const value = buildPeriod(visibleYear, month)
              const parsed = parsePeriod(value)
              const isAvailable = periodSet.has(value)
              const isSelected = value === selectedFrom || value === selectedTo
              const isInRange =
                typeof fromIndex === "number" &&
                typeof toIndex === "number" &&
                parsed &&
                parsed.index > Math.min(fromIndex, toIndex) &&
                parsed.index < Math.max(fromIndex, toIndex)

              return (
                <button
                  key={value}
                  type="button"
                  disabled={!isAvailable}
                  className={cn(
                    "h-8 rounded-ds-sm text-ds-xs font-medium transition-colors",
                    isSelected
                      ? "bg-ds-primary text-ds-text-inverse"
                      : isInRange
                        ? "bg-ds-primary-soft text-ds-primary"
                        : "text-ds-text-primary hover:bg-ds-muted",
                    !isAvailable && "cursor-not-allowed text-ds-text-muted opacity-35 hover:bg-transparent"
                  )}
                  onClick={() => handleSelectMonth(value)}
                >
                  {monthName}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function ExplorerPrimaryFilterControls({
  exporter,
  importer,
}: {
  exporter?: string
  importer?: string
}) {
  const { config, setTradeFlow, tradeFlow } = useExplorerFlowFilter()
  const participantValue = config.participant.name === "exporter" ? exporter : importer

  return (
    <>
      <FilterSelect
        className={primaryFilterFieldWidths.tradeFlow}
        label="Tipo de operación"
        name="tradeFlow"
        onValueChange={(nextValue) => setTradeFlow(normalizeTradeFlowUi(nextValue))}
        value={tradeFlow}
      >
        <option value="import">Importaciones</option>
        <option value="export">Exportaciones</option>
      </FilterSelect>
      <FilterInput
        key={config.participant.name}
        className={primaryFilterFieldWidths.participant}
        label={config.participant.label}
        name={config.participant.name}
        value={participantValue}
      />
    </>
  )
}

function ExplorerAdvancedFilterControls({
  filterOptions,
  searchInput,
}: {
  filterOptions: TradeRecordFilterOptions
  searchInput: {
    cargoType?: string
    customsOffice?: string
    destinationCountry?: string
    disembarkPort?: string
    embarkPort?: string
    logisticsParty?: string
    logisticsRole?: string
    maxDeclarationFob?: string
    maxGrossWeightItem?: string
    maxGrossWeightTotal?: string
    maxItemValue?: string
    maxQuantity?: string
    minDeclarationFob?: string
    minGrossWeightItem?: string
    minGrossWeightTotal?: string
    minItemValue?: string
    minQuantity?: string
    originCountry?: string
    sort?: string
    transportMode?: string
  }
}) {
  const { config } = useExplorerFlowFilter()
  const countryValue =
    config.countryFilter.name === "destinationCountry"
      ? searchInput.destinationCountry
      : searchInput.originCountry
  const primaryPortValue =
    config.primaryPortFilter.name === "embarkPort"
      ? searchInput.embarkPort
      : searchInput.disembarkPort
  const secondaryPortValue =
    config.secondaryPortFilter.name === "embarkPort"
      ? searchInput.embarkPort
      : searchInput.disembarkPort

  return (
    <div className="grid gap-x-4 gap-y-3 lg:grid-cols-2">
      <fieldset className="min-w-0">
        <legend className="mb-1.5 flex items-center gap-1 text-ds-xs font-semibold text-ds-text-secondary">
          <ShipIcon aria-hidden="true" className="size-3 shrink-0" />
          Logística
        </legend>
        <div className="grid gap-1.5 sm:grid-cols-2">
          <FilterSelect
            key={config.primaryPortFilter.name}
            className="w-full"
            label={config.primaryPortFilter.label}
            name={config.primaryPortFilter.name}
            value={primaryPortValue}
          >
            {selectOptions(filterOptions.ports, "Todos", "port")}
          </FilterSelect>
          <FilterSelect
            key={config.secondaryPortFilter.name}
            className="w-full"
            label={config.secondaryPortFilter.label}
            name={config.secondaryPortFilter.name}
            value={secondaryPortValue}
          >
            {selectOptions(filterOptions.ports, "Todos", "port")}
          </FilterSelect>
          <FilterSelect
            className="w-full"
            label="Vía transporte"
            name="transportMode"
            value={searchInput.transportMode}
          >
            {selectOptions(filterOptions.transportModes, "Todos", "transportMode")}
          </FilterSelect>
          <FilterSelect
            className="w-full"
            label="Tipo de carga"
            name="cargoType"
            value={searchInput.cargoType}
          >
            {selectOptions(filterOptions.cargoTypes, "Todos", "cargoType")}
          </FilterSelect>
          <LogisticsPartyTypeahead
            initialOptions={filterOptions.logisticsParties}
            value={searchInput.logisticsParty}
          />
          <FilterSelect
            className="w-full"
            label="Rol logístico"
            name="logisticsRole"
            value={searchInput.logisticsRole}
          >
            <option value="">Todos</option>
            <option value="issuer">Emisor documento transporte</option>
            <option value="carrier">Compañía de transporte</option>
          </FilterSelect>
        </div>
      </fieldset>

      <div className="flex min-w-0 flex-col gap-3">
        <fieldset className="min-w-0">
          <legend className="mb-1.5 flex items-center gap-1 text-ds-xs font-semibold text-ds-text-secondary">
            <MapPinIcon aria-hidden="true" className="size-3 shrink-0" />
            Geografía
          </legend>
          <div className="grid gap-1.5 sm:grid-cols-2">
            <CountryMultiFilter
              key={config.countryFilter.name}
              className="w-full"
              label={config.countryFilter.label}
              name={config.countryFilter.name}
              options={filterOptions.countries}
              value={countryValue}
            />
            <FilterSelect
              className="w-full"
              label="Aduana"
              name="customsOffice"
              value={searchInput.customsOffice}
            >
              {selectOptions(filterOptions.customsOffices, "Todas", "customsOffice")}
            </FilterSelect>
          </div>
        </fieldset>

        <fieldset className="min-w-0">
          <legend className="mb-1.5 flex items-center gap-1 text-ds-xs font-semibold text-ds-text-secondary">
          <SlidersHorizontalIcon aria-hidden="true" className="size-3 shrink-0" />
          Rangos comerciales
          </legend>
          <div className="grid gap-1.5 sm:grid-cols-2">
            <FilterRange
              label={config.itemValueLabel}
              minName="minItemValue"
              minValue={searchInput.minItemValue}
              maxName="maxItemValue"
              maxValue={searchInput.maxItemValue}
            />
            <FilterRange
              label="FOB total"
              minName="minDeclarationFob"
              minValue={searchInput.minDeclarationFob}
              maxName="maxDeclarationFob"
              maxValue={searchInput.maxDeclarationFob}
            />
            <FilterRange
              label="Cantidad"
              minName="minQuantity"
              minValue={searchInput.minQuantity}
              maxName="maxQuantity"
              maxValue={searchInput.maxQuantity}
            />
            {config.grossWeightFilters.map((filter) => (
              <FilterRange
                key={filter.minName}
                label={filter.label}
                minName={filter.minName}
                minValue={
                  filter.minName === "minGrossWeightItem"
                    ? searchInput.minGrossWeightItem
                    : searchInput.minGrossWeightTotal
                }
                maxName={filter.maxName}
                maxValue={
                  filter.maxName === "maxGrossWeightItem"
                    ? searchInput.maxGrossWeightItem
                    : searchInput.maxGrossWeightTotal
                }
              />
            ))}
          </div>
        </fieldset>
      </div>
    </div>
  )
}

function ExplorerSortFilterControl({
  className,
  hideLabel,
  onValueChange,
  value,
}: {
  className?: string
  hideLabel?: boolean
  onValueChange?: (value: string) => void
  value?: string
}) {
  return (
    <FilterSelect
      className={className ?? primaryFilterFieldWidths.sort}
      hideLabel={hideLabel}
      label="Orden"
      name="sort"
      onValueChange={onValueChange}
      value={value}
    >
      <option value="">Orden fuente</option>
      {tradeRecordSortValues
        .filter((sortValue) => sortValue !== "source")
        .map((sortValue) => (
          <option key={sortValue} value={sortValue}>
            {tradeRecordSortLabels[sortValue]}
          </option>
        ))}
    </FilterSelect>
  )
}

function ExplorerAdvancedFiltersPopover({
  activeCount,
  filterOptions,
  searchInput,
}: {
  activeCount: number
  filterOptions: TradeRecordFilterOptions
  searchInput: ComponentProps<typeof ExplorerAdvancedFilterControls>["searchInput"]
}) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Node && containerRef.current?.contains(target)) {
        return
      }
      setIsOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false)
      }
    }

    document.addEventListener("pointerdown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen])

  return (
    <div
      ref={containerRef}
      className="relative border-b border-ds-border-soft px-3 py-1.5 text-ds-xs"
    >
      <button
        type="button"
        aria-expanded={isOpen}
        className="flex w-fit cursor-pointer items-center gap-1.5 font-medium text-ds-text-secondary hover:text-ds-text-primary"
        onClick={() => setIsOpen((current) => !current)}
      >
        Más filtros
        {activeCount > 0 ? (
          <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-ds-primary-soft px-1 text-[10px] font-semibold leading-none text-ds-primary">
            {activeCount}
          </span>
        ) : null}
        <ChevronDownIcon
          aria-hidden="true"
          className={cn("size-3.5 transition-transform", isOpen && "rotate-180")}
        />
      </button>
      <div
        className={cn(
          "absolute left-3 top-[calc(100%+0.25rem)] z-40 w-[min(52rem,calc(100vw-3rem))] rounded-ds-md border border-ds-border bg-ds-surface p-3 shadow-ds-md",
          isOpen ? "block" : "hidden"
        )}
      >
        <ExplorerAdvancedFilterControls
          filterOptions={filterOptions}
          searchInput={searchInput}
        />
        <p className="mt-2 text-ds-xs leading-snug text-ds-text-muted">
          País y peso disponibles cambian según la operación; el puerto secundario es
          contexto de ruta.
        </p>
      </div>
    </div>
  )
}

export {
  ExplorerAdvancedFilterControls,
  ExplorerAdvancedFiltersPopover,
  ExplorerFlowFilterProvider,
  ExplorerPeriodFilterControl,
  ExplorerPrimaryFilterControls,
  ExplorerSortFilterControl,
  FilterInput,
}
