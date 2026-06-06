"use client"

import { Rows3Icon, Rows4Icon } from "lucide-react"
import { useEffect, useState } from "react"

import { cn } from "@/lib/utils"

type Density = "comfortable" | "compact"

const STORAGE_KEY = "explorer-density"

const densityOptions: Array<{
  id: Density
  label: string
  icon: typeof Rows3Icon
}> = [
  { id: "comfortable", label: "Cómoda", icon: Rows3Icon },
  { id: "compact", label: "Compacta", icon: Rows4Icon },
]

function applyDensity(density: Density) {
  if (typeof document === "undefined") {
    return
  }

  const shells = document.querySelectorAll<HTMLElement>(
    "[data-slot=data-table-shell]"
  )

  for (const shell of shells) {
    if (density === "compact") {
      shell.style.setProperty("--ds-table-row-height", "40px")
      shell.style.setProperty("--ds-table-cell-y", "4px")
    } else {
      shell.style.removeProperty("--ds-table-row-height")
      shell.style.removeProperty("--ds-table-cell-y")
    }
  }
}

function ExplorerDensityToggle({ compact = false }: { compact?: boolean }) {
  const [density, setDensity] = useState<Density>("comfortable")

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved === "compact" || saved === "comfortable") {
      setDensity(saved)
    }
  }, [])

  useEffect(() => {
    applyDensity(density)
  }, [density])

  const handleSelect = (next: Density) => {
    setDensity(next)
    window.localStorage.setItem(STORAGE_KEY, next)
  }

  return (
    <div
      aria-label="Densidad de la tabla"
      className={cn(
        "flex items-center rounded-ds-md border border-ds-border-soft bg-ds-surface p-0.5",
        compact ? "gap-px" : "gap-0.5"
      )}
      role="group"
    >
      {densityOptions.map((option) => {
        const active = option.id === density
        const Icon = option.icon

        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            aria-label={`Densidad ${option.label}`}
            title={`Densidad ${option.label}`}
            className={cn(
              "inline-flex items-center gap-1 rounded-ds-sm text-ds-xs font-semibold transition-colors duration-(--ds-duration-fast) ease-(--ds-ease-standard)",
              compact
                ? "size-7 justify-center"
                : "h-8 px-2",
              active
                ? "bg-ds-subtle text-ds-text-primary shadow-ds-xs"
                : "text-ds-text-muted hover:bg-ds-subtle hover:text-ds-text-primary"
            )}
            onClick={() => handleSelect(option.id)}
          >
            <Icon aria-hidden="true" className="size-4" />
            {compact ? null : (
              <span className="hidden sm:inline">{option.label}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export { ExplorerDensityToggle }
