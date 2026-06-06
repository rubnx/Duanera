"use client"

import {
  BookmarkIcon,
  ClockIcon,
  SearchIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import Link from "next/link"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type SavedExplorerSearch = {
  id: string
  name: string
  href: string
  filtersLabel: string
  viewLabel: string
  createdAt: string
  lastOpenedAt: string
}

type ExplorerSearchesPanelProps = {
  currentHref: string
  defaultName: string
  filtersLabel: string
  viewLabel: string
}

const savedKey = "duanera.explorer.savedSearches.v1"
const historyKey = "duanera.explorer.searchHistory.v1"
const maxSaved = 30
const maxHistory = 15

function nowIso() {
  return new Date().toISOString()
}

function readEntries(key: string): SavedExplorerSearch[] {
  if (typeof window === "undefined") {
    return []
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "[]")
    return Array.isArray(parsed) ? (parsed as SavedExplorerSearch[]) : []
  } catch {
    return []
  }
}

function writeEntries(key: string, entries: SavedExplorerSearch[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(entries))
    return true
  } catch {
    return false
  }
}

function upsertHistory(
  entries: SavedExplorerSearch[],
  current: Omit<SavedExplorerSearch, "id" | "createdAt" | "lastOpenedAt">
) {
  const timestamp = nowIso()
  const existing = entries.find((entry) => entry.href === current.href)
  const next: SavedExplorerSearch = {
    ...current,
    id: existing?.id ?? crypto.randomUUID(),
    createdAt: existing?.createdAt ?? timestamp,
    lastOpenedAt: timestamp,
  }

  return [
    next,
    ...entries.filter((entry) => entry.href !== current.href),
  ].slice(0, maxHistory)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  }).format(new Date(value))
}

