"use client"

import { InfoIcon } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"

import { cn } from "@/lib/utils"

type JargonHintProps = {
  className?: string
  term: string
}

function JargonHint({ className, term }: JargonHintProps) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const wrapperRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    function onPointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false)
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
      ref={wrapperRef}
      className={cn("group/jargon relative inline-flex", className)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false)
        }
      }}
    >
      <button
        type="button"
        aria-describedby={open ? id : undefined}
        aria-label={`Qué significa ${term}`}
        onClick={() => setOpen((current) => !current)}
        onFocus={() => setOpen(true)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className={cn(
          "inline-flex size-4 items-center justify-center rounded-full align-middle text-ds-text-muted transition-colors hover:text-ds-text-primary focus-visible:text-ds-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-focus-ring/25"
        )}
      >
        <InfoIcon aria-hidden="true" className="size-3" />
      </button>
      <span
        id={id}
        role="tooltip"
        className={cn(
          "pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 w-56 max-w-[calc(100vw-2rem)] -translate-x-1/2 whitespace-normal rounded-ds-sm bg-ds-text-primary px-2 py-1.5 text-left text-ds-xs font-medium leading-tight text-ds-text-inverse opacity-0 shadow-ds-md transition-opacity delay-150",
          open ? "visible opacity-100" : "invisible",
          "group-hover/jargon:visible group-hover/jargon:opacity-100 group-focus-within/jargon:visible group-focus-within/jargon:opacity-100"
        )}
      >
        {term}
      </span>
    </span>
  )
}

export { JargonHint }
export type { JargonHintProps }
