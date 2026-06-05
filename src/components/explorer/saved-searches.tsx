"use client"

import { BookmarkIcon, ClockIcon, SearchIcon, Trash2Icon } from "lucide-react"
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

type ExplorerSearchMemoryProps = {
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

function readEntries(key: string) {
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
  current: Omit<SavedExplorerSearch, "id" | "createdAt" | "lastOpenedAt">,
) {
  const timestamp = nowIso()
  const existing = entries.find((entry) => entry.href === current.href)
  const next: SavedExplorerSearch = {
    ...current,
    id: existing?.id ?? crypto.randomUUID(),
    createdAt: existing?.createdAt ?? timestamp,
    lastOpenedAt: timestamp,
  }

  return [next, ...entries.filter((entry) => entry.href !== current.href)].slice(
    0,
    maxHistory,
  )
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
    return <p className="text-ds-sm text-ds-text-muted">{emptyLabel}</p>
  }

  return (
    <ul className="grid gap-2">
      {entries.map((entry) => (
        <li
          key={entry.id}
          className="grid gap-2 rounded-ds-md border border-ds-border-soft bg-ds-surface p-3 sm:grid-cols-[minmax(0,1fr)_auto]"
        >
          <div className="min-w-0">
            <Link
              className="block truncate text-ds-sm font-semibold text-ds-text-primary underline-offset-4 hover:underline"
              href={entry.href}
            >
              {entry.name}
            </Link>
            <p className="mt-1 truncate text-ds-xs text-ds-text-muted">
              {entry.filtersLabel}
            </p>
            <p className="mt-1 text-ds-xs text-ds-text-muted">
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

export function ExplorerSearchMemory({
  currentHref,
  defaultName,
  filtersLabel,
  viewLabel,
}: ExplorerSearchMemoryProps) {
  const [saved, setSaved] = React.useState<SavedExplorerSearch[]>([])
  const [history, setHistory] = React.useState<SavedExplorerSearch[]>([])
  const [name, setName] = React.useState(defaultName)
  const [mode, setMode] = React.useState<"saved" | "history" | "save">("saved")
  const [storageError, setStorageError] = React.useState(false)

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
    const next = [entry, ...saved.filter((item) => item.href !== currentHref)].slice(
      0,
      maxSaved,
    )

    setSaved(next)
    setStorageError(!writeEntries(savedKey, next))
    setMode("saved")
  }

  function deleteSavedSearch(id: string) {
    const next = saved.filter((entry) => entry.id !== id)
    setSaved(next)
    setStorageError(!writeEntries(savedKey, next))
  }

  return (
    <section className="rounded-ds-md border border-ds-border-soft bg-ds-surface">
      <div className="flex flex-wrap items-center gap-2 border-b border-ds-border-soft px-4 py-3">
        <div className="mr-auto min-w-0">
          <h2 className="text-ds-sm font-semibold text-ds-text-primary">
            Búsquedas de trabajo
          </h2>
          <p className="truncate text-ds-xs text-ds-text-muted">{filtersLabel}</p>
        </div>
        {[
          { id: "save", label: "Guardar", icon: BookmarkIcon },
          { id: "saved", label: "Guardadas", icon: SearchIcon },
          { id: "history", label: "Historial", icon: ClockIcon },
        ].map((item) => {
          const Icon = item.icon
          const active = mode === item.id

          return (
            <Button
              key={item.id}
              type="button"
              variant={active ? "primary" : "secondary"}
              size="product-md"
              onClick={() => setMode(item.id as typeof mode)}
            >
              <Icon aria-hidden="true" />
              {item.label}
            </Button>
          )
        })}
      </div>
      <div className="p-4">
        {mode === "save" ? (
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <label className="grid gap-1 text-ds-xs font-medium text-ds-text-secondary">
              Nombre de la búsqueda
              <input
                className="h-(--ds-control-height-lg) rounded-ds-md border border-ds-border bg-ds-surface px-3 text-ds-sm text-ds-text-primary outline-none focus-visible:ring-3 focus-visible:ring-ds-focus-ring/20"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <Button
              type="button"
              className="self-end"
              variant="primary"
              size="product"
              onClick={saveCurrentSearch}
            >
              Guardar búsqueda
            </Button>
          </div>
        ) : null}

        {mode === "saved" ? (
          <EntryList
            emptyLabel="Todavía no hay búsquedas guardadas en este navegador."
            entries={saved}
            onDelete={deleteSavedSearch}
          />
        ) : null}

        {mode === "history" ? (
          <EntryList
            emptyLabel="El historial aparecerá cuando uses filtros en el Explorador."
            entries={history}
          />
        ) : null}

        {storageError ? (
          <p className={cn("mt-3 text-ds-xs text-ds-warning")}>
            El navegador no permitió guardar esta información localmente.
          </p>
        ) : null}
      </div>
    </section>
  )
}
