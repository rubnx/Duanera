"use client"

import { ChevronDownIcon } from "lucide-react"
import * as React from "react"

import { cn } from "@/lib/utils"

type ExplorerDisclosureProps = {
  children: React.ReactNode
  defaultOpen?: boolean
  description?: string
  openParam?: "open" | "closed"
  storageKey?: string
  summary?: React.ReactNode
  title: string
  urlOpenParamName?: string
}

function isStoredOpen(value: string | null | undefined) {
  return value === "1" || value === "true"
}

function ExplorerDisclosure({
  children,
  defaultOpen = false,
  description,
  openParam = "open",
  storageKey,
  summary,
  title,
  urlOpenParamName = "desglose",
}: ExplorerDisclosureProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen)
  const [hydrated, setHydrated] = React.useState(false)
  const contentId = React.useId()

  React.useEffect(() => {
    if (!storageKey) {
      setHydrated(true)
      return
    }

    try {
      const stored = window.localStorage.getItem(storageKey)
      if (stored !== null) {
        setIsOpen(isStoredOpen(stored))
      }
    } catch {
      // ignore
    } finally {
      setHydrated(true)
    }
  }, [storageKey])

  React.useEffect(() => {
    if (!hydrated || !storageKey) {
      return
    }

    try {
      window.localStorage.setItem(storageKey, isOpen ? "1" : "0")
    } catch {
      // ignore
    }
  }, [hydrated, isOpen, storageKey])

  const handleToggle = () => {
    setIsOpen((current) => !current)
  }

  return (
    <section
      aria-label={title}
      className="rounded-ds-md border border-ds-border-soft bg-ds-surface"
    >
      <button
        type="button"
        aria-controls={contentId}
        aria-expanded={isOpen}
        onClick={handleToggle}
        className={cn(
          "flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors",
          "hover:bg-ds-muted/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ds-focus-ring/20"
        )}
      >
        <ChevronDownIcon
          aria-hidden="true"
          className={cn(
            "size-4 shrink-0 text-ds-text-muted transition-transform duration-(--ds-duration-fast) ease-(--ds-ease-standard)",
            isOpen ? "rotate-0" : "-rotate-90"
          )}
        />
        <span className="min-w-0 flex-1">
          <span className="block text-ds-sm font-bold text-ds-text-primary">
            {title}
          </span>
          {description ? (
            <span className="mt-0.5 block truncate text-ds-xs text-ds-text-muted">
              {description}
            </span>
          ) : null}
        </span>
        {summary}
        <span
          aria-hidden="true"
          className="shrink-0 text-ds-xs font-medium text-ds-text-muted"
        >
          {isOpen ? "Ocultar" : openParam === "closed" ? "Mostrar" : "Ver"}
        </span>
      </button>
      {isOpen ? (
        <div
          id={contentId}
          data-url-param={urlOpenParamName}
          className="border-t border-ds-border-soft"
        >
          {children}
        </div>
      ) : null}
    </section>
  )
}

export { ExplorerDisclosure }
export type { ExplorerDisclosureProps }
