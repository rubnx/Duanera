"use client"

import { CheckIcon, SearchIcon, XIcon } from "lucide-react"
import { useEffect, useId, useMemo, useRef, useState } from "react"

import { cn } from "@/lib/utils"
import type { TradeRecordFilterOption } from "@/trade/trade-record-filter-options"
import { formatTradeDisplayCodeLabel } from "@/trade/trade-record-format"

function displayCodeFromParam(value: string) {
  const displayValueMatch = /^([A-Za-z0-9_-]+)\s*[·-]\s+/.exec(value)
  return displayValueMatch?.[1] ?? value
}

function selectedCodeValues(value: string | string[] | undefined) {
  const seen = new Set<string>()
  const codes: string[] = []

  for (const rawValue of Array.isArray(value) ? value : value ? [value] : []) {
    for (const fragment of rawValue.split(",")) {
      const trimmed = fragment.trim()
      if (!trimmed) {
        continue
      }

      const code = displayCodeFromParam(trimmed)
      if (!seen.has(code)) {
        codes.push(code)
        seen.add(code)
      }
    }
  }

  return codes
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function optionLabel(option: TradeRecordFilterOption) {
  return formatTradeDisplayCodeLabel({
    code: option.value,
    fallback: option.displayLabel,
    kind: "country",
    label: option.label,
  })
}

function CountryMultiFilter({
  className,
  label,
  name,
  options,
  value,
}: {
  className?: string
  label: string
  name: string
  options: TradeRecordFilterOption[]
  value?: string | string[]
}) {
  const labelId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const initialCodes = useMemo(() => selectedCodeValues(value), [value])
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [selectedCodes, setSelectedCodes] = useState(initialCodes)
  const selected = useMemo(() => new Set(selectedCodes), [selectedCodes])
  const labelsByCode = useMemo(
    () => new Map(options.map((option) => [option.value, optionLabel(option)])),
    [options]
  )
  const selectedSummary = selectedCodes
    .map((code) => labelsByCode.get(code) ?? code)
    .join(", ")
  const normalizedQuery = normalizeSearchText(query)
  const visibleOptions = normalizedQuery
    ? options.filter((option) =>
        normalizeSearchText(`${option.value} ${optionLabel(option)}`).includes(
          normalizedQuery
        )
      )
    : options

  useEffect(() => {
    setSelectedCodes(initialCodes)
  }, [initialCodes])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)

    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [isOpen])

  const toggleCode = (code: string) => {
    setSelectedCodes((current) =>
      current.includes(code)
        ? current.filter((currentCode) => currentCode !== code)
        : [...current, code]
    )
  }

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative flex w-48 flex-none flex-col gap-0.5 text-[11px] font-medium text-ds-text-muted",
        className
      )}
    >
      <span id={labelId}>{label}</span>
      {selectedCodes.map((code) => (
        <input key={code} type="hidden" name={name} value={code} />
      ))}
      <button
        type="button"
        aria-expanded={isOpen}
        aria-labelledby={labelId}
        className={cn(
          "flex h-(--ds-control-height-sm) w-full items-center justify-between gap-2 rounded-ds-md border border-ds-border bg-ds-surface px-2.5 text-left text-ds-sm text-ds-text-primary outline-none transition-colors hover:border-ds-border-strong focus-visible:border-ds-focus-ring focus-visible:ring-3 focus-visible:ring-ds-focus-ring/20",
          isOpen ? "border-ds-focus-ring ring-3 ring-ds-focus-ring/15" : ""
        )}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="min-w-0 flex-1 truncate">
          {selectedCodes.length > 0 ? selectedSummary : "Todos"}
        </span>
        {selectedCodes.length > 0 ? (
          <span className="rounded-full bg-ds-primary-soft px-1.5 py-0.5 text-[10px] font-semibold text-ds-primary">
            {selectedCodes.length}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="absolute left-0 top-[calc(100%+0.35rem)] z-50 w-80 max-w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-ds-md border border-ds-border bg-ds-surface shadow-ds-md">
          <div className="border-b border-ds-border-soft p-2">
            <div className="flex items-center gap-2 rounded-ds-sm border border-ds-border bg-ds-subtle px-2">
              <SearchIcon aria-hidden="true" className="size-3.5 text-ds-text-muted" />
              <input
                autoFocus
                className="h-8 min-w-0 flex-1 bg-transparent text-ds-xs text-ds-text-primary outline-none placeholder:text-ds-text-muted"
                placeholder="Buscar país"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              {query ? (
                <button
                  type="button"
                  className="rounded-ds-sm p-1 text-ds-text-muted hover:bg-ds-muted hover:text-ds-text-primary"
                  aria-label="Limpiar búsqueda"
                  onClick={() => setQuery("")}
                >
                  <XIcon aria-hidden="true" className="size-3.5" />
                </button>
              ) : null}
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 px-1 text-[11px] text-ds-text-muted">
              <span>
                {selectedCodes.length > 0
                  ? `${selectedCodes.length} seleccionados`
                  : "Todos los países"}
              </span>
              {selectedCodes.length > 0 ? (
                <button
                  type="button"
                  className="font-semibold text-ds-primary hover:text-ds-primary-strong"
                  onClick={() => setSelectedCodes([])}
                >
                  Limpiar
                </button>
              ) : null}
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto p-1.5">
            {visibleOptions.length > 0 ? (
              visibleOptions.map((option) => {
                const checked = selected.has(option.value)

                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={checked}
                    className="flex w-full items-center gap-2 rounded-ds-sm px-2 py-1.5 text-left text-ds-xs text-ds-text-primary hover:bg-ds-subtle"
                    onClick={() => toggleCode(option.value)}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded-ds-sm border",
                        checked
                          ? "border-ds-primary bg-ds-primary text-white"
                          : "border-ds-border bg-ds-surface"
                      )}
                    >
                      {checked ? <CheckIcon className="size-3" /> : null}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{optionLabel(option)}</span>
                  </button>
                )
              })
            ) : (
              <div className="px-2 py-5 text-center text-ds-xs text-ds-text-muted">
                Sin países para esta búsqueda.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export { CountryMultiFilter }
