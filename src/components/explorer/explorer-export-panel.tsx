"use client"

import { CheckIcon, DownloadIcon, SlidersHorizontalIcon } from "lucide-react"
import Link from "next/link"
import { useEffect, useId, useMemo, useRef, useState } from "react"

import { buttonVariants } from "@/components/ui/button"
import type { TradeRecordExportPlan } from "@/trade/trade-record-export"
import { cn } from "@/lib/utils"

function exportHrefWithColumns(exportHref: string, selectedColumnKeys: string[]) {
  const [path, query = ""] = exportHref.split("?")
  const params = new URLSearchParams(query)

  if (selectedColumnKeys.length > 0) {
    params.set("columns", selectedColumnKeys.join(","))
  } else {
    params.delete("columns")
  }

  const text = params.toString()
  return text ? `${path}?${text}` : (path ?? exportHref)
}

function exportRowLabel(plan: TradeRecordExportPlan) {
  return plan.estimatedRows === null
    ? "sin conteo"
    : `${plan.estimatedRows.toLocaleString("es-CL")} registros`
}

function exportStatusText(plan: TradeRecordExportPlan) {
  return plan.allowed
    ? "Lista para descargar: búsqueda acotada y dentro del tope."
    : "No disponible todavía: revisa las advertencias y acota la búsqueda."
}

function ExplorerExportPanel({
  exportHref,
  plan,
}: {
  exportHref: string
  plan: TradeRecordExportPlan
}) {
  const panelId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const defaultColumnKeys = useMemo(
    () => plan.columns.map((column) => column.key),
    [plan.columns]
  )
  const [isOpen, setIsOpen] = useState(false)
  const [selectedColumnKeys, setSelectedColumnKeys] = useState(defaultColumnKeys)
  const selectedColumnSet = useMemo(
    () => new Set(selectedColumnKeys),
    [selectedColumnKeys]
  )
  const selectedCount = selectedColumnKeys.length
  const allCount = plan.availableColumns.length
  const canDownload = plan.allowed && selectedCount > 0
  const downloadHref = exportHrefWithColumns(exportHref, selectedColumnKeys)

  useEffect(() => {
    setSelectedColumnKeys(defaultColumnKeys)
  }, [defaultColumnKeys])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Node && rootRef.current?.contains(target)) {
        return
      }
      setIsOpen(false)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false)
      }
    }

    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)

    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [isOpen])

  const toggleColumn = (columnKey: string) => {
    setSelectedColumnKeys((current) =>
      current.includes(columnKey)
        ? current.filter((key) => key !== columnKey)
        : [...current, columnKey]
    )
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-controls={panelId}
        aria-expanded={isOpen}
        className={cn(buttonVariants({ variant: "secondary", size: "product-md" }))}
        onClick={() => setIsOpen((current) => !current)}
      >
        <DownloadIcon aria-hidden="true" />
        Exportar
      </button>
      {isOpen ? (
        <div
          id={panelId}
          className="absolute right-0 top-[calc(100%+0.45rem)] z-50 w-100 max-w-[calc(100vw-2rem)] overflow-hidden rounded-ds-md border border-ds-border bg-ds-surface shadow-ds-md"
        >
          <div className="border-b border-ds-border-soft px-3 py-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-ds-sm font-semibold text-ds-text-primary">
                  <SlidersHorizontalIcon aria-hidden="true" className="size-3.5" />
                  Exportación XLSX
                </div>
                <p className="mt-0.5 text-ds-xs text-ds-text-muted">
                  {plan.viewLabel} · {exportRowLabel(plan)} · tope{" "}
                  {plan.rowCap.toLocaleString("es-CL")}
                </p>
                <p className="mt-1 text-ds-xs text-ds-text-secondary">
                  {exportStatusText(plan)}
                </p>
              </div>
              <div
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-ds-xs font-semibold",
                  plan.allowed
                    ? "bg-ds-success-soft text-ds-success"
                    : "bg-ds-warning-soft text-ds-warning"
                )}
              >
                {plan.allowed ? "Permitida" : "Bloqueada"}
              </div>
            </div>
          </div>

          <div className="max-h-96 overflow-auto px-3 py-2">
            {plan.warnings.length > 0 ? (
              <div className="mb-2 rounded-ds-md border border-ds-warning-border bg-ds-warning-soft p-2 text-ds-xs text-ds-warning">
                <div className="font-semibold">Antes de descargar</div>
                <ul className="mt-1 list-disc space-y-1 pl-4">
                  {plan.warnings.map((warning) => (
                    <li key={warning.code}>{warning.message}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-2">
              <div className="text-ds-xs font-semibold text-ds-text-primary">
                Columnas
                <span className="ml-1 font-normal text-ds-text-muted">
                  {selectedCount} de {allCount}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="rounded-ds-sm px-1.5 py-1 text-ds-xs font-medium text-ds-primary hover:bg-ds-primary-soft"
                  onClick={() =>
                    setSelectedColumnKeys(plan.availableColumns.map((column) => column.key))
                  }
                >
                  Todas
                </button>
                <button
                  type="button"
                  className="rounded-ds-sm px-1.5 py-1 text-ds-xs font-medium text-ds-text-muted hover:bg-ds-muted hover:text-ds-text-primary"
                  onClick={() => setSelectedColumnKeys([])}
                >
                  Ninguna
                </button>
              </div>
            </div>

            <div className="mt-2 grid gap-1.5">
              {plan.availableColumns.map((column) => {
                const checked = selectedColumnSet.has(column.key)

                return (
                  <label
                    key={column.key}
                    className="flex cursor-pointer items-center gap-2 rounded-ds-sm border border-transparent px-2 py-1.5 text-ds-xs text-ds-text-primary hover:border-ds-border-soft hover:bg-ds-subtle"
                  >
                    <input
                      type="checkbox"
                      className="size-3.5 accent-ds-primary"
                      checked={checked}
                      onChange={() => toggleColumn(column.key)}
                    />
                    <span className="min-w-0 flex-1 truncate">{column.label}</span>
                    {checked ? (
                      <CheckIcon aria-hidden="true" className="size-3 text-ds-primary" />
                    ) : null}
                  </label>
                )
              })}
            </div>

            <ul className="mt-2 space-y-1 border-t border-ds-border-soft pt-2 text-ds-xs leading-(--ds-leading-normal) text-ds-text-muted">
              {plan.caveats.map((caveat) => (
                <li key={caveat}>{caveat}</li>
              ))}
            </ul>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-ds-border-soft bg-ds-subtle px-3 py-2">
            <div className="text-ds-xs text-ds-text-muted">
              {selectedCount === 0
                ? "Selecciona al menos una columna."
                : `${selectedCount} columnas seleccionadas.`}
            </div>
            {canDownload ? (
              <Link
                className={cn(buttonVariants({ variant: "primary", size: "product-md" }))}
                href={downloadHref}
              >
                <DownloadIcon aria-hidden="true" />
                Descargar
              </Link>
            ) : (
              <span
                aria-disabled="true"
                className={cn(
                  buttonVariants({ variant: "secondary", size: "product-md" }),
                  "pointer-events-none opacity-55"
                )}
              >
                <DownloadIcon aria-hidden="true" />
                Descargar
              </span>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export { ExplorerExportPanel }
