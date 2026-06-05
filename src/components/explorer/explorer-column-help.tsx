"use client"

import { HelpCircleIcon } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"

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
  const [hoverOpen, setHoverOpen] = useState(false)
  const [pinnedOpen, setPinnedOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement>(null)
  const tooltipId = useId()
  const open = hoverOpen || pinnedOpen

  useEffect(() => {
    if (!open) {
      return
    }

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setHoverOpen(false)
        setPinnedOpen(false)
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setHoverOpen(false)
        setPinnedOpen(false)
      }
    }

    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)

    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  return (
    <span
      ref={rootRef}
      className="group/help relative inline-flex shrink-0"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setHoverOpen(false)
          setPinnedOpen(false)
        }
      }}
      onMouseEnter={() => setHoverOpen(true)}
      onMouseLeave={() => setHoverOpen(false)}
    >
      <button
        aria-controls={tooltipId}
        aria-expanded={open}
        aria-label={`Qué significa ${label}`}
        className="inline-flex size-3.5 items-center justify-center rounded-ds-xs text-ds-text-muted outline-none transition-colors hover:bg-ds-surface hover:text-ds-text-primary focus-visible:bg-ds-surface focus-visible:text-ds-text-primary focus-visible:ring-2 focus-visible:ring-ds-focus-ring/25"
        onClick={() => setPinnedOpen(true)}
        onFocus={() => setHoverOpen(true)}
        type="button"
      >
        <HelpCircleIcon aria-hidden="true" className="size-3" />
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        className={cn(
          "pointer-events-none absolute top-full z-30 mt-1.5 w-56 max-w-[calc(100vw-2rem)] whitespace-normal rounded-ds-sm bg-ds-text-primary px-2 py-1.5 text-left text-[11px] font-medium leading-tight text-ds-text-inverse opacity-0 shadow-ds-md transition-opacity",
          open ? "visible opacity-100" : "invisible opacity-0",
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
