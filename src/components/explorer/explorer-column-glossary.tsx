"use client"

import { BookTextIcon, XIcon } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ExplorerColumnGlossaryEntry = {
  help: string
  label: string
}

type ExplorerColumnGlossaryProps = {
  title: string
  entries: ExplorerColumnGlossaryEntry[]
  triggerLabel?: string
}

function ExplorerColumnGlossary({
  title,
  entries,
  triggerLabel = "Glosario de columnas",
}: ExplorerColumnGlossaryProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const headingId = useId()

  useEffect(() => {
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
    <div ref={containerRef} className="relative">
      <Button
        aria-controls={panelId}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        size="icon-sm"
        type="button"
        variant="ghost"
        className="text-ds-text-muted hover:text-ds-text-primary"
        onClick={() => setIsOpen((current) => !current)}
        title={triggerLabel}
        aria-label={triggerLabel}
      >
        <BookTextIcon aria-hidden="true" />
      </Button>
      {isOpen ? (
        <div
          id={panelId}
          role="dialog"
          aria-modal="false"
          aria-labelledby={headingId}
          className="absolute right-0 top-[calc(100%+0.4rem)] z-40 w-[min(28rem,calc(100vw-2rem))] overflow-hidden rounded-ds-md border border-ds-border bg-ds-surface shadow-ds-md"
        >
          <div className="flex items-center justify-between border-b border-ds-border-soft px-3 py-2">
            <h2
              id={headingId}
              className="text-ds-sm font-semibold text-ds-text-primary"
            >
              {title}
            </h2>
            <Button
              aria-label="Cerrar glosario"
              size="icon-xs"
              type="button"
              variant="ghost"
              onClick={() => setIsOpen(false)}
            >
              <XIcon aria-hidden="true" />
            </Button>
          </div>
          <dl className="max-h-[60vh] divide-y divide-ds-border-soft overflow-y-auto">
            {entries.map((entry) => (
              <div
                key={entry.label}
                className="grid gap-1 px-3 py-2 sm:grid-cols-[minmax(7rem,10rem)_minmax(0,1fr)] sm:gap-3"
              >
                <dt className="text-ds-xs font-semibold text-ds-text-secondary">
                  {entry.label}
                </dt>
                <dd
                  className={cn(
                    "text-ds-xs leading-(--ds-leading-normal) text-ds-text-secondary"
                  )}
                >
                  {entry.help}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </div>
  )
}

export { ExplorerColumnGlossary }
export type { ExplorerColumnGlossaryEntry, ExplorerColumnGlossaryProps }
