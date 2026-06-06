"use client"

import { HelpCircleIcon } from "lucide-react"
import { useEffect, useId, useState } from "react"

import { cn } from "@/lib/utils"

type ExplorerColumnHelpProps = {
  align?: "center" | "end" | "start"
  help: string
  label: string
}

function ExplorerColumnHelp({
  align = "center",
  help,
  label,
}: ExplorerColumnHelpProps) {
  const [pinnedOpen, setPinnedOpen] = useState(false)
  const tooltipId = useId()

  useEffect(() => {
    if (!pinnedOpen) {
      return
    }

    function onPointerDown(event: PointerEvent) {
      if (!(event.target as HTMLElement | null)?.closest?.(`[data-column-help="${tooltipId}"]`)) {
        setPinnedOpen(false)
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPinnedOpen(false)
      }
    }

    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)

    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [pinnedOpen, tooltipId])

  return (
    <span
      data-column-help={tooltipId}
      className="group/help relative inline-flex shrink-0"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setPinnedOpen(false)
        }
      }}
    >
      <button
        aria-controls={tooltipId}
        aria-expanded={pinnedOpen}
        aria-label={`Qué significa ${label}`}
        className={cn(
          "inline-flex size-5 items-center justify-center rounded-ds-sm text-ds-text-muted outline-none transition-opacity hover:text-ds-text-primary focus-visible:text-ds-text-primary focus-visible:ring-2 focus-visible:ring-ds-focus-ring/25",
          "opacity-0 group-hover/help:opacity-100 group-focus-within/help:opacity-100 data-[pinned=true]:opacity-100",
          pinnedOpen ? "data-[pinned=true]" : ""
        )}
        data-pinned={pinnedOpen || undefined}
        onClick={() => setPinnedOpen((current) => !current)}
        type="button"
      >
        <HelpCircleIcon aria-hidden="true" className="size-3" />
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        className={cn(
          "pointer-events-none absolute top-full z-30 mt-1.5 w-56 max-w-[calc(100vw-2rem)] whitespace-normal rounded-ds-sm bg-ds-text-primary px-2 py-1.5 text-left text-ds-xs font-medium leading-tight text-ds-text-inverse opacity-0 shadow-ds-md transition-opacity delay-150",
          "group-hover/help:visible group-hover/help:opacity-100 group-focus-within/help:visible group-focus-within/help:opacity-100",
          pinnedOpen ? "visible opacity-100" : "invisible",
          align === "start"
            ? "left-0"
            : align === "end"
              ? "right-0"
              : "left-1/2 -translate-x-1/2"
        )}
      >
        {help}
      </span>
    </span>
  )
}

export { ExplorerColumnHelp }
