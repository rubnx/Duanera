"use client"

import {
  BoxIcon,
  Building2Icon,
  DatabaseIcon,
  FileTextIcon,
  HashIcon,
  SearchIcon,
  ShieldCheckIcon,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type CommandAction = {
  id: string
  label: string
  hint?: string
  icon: ReactNode
  keywords?: string
  run: (router: ReturnType<typeof useRouter>) => void
}

const staticActions: CommandAction[] = [
  {
    id: "nav-explorer",
    label: "Ir al Explorador",
    hint: "Navegación",
    icon: <SearchIcon aria-hidden="true" className="size-4" />,
    keywords: "explorador buscar registros",
    run: (router) => router.push("/explorer"),
  },
  {
    id: "nav-records",
    label: "Ir a Registros",
    hint: "Navegación",
    icon: <FileTextIcon aria-hidden="true" className="size-4" />,
    keywords: "registros trade records",
    run: (router) => router.push("/trade-records"),
  },
  {
    id: "nav-sources",
    label: "Ir a Fuentes",
    hint: "Navegación",
    icon: <DatabaseIcon aria-hidden="true" className="size-4" />,
    keywords: "fuentes sources archivos",
    run: (router) => router.push("/sources"),
  },
  {
    id: "nav-quality",
    label: "Ir a Calidad de datos",
    hint: "Navegación",
    icon: <ShieldCheckIcon aria-hidden="true" className="size-4" />,
    keywords: "calidad datos quality",
    run: (router) => router.push("/data-quality"),
  },
  {
    id: "flow-import",
    label: "Ver importaciones",
    hint: "Filtro",
    icon: <BoxIcon aria-hidden="true" className="size-4" />,
    keywords: "importaciones import flujo",
    run: (router) => router.push("/explorer?tradeFlow=import"),
  },
  {
    id: "flow-export",
    label: "Ver exportaciones",
    hint: "Filtro",
    icon: <Building2Icon aria-hidden="true" className="size-4" />,
    keywords: "exportaciones export flujo",
    run: (router) => router.push("/explorer?tradeFlow=export"),
  },
]

function buildDynamicActions(query: string): CommandAction[] {
  const trimmed = query.trim()
  if (!trimmed) {
    return []
  }

  const actions: CommandAction[] = []
  const digits = trimmed.replace(/\D/g, "")

  if (digits.length >= 2) {
    actions.push({
      id: "dynamic-hs",
      label: `Filtrar por partida ${digits}`,
      hint: "Partida arancelaria",
      icon: <HashIcon aria-hidden="true" className="size-4" />,
      run: (router) =>
        router.push(`/explorer?hsCodePrefix=${encodeURIComponent(digits)}`),
    })
  }

  actions.push({
    id: "dynamic-product",
    label: `Buscar producto "${trimmed}"`,
    hint: "Búsqueda",
    icon: <SearchIcon aria-hidden="true" className="size-4" />,
    run: (router) => router.push(`/explorer?q=${encodeURIComponent(trimmed)}`),
  })

  return actions
}

function ExplorerCommandPalette() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const close = useCallback(() => {
    setIsOpen(false)
    setQuery("")
    setActiveIndex(0)
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setIsOpen((current) => !current)
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  useEffect(() => {
    if (isOpen) {
      const id = window.setTimeout(() => inputRef.current?.focus(), 10)
      return () => window.clearTimeout(id)
    }
  }, [isOpen])

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    const matched = normalized
      ? staticActions.filter((action) =>
          `${action.label} ${action.keywords ?? ""}`
            .toLowerCase()
            .includes(normalized)
        )
      : staticActions

    return [...buildDynamicActions(query), ...matched]
  }, [query])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  const runAction = useCallback(
    (action: CommandAction | undefined) => {
      if (!action) {
        return
      }
      close()
      action.run(router)
    },
    [close, router]
  )

  const handleInputKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActiveIndex((current) => Math.min(current + 1, results.length - 1))
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActiveIndex((current) => Math.max(current - 1, 0))
    } else if (event.key === "Enter") {
      event.preventDefault()
      runAction(results[activeIndex])
    } else if (event.key === "Escape") {
      event.preventDefault()
      close()
    }
  }

  if (!isOpen) {
    return null
  }

  return (
    <div
      aria-hidden={false}
      className="fixed inset-0 z-50 flex items-start justify-center bg-ds-text-primary/30 px-4 pt-[12vh] backdrop-blur-sm"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          close()
        }
      }}
    >
      <div
        role="dialog"
        aria-label="Acciones rápidas"
        aria-modal="true"
        className="w-full max-w-xl overflow-hidden rounded-ds-lg border border-ds-border bg-ds-surface shadow-ds-panel"
      >
        <div className="flex items-center gap-2 border-b border-ds-border-soft px-3">
          <SearchIcon
            aria-hidden="true"
            className="size-(--ds-icon-md) shrink-0 text-ds-text-muted"
          />
          <input
            ref={inputRef}
            aria-label="Buscar acción, partida o producto"
            className="h-12 min-w-0 flex-1 bg-transparent text-ds-md text-ds-text-primary outline-none placeholder:text-ds-text-muted"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Buscar acción, partida o producto..."
            value={query}
          />
          <kbd className="hidden h-6 shrink-0 items-center rounded-ds-sm bg-ds-muted px-1.5 text-ds-xs font-medium text-ds-text-secondary sm:inline-flex">
            Esc
          </kbd>
        </div>
        <ul className="max-h-80 overflow-y-auto py-1" role="listbox">
          {results.length === 0 ? (
            <li className="px-3 py-6 text-center text-ds-sm text-ds-text-muted">
              Sin coincidencias.
            </li>
          ) : (
            results.map((action, index) => {
              const active = index === activeIndex

              return (
                <li key={action.id} role="option" aria-selected={active}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2 text-left text-ds-sm transition-colors duration-(--ds-duration-fast)",
                      active
                        ? "bg-ds-primary-soft text-ds-text-primary"
                        : "text-ds-text-secondary hover:bg-ds-subtle"
                    )}
                    onClick={() => runAction(action)}
                    onPointerMove={() => setActiveIndex(index)}
                  >
                    <span className="text-ds-text-muted">{action.icon}</span>
                    <span className="min-w-0 flex-1 truncate font-medium text-ds-text-primary">
                      {action.label}
                    </span>
                    {action.hint ? (
                      <span className="shrink-0 text-ds-xs text-ds-text-muted">
                        {action.hint}
                      </span>
                    ) : null}
                  </button>
                </li>
              )
            })
          )}
        </ul>
      </div>
    </div>
  )
}

export { ExplorerCommandPalette }
