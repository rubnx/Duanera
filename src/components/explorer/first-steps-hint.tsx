"use client"

import { CommandIcon, LayoutGridIcon, LightbulbIcon, XIcon } from "lucide-react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const storageKey = "duanera.explorer.firstStepsHint.dismissed.v1"

type FirstStepsHintProps = {
  className?: string
}

function FirstStepsHint({ className }: FirstStepsHintProps) {
  const [visible, setVisible] = React.useState(false)

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    try {
      const stored = window.localStorage.getItem(storageKey)
      if (stored !== "1") {
        setVisible(true)
      }
    } catch {
      setVisible(true)
    }
  }, [])

  if (!visible) {
    return null
  }

  const dismiss = () => {
    try {
      window.localStorage.setItem(storageKey, "1")
    } catch {
      // ignore
    }
    setVisible(false)
  }

  const tips: Array<{ icon: React.ReactNode; title: string; body: string }> = [
    {
      icon: <CommandIcon aria-hidden="true" className="size-3.5" />,
      title: "Atajos",
      body: "Pulsa ⌘K para buscar acciones, partidas o productos.",
    },
    {
      icon: <LayoutGridIcon aria-hidden="true" className="size-3.5" />,
      title: "Vistas",
      body: "Cambia entre Resumen, Valores, Logística, Producto y Fuente.",
    },
    {
      icon: <LightbulbIcon aria-hidden="true" className="size-3.5" />,
      title: "Glosario",
      body: "Pasa el cursor sobre un encabezado para ver qué significa.",
    },
  ]

  return (
    <aside
      aria-label="Primeros pasos en el Explorador"
      className={cn(
        "flex flex-wrap items-start gap-3 rounded-ds-md border border-ds-primary-soft bg-ds-primary-softer px-3 py-2.5 text-ds-xs text-ds-text-secondary",
        className
      )}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2">
        <span className="font-semibold text-ds-text-primary">
          Tres teclas para empezar
        </span>
        {tips.map((tip) => (
          <span
            key={tip.title}
            className="inline-flex items-center gap-1.5 text-ds-text-secondary"
          >
            <span className="inline-flex size-5 items-center justify-center rounded-ds-sm bg-ds-surface text-ds-primary shadow-ds-xs">
              {tip.icon}
            </span>
            <span className="font-semibold text-ds-text-primary">
              {tip.title}:
            </span>
            <span>{tip.body}</span>
          </span>
        ))}
      </div>
      <Button
        aria-label="Cerrar sugerencia de primeros pasos"
        size="icon-xs"
        type="button"
        variant="ghost"
        onClick={dismiss}
      >
        <XIcon aria-hidden="true" />
      </Button>
    </aside>
  )
}

export { FirstStepsHint }