function EntryList({
  emptyLabel,
  entries,
  onDelete,
}: {
  emptyLabel: string
  entries: SavedExplorerSearch[]
  onDelete?: (id: string) => void
}) {
  if (entries.length === 0) {
    return <p className="text-ds-xs text-ds-text-muted">{emptyLabel}</p>
  }

  return (
    <ul className="grid gap-1.5">
      {entries.map((entry) => (
        <li
          key={entry.id}
          className="grid gap-1.5 rounded-ds-md border border-ds-border-soft bg-ds-surface p-2.5 sm:grid-cols-[minmax(0,1fr)_auto]"
        >
          <div className="min-w-0">
            <Link
              className="block truncate text-ds-sm font-semibold text-ds-text-primary underline-offset-4 hover:underline"
              href={entry.href}
            >
              {entry.name}
            </Link>
            <p className="mt-0.5 truncate text-ds-xs text-ds-text-muted">
              {entry.filtersLabel}
            </p>
            <p className="mt-0.5 text-ds-xs text-ds-text-muted">
              {entry.viewLabel} · {formatDate(entry.lastOpenedAt)}
            </p>
          </div>
          {onDelete ? (
            <Button
              type="button"
              variant="ghost"
              size="product-icon-sm"
              aria-label={`Eliminar ${entry.name}`}
              onClick={() => onDelete(entry.id)}
            >
              <Trash2Icon aria-hidden="true" />
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

function useSearchMemory({
  currentHref,
  defaultName,
  filtersLabel,
  viewLabel,
}: ExplorerSearchesPanelProps) {
  const [saved, setSaved] = React.useState<SavedExplorerSearch[]>([])
  const [history, setHistory] = React.useState<SavedExplorerSearch[]>([])
  const [name, setName] = React.useState(defaultName)
  const [mode, setMode] = React.useState<"save" | "saved" | "history">("saved")
  const [storageError, setStorageError] = React.useState(false)
  const [hydrated, setHydrated] = React.useState(false)

  React.useEffect(() => {
    const savedEntries = readEntries(savedKey)
    const historyEntries = upsertHistory(readEntries(historyKey), {
      name: defaultName,
      href: currentHref,
      filtersLabel,
      viewLabel,
    })

    setSaved(savedEntries)
    setHistory(historyEntries)
    setStorageError(!writeEntries(historyKey, historyEntries))
    setHydrated(true)
  }, [currentHref, defaultName, filtersLabel, viewLabel])

  function saveCurrentSearch() {
    const timestamp = nowIso()
    const entry: SavedExplorerSearch = {
      id: crypto.randomUUID(),
      name: name.trim() || defaultName,
      href: currentHref,
      filtersLabel,
      viewLabel,
      createdAt: timestamp,
      lastOpenedAt: timestamp,
    }
    const next = [
      entry,
      ...saved.filter((item) => item.href !== currentHref),
    ].slice(0, maxSaved)

    setSaved(next)
    setStorageError(!writeEntries(savedKey, next))
    setMode("saved")
  }

  function deleteSavedSearch(id: string) {
    const next = saved.filter((entry) => entry.id !== id)
    setSaved(next)
    setStorageError(!writeEntries(savedKey, next))
  }

  return {
    deleteSavedSearch,
    hydrated,
    history,
    mode,
    name,
    saved,
    saveCurrentSearch,
    setMode,
    setName,
    storageError,
  }
}

type ExplorerSearchesPanelContentProps = ExplorerSearchesPanelProps & {
  embedded?: boolean
  onRequestClose?: () => void
}

function ExplorerSearchesPanelContent({
  currentHref,
  defaultName,
  filtersLabel,
  viewLabel,
  embedded = false,
  onRequestClose,
}: ExplorerSearchesPanelContentProps) {
  const memory = useSearchMemory({
    currentHref,
    defaultName,
    filtersLabel,
    viewLabel,
  })

  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        embedded ? "p-3" : "p-4"
      )}
    >
      <div
        role="tablist"
        aria-label="Búsquedas de trabajo"
        className="flex flex-wrap gap-1 rounded-ds-md border border-ds-border-soft bg-ds-muted p-0.5"
      >
        {[
          { id: "save", label: "Guardar", icon: BookmarkIcon },
          { id: "saved", label: "Guardadas", icon: SearchIcon },
          { id: "history", label: "Historial", icon: ClockIcon },
        ].map((item) => {
          const Icon = item.icon
          const active = memory.mode === item.id
          const tabId = `tab-${item.id}`
          const panelId = `panel-${item.id}`

          return (
            <button
              key={item.id}
              id={tabId}
              role="tab"
              type="button"
              aria-selected={active}
              aria-controls={panelId}
              className={cn(
                "inline-flex h-8 items-center gap-1 rounded-ds-sm px-2.5 text-ds-xs font-semibold transition-colors duration-(--ds-duration-fast) ease-(--ds-ease-standard)",
                active
                  ? "bg-ds-surface text-ds-text-primary shadow-ds-xs"
                  : "text-ds-text-muted hover:bg-ds-surface/80 hover:text-ds-text-primary"
              )}
              onClick={() => memory.setMode(item.id as typeof memory.mode)}
            >
              <Icon aria-hidden="true" className="size-3.5" />
              {item.label}
              {item.id === "saved" ? (
                <span className="ml-0.5 text-ds-xs tabular-nums text-ds-text-muted">
                  {memory.saved.length}
                </span>
              ) : null}
              {item.id === "history" ? (
                <span className="ml-0.5 text-ds-xs tabular-nums text-ds-text-muted">
                  {memory.history.length}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      <div
        role="tabpanel"
        id={`panel-${memory.mode}`}
        aria-labelledby={`tab-${memory.mode}`}
      >
        {memory.mode === "save" ? (
          <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto]">
            <label className="grid gap-1 text-ds-xs font-medium text-ds-text-secondary">
              Nombre de la búsqueda
              <input
                className="h-(--ds-control-height-md) rounded-ds-md border border-ds-border bg-ds-surface px-3 text-ds-sm text-ds-text-primary outline-none focus-visible:ring-3 focus-visible:ring-ds-focus-ring/20"
                value={memory.name}
                onChange={(event) => memory.setName(event.target.value)}
              />
            </label>
            <Button
              type="button"
              className="self-end"
              variant="primary"
              size="product-md"
              onClick={() => {
                memory.saveCurrentSearch()
              }}
            >
              Guardar búsqueda
            </Button>
          </div>
        ) : null}

        {memory.mode === "saved" ? (
          <EntryList
            emptyLabel="Todavía no hay búsquedas guardadas en este navegador."
            entries={memory.saved}
            onDelete={memory.deleteSavedSearch}
          />
        ) : null}

        {memory.mode === "history" ? (
          <EntryList
            emptyLabel="El historial aparecerá cuando uses filtros en el Explorador."
            entries={memory.history}
          />
        ) : null}

        {memory.storageError ? (
          <p className="mt-2 text-ds-xs text-ds-warning">
            El navegador no permitió guardar esta información localmente.
          </p>
        ) : null}
      </div>

      {onRequestClose ? (
        <div className="flex justify-end border-t border-ds-border-soft pt-2">
          <Button
            type="button"
            size="product-md"
            variant="secondary"
            onClick={onRequestClose}
          >
            Cerrar
          </Button>
        </div>
      ) : null}
    </div>
  )
}

type ExplorerSearchesPopoverProps = ExplorerSearchesPanelProps & {
  className?: string
  triggerLabel?: string
}

function ExplorerSearchesPopover({
  className,
  currentHref,
  defaultName,
  filtersLabel,
  viewLabel,
  triggerLabel = "Búsquedas",
}: ExplorerSearchesPopoverProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [savedCount, setSavedCount] = React.useState(0)
  const [historyCount, setHistoryCount] = React.useState(0)

  React.useEffect(() => {
    setSavedCount(readEntries(savedKey).length)
    setHistoryCount(readEntries(historyKey).length)
  }, [isOpen])

  React.useEffect(() => {
    if (!isOpen) {
      return
    }

    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    function onKeyDown(event: KeyboardEvent) {
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

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <Button
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        size="product-md"
        type="button"
        variant="secondary"
        onClick={() => setIsOpen((current) => !current)}
      >
        <BookmarkIcon aria-hidden="true" />
        {triggerLabel}
        {(savedCount + historyCount) > 0 ? (
          <span
            aria-label={`${savedCount + historyCount} búsquedas guardadas`}
            className="ml-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-ds-primary-soft text-[10px] font-semibold leading-none tabular-nums text-ds-primary"
          >
            {savedCount + historyCount}
          </span>
        ) : null}
      </Button>
      {isOpen ? (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="Búsquedas de trabajo"
          className="absolute right-0 top-[calc(100%+0.4rem)] z-40 w-[min(28rem,calc(100vw-2rem))] overflow-hidden rounded-ds-md border border-ds-border bg-ds-surface shadow-ds-md"
        >
          <div className="flex items-center justify-between border-b border-ds-border-soft px-3 py-2">
            <h2 className="text-ds-sm font-semibold text-ds-text-primary">
              Búsquedas de trabajo
            </h2>
            <Button
              aria-label="Cerrar búsquedas"
              size="icon-xs"
              type="button"
              variant="ghost"
              onClick={() => setIsOpen(false)}
            >
              <XIcon aria-hidden="true" />
            </Button>
          </div>
          <ExplorerSearchesPanelContent
            currentHref={currentHref}
            defaultName={defaultName}
            filtersLabel={filtersLabel}
            viewLabel={viewLabel}
            embedded
            onRequestClose={() => setIsOpen(false)}
          />
        </div>
      ) : null}
    </div>
  )
}

export {
  ExplorerSearchesPanelContent,
  ExplorerSearchesPopover,
  useSearchMemory,
}
export type {
  ExplorerSearchesPanelContentProps,
  ExplorerSearchesPanelProps,
  ExplorerSearchesPopoverProps,
  SavedExplorerSearch,
}
